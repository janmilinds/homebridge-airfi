import EventEmitter from 'events';
import { Logging, PlatformAccessory } from 'homebridge';
import semverGte from 'semver/functions/gte';

import { AirfiHomebridgePlatform } from '../AirfiHomebridgePlatform';
import { AirfiModbusController } from '../controller';
import {
  AirfiFanService,
  AirfiHumiditySensorService,
  AirfiInformationService,
  AirfiSwitchService,
  AirfiTemperatureSensorService,
  AirfiThermostatService,
} from '../services';
import { AirfiDeviceContext, RegisterAddress, WriteQueue } from '../types';
import { sleep } from '../utils';

/**
 * Platform accessory for the Airfi air handling unit.
 */
export class AirfiAirHandlingUnitAccessory extends EventEmitter {
  private static readonly HOLDING_REGISTER_LENGTH = 58;

  private static readonly MIN_MODBUS_VERSION = '2.5.0';

  private static readonly INPUT_REGISTER_LENGTH = 40;

  private static readonly INTERVAL_FREQUENCY = 1000;

  private static readonly READ_FREQUENCY = 3;

  private readonly airfiController!: AirfiModbusController;

  private readonly featureFlags = {
    fireplaceFunction: false,
    boostedCooling: false,
    minimumTemperatureSet: false,
    saunaFunction: false,
  };

  private holdingRegister: number[] = [];

  private inputRegister: number[] = [];

  private intervalId: NodeJS.Timeout | undefined;

  private isNetworking = false;

  public readonly log: Logging;

  private queue: WriteQueue = new Map();

  private sequenceCount = 0;

  constructor(
    public readonly accessory: PlatformAccessory<AirfiDeviceContext>,
    private readonly platform: AirfiHomebridgePlatform
  ) {
    super();

    const {
      context: { config },
    } = accessory;
    this.log = platform.log;
    this.airfiController = new AirfiModbusController(
      config.host,
      config.port,
      this.log,
      this.platform.config.debug
    );

    this.deviceLookup()
      .then(() => {
        if (!this.validateDevice()) {
          return Promise.reject();
        }

        this.setFeatureFlags();
        return this.run();
      })
      .then(() => {
        this.initializeServices();
        this.emit('initialized');
        this.log.debug(
          'Finished initializing accessory:',
          this.accessory.displayName
        );

        // Run periodic operations into modbus.
        this.intervalId = setInterval(
          () => this.run(),
          AirfiAirHandlingUnitAccessory.INTERVAL_FREQUENCY
        );
      })
      .catch(() => {
        this.log.error(
          'Initialization could not be completed for accessory:',
          this.accessory.displayName
        );
      });
  }

  /**
   *
   */
  private async deviceLookup() {
    await this.airfiController
      .open()
      .then(async () => {
        await this.airfiController
          .read(1, 3, 3)
          .then((values) => {
            this.inputRegister = values;
          })
          .catch((error: Error) => this.log.error(error.toString()));
      })
      .catch((error: Error) => {
        this.log.error(error.toString());
      })
      .finally(() => {
        this.airfiController.close();
        this.isNetworking = false;
      });
  }

  /**
   * Initialize the accessory services.
   */
  private initializeServices() {
    // Clear accessory services prior to any changes.
    this.accessory.services
      .filter((service) => service.constructor.name !== 'AccessoryInformation')
      .forEach((service) => {
        this.accessory.removeService(service);
      });

    // Set accessory information
    new AirfiInformationService(this, this.platform, {
      displayName: this.accessory.displayName,
      name: '',
      updateFrequency: 60,
    });

    new AirfiFanService(this, this.platform, {
      configuredNameKey: 'service.fan',
      name: 'Ventilation',
      updateFrequency: 1,
    });

    new AirfiThermostatService(this, this.platform, {
      configuredNameKey: 'service.thermostat',
      name: 'SupplyAirTemperature',
      updateFrequency: 1,
    });

    new AirfiHumiditySensorService(this, this.platform, {
      configuredNameKey: 'service.humiditySensor',
      name: 'ExtractAirHumidity',
      updateFrequency: 60,
    });

    new AirfiTemperatureSensorService(this, this.platform, {
      configuredNameKey: 'service.temperatureSensor.outdoorAir',
      name: 'OutdoorAir',
      readAddress: '3x00004',
      subtype: '_outdoorAirTemp',
      updateFrequency: 60,
    });

    new AirfiTemperatureSensorService(this, this.platform, {
      configuredNameKey: 'service.temperatureSensor.extractAir',
      name: 'ExtractAir',
      readAddress: '3x00006',
      subtype: '_extractAirTemp',
      updateFrequency: 60,
    });

    new AirfiTemperatureSensorService(this, this.platform, {
      configuredNameKey: 'service.temperatureSensor.exhaustAir',
      name: 'ExhaustAir',
      readAddress: '3x00007',
      subtype: '_exhaustAirTemp',
      updateFrequency: 60,
    });

    new AirfiTemperatureSensorService(this, this.platform, {
      configuredNameKey: 'service.temperatureSensor.supplyAir',
      name: 'SupplyAir',
      readAddress: '3x00008',
      subtype: '_supplyAirTemp',
      updateFrequency: 60,
    });

    const {
      exposeFireplaceFunctionSwitch,
      exposeBoostedCoolingSwitch,
      exposeSaunaFunctionSwitch,
    } = this.accessory.context.config;

    if (exposeFireplaceFunctionSwitch) {
      new AirfiSwitchService(this, this.platform, {
        configuredNameKey: 'service.switch.fireplaceFunction',
        name: 'FireplaceFunction',
        subtype: '_fireplace',
        updateFrequency: 1,
        writeAddress: '4x00058',
      });
    }

    if (exposeBoostedCoolingSwitch) {
      new AirfiSwitchService(this, this.platform, {
        configuredNameKey: 'service.switch.boostedCooling',
        name: 'BoostedCooling',
        subtype: '_boostedCooling',
        updateFrequency: 1,
        writeAddress: '4x00051',
      });
    }

    if (exposeSaunaFunctionSwitch) {
      new AirfiSwitchService(this, this.platform, {
        configuredNameKey: 'service.switch.saunaFunction',
        name: 'SaunaFunction',
        subtype: '_sauna',
        updateFrequency: 1,
        writeAddress: '4x00057',
      });
    }
  }

  /**
   * Converts string representation of register address into register type and
   * address.
   *
   * @param registerAddress
   */
  private getRegisterAddress(registerAddress: RegisterAddress): number[] {
    if (!/^[3|4]x[\d]{5}$/.test(registerAddress)) {
      this.log.error(
        `Invalid register address format for "${registerAddress}"`
      );
      return [0, 0];
    }
    return registerAddress.split('x').map((value) => parseInt(value));
  }

  /**
   * Return value from a register.
   *
   * @param registerAddress
   *   String representation of register address including register type and
   *   address
   */
  getRegisterValue(registerAddress: RegisterAddress): number {
    const [register, address] = this.getRegisterAddress(registerAddress);

    if (register === 3) {
      return this.inputRegister[address - 1];
    }

    if (register === 4) {
      return this.holdingRegister[address - 1];
    }

    return -1;
  }

  /**
   * Queue value to be written into holding register.
   *
   * @param registerAddress
   *   Register address to write.
   * @param value
   *   Value to be written.
   */
  queueInsert(registerAddress: RegisterAddress, value: number) {
    const [register, address] = this.getRegisterAddress(registerAddress);

    if (register === 4) {
      this.holdingRegister[address - 1] = value;
      this.queue.set(address, value);
    } else {
      this.log.error(
        `Wrong write register type "${register}". ` +
          'Only holding register is writable'
      );
    }
  }

  /**
   * Pause interval execution and restart it after waiting time.
   *
   * @param seconds
   *   Number of seconds to wait before restarting
   */
  private async restart(seconds: number) {
    clearInterval(this.intervalId);

    this.sequenceCount = 0;
    this.log.warn(`Restarting modbus read/write in ${seconds} seconds...`);

    await sleep(seconds);
    this.intervalId = setInterval(
      () => this.run(),
      AirfiAirHandlingUnitAccessory.INTERVAL_FREQUENCY
    );
    this.log.info('Modbus read/write operations restarted');
  }

  /**
   * Run read & write operations for modbus registers.
   */
  private async run() {
    const queueLength = this.queue.size;

    this.sequenceCount++;
    if (this.sequenceCount > AirfiAirHandlingUnitAccessory.READ_FREQUENCY) {
      this.sequenceCount = 1;
    }

    // Return if it's not a read sequence and there's nothing to write.
    if (this.sequenceCount > 1 && queueLength === 0) {
      return;
    }

    if (this.isNetworking) {
      this.log.warn(
        `${this.accessory.displayName} is busy completing previous operations`
      );
      this.restart(10);
      return;
    }

    this.isNetworking = true;

    await this.airfiController
      .open()
      .then(async () => {
        // Write holding register.
        if (queueLength > 0) {
          await this.writeQueue();
        }

        if (this.sequenceCount === 1) {
          // Read and save holding register.
          await this.airfiController
            .read(1, AirfiAirHandlingUnitAccessory.HOLDING_REGISTER_LENGTH, 4)
            .then((values) => {
              this.holdingRegister = values;
            })
            .catch((error: Error) => this.log.error(error.toString()));

          // Read and save input register.
          await this.airfiController
            .read(1, AirfiAirHandlingUnitAccessory.INPUT_REGISTER_LENGTH, 3)
            .then((values) => {
              this.inputRegister = values;
            })
            .catch((error: Error) => this.log.error(error.toString()));
        }
      })
      .catch((error: Error) => {
        this.log.error(error.toString());
      })
      .finally(() => {
        this.airfiController.close();
        this.isNetworking = false;
      });
  }

  /**
   * Set feature flags based on the modbus map version.
   */
  private setFeatureFlags() {
    const deviceFirmwareVersion = AirfiInformationService.getVersionString(
      this.getRegisterValue('3x00002')
    );
    const deviceModbusMapVersion = AirfiInformationService.getVersionString(
      this.getRegisterValue('3x00003')
    );

    const deviceInfoHeadline = `----- ${this.accessory.displayName} -----`;
    this.log.info(deviceInfoHeadline);
    this.log.info('  Firmware version:', deviceFirmwareVersion);
    this.log.info('  Modbus map version:', deviceModbusMapVersion);
    this.log.info(deviceInfoHeadline.replace(/./g, '-'));

    if (semverGte(deviceModbusMapVersion, '2.1.0')) {
      this.featureFlags.minimumTemperatureSet = true;
    }

    if (semverGte(deviceModbusMapVersion, '2.5.0')) {
      this.featureFlags.fireplaceFunction = true;
      this.featureFlags.boostedCooling = true;
      this.featureFlags.saunaFunction = true;
    }
  }

  /**
   * Checks whether data was retrieved from the air handling unit and whether
   * the modbus map version is supported.
   */
  private validateDevice(): boolean {
    // Verify that data was retrieved from the air handling unit.
    if (this.inputRegister.length === 0) {
      this.log.error(
        'Failed to retrieve data from the air handling unit ' +
          `"${this.accessory.displayName}". ` +
          'Please check your network settings, the air handling unit is ' +
          'powered on and connected to a network. Then restart Homebridge ' +
          'and try again.'
      );

      return false;
    }

    return true;
  }

  /**
   * Write values from queue to the air handling unit.
   */
  private async writeQueue(): Promise<void> {
    this.log.debug('Writing values to modbus');

    for (const [address, value] of this.queue) {
      await this.airfiController
        .write(address, value)
        .catch((error: Error) => this.log.error(error.toString()))
        .finally(() => {
          this.queue.delete(address);
        });
    }

    return Promise.resolve();
  }
}
