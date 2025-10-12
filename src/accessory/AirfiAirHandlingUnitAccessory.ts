import EventEmitter from 'events';
import { Logging, PlatformAccessory, Service } from 'homebridge';
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
  private static readonly MIN_MODBUS_VERSION = '1.5.0';

  private static readonly INTERVAL_FREQUENCY = 1000;

  private static readonly READ_FREQUENCY = 3;

  private readonly airfiController!: AirfiModbusController;

  private readonly featureFlags = {
    fireplaceFunction: false,
    boostedCooling: false,
    minimumTemperatureSet: false,
    saunaFunction: false,
  };

  private firmwareVersion = '';

  private holdingRegister: number[] = [];

  private holdingRegisterLength = 12;

  private inputRegister: number[] = [];

  private inputRegisterLength = 31;

  private intervalId: NodeJS.Timeout | undefined;

  private isNetworking = false;

  public readonly log: Logging;

  private modbusMapVersion = '';

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

    this.initialize()
      .then(() => {
        this.log.debug(
          'Finished initializing accessory:',
          this.accessory.displayName
        );
        this.emit('initialized');
      })
      .catch((error: Error) => {
        this.log.error(
          `Error while initializing "${this.accessory.displayName}":`,
          error.message
        );
        this.emit('error');
      });
  }

  /**
   * Tests connection to the air handling unit and reads version information.
   */
  private async deviceLookup() {
    this.isNetworking = true;

    await this.airfiController
      .open()
      .then(() =>
        this.airfiController.read(1, 3, 3).then((values) => {
          this.inputRegister = values;
        })
      )
      .finally(() => {
        this.airfiController.close();
        this.isNetworking = false;
      });
  }

  /**
   * Perform a data sync operation with the air handling unit.
   */
  private async deviceSync() {
    if (!this.shouldExecute()) {
      return;
    }

    if (this.isNetworking) {
      this.log.warn(
        `${this.accessory.displayName} is busy completing previous operations`
      );
      this.restartSync(10);
      return;
    }

    this.isNetworking = true;

    await this.airfiController
      .open()
      .then(() => this.performReadWriteOperations())
      .finally(() => {
        this.airfiController.close();
        this.isNetworking = false;
      });
  }

  /**
   * Perform read and write operations to the air handling unit.
   */
  private async performReadWriteOperations(): Promise<void> {
    // Write operations first
    if (this.queue.size > 0) {
      await this.writeQueue();
    }

    // Read operations only on sequence 1
    if (this.sequenceCount === 1) {
      await this.readRegisters();
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
   * Check whether the feature is supported by the air handling unit.
   *
   * @param key
   *   Feature key to check.
   *
   * @returns Whether the feature is enabled.
   */
  public hasFeature(key: keyof typeof this.featureFlags): boolean {
    return this.featureFlags[key] ?? false;
  }

  /**
   * Initialize the accessory with device data and services.
   */
  private async initialize() {
    await this.deviceLookup()
      .then(() => {
        if (!this.isSupportedDevice()) {
          throw new Error('Device validation failed during initialization');
        }

        this.setRegisterLengths();
        this.setFeatureFlags();

        // Retrieve initial data from the air handling unit.
        return this.deviceSync();
      })
      .then(() => {
        this.initializeServices();

        // Start periodic sync operations.
        this.startPeriodicSync();
      })
      .catch((error: Error) => {
        throw error;
      });
  }

  /**
   * Initialize the accessory services.
   */
  private initializeServices() {
    const services: Record<string, Service> = {};

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

    services.ventilation = new AirfiFanService(this, this.platform, {
      configuredNameKey: 'service.fan',
      name: 'Ventilation',
      updateFrequency: 1,
    }).getService();
    services.ventilation.setPrimaryService(true);

    services.thermostat = new AirfiThermostatService(this, this.platform, {
      configuredNameKey: 'service.thermostat',
      name: 'SupplyAirTemperature',
      updateFrequency: 1,
    }).getService();
    services.ventilation.addLinkedService(services.thermostat);

    services.humiditySensor = new AirfiHumiditySensorService(
      this,
      this.platform,
      {
        configuredNameKey: 'service.humiditySensor',
        name: 'ExtractAirHumidity',
        updateFrequency: 60,
      }
    ).getService();
    services.ventilation.addLinkedService(services.humiditySensor);

    services.temperatureOutdoorAir = new AirfiTemperatureSensorService(
      this,
      this.platform,
      {
        configuredNameKey: 'service.temperatureSensor.outdoorAir',
        name: 'OutdoorAir',
        readAddress: '3x00004',
        subtype: '_outdoorAirTemp',
        updateFrequency: 60,
      }
    ).getService();
    services.ventilation.addLinkedService(services.temperatureOutdoorAir);

    services.temperatureExtractAir = new AirfiTemperatureSensorService(
      this,
      this.platform,
      {
        configuredNameKey: 'service.temperatureSensor.extractAir',
        name: 'ExtractAir',
        readAddress: '3x00006',
        subtype: '_extractAirTemp',
        updateFrequency: 60,
      }
    ).getService();
    services.ventilation.addLinkedService(services.temperatureExtractAir);

    services.temperatureExhaustAir = new AirfiTemperatureSensorService(
      this,
      this.platform,
      {
        configuredNameKey: 'service.temperatureSensor.exhaustAir',
        name: 'ExhaustAir',
        readAddress: '3x00007',
        subtype: '_exhaustAirTemp',
        updateFrequency: 60,
      }
    ).getService();
    services.ventilation.addLinkedService(services.temperatureExhaustAir);

    services.temperatureSupplyAir = new AirfiTemperatureSensorService(
      this,
      this.platform,
      {
        configuredNameKey: 'service.temperatureSensor.supplyAir',
        name: 'SupplyAir',
        readAddress: '3x00008',
        subtype: '_supplyAirTemp',
        updateFrequency: 60,
      }
    ).getService();
    services.ventilation.addLinkedService(services.temperatureSupplyAir);

    const {
      exposeFireplaceFunctionSwitch,
      exposeBoostedCoolingSwitch,
      exposeSaunaFunctionSwitch,
    } = this.accessory.context.config;

    if (this.hasFeature('fireplaceFunction') && exposeFireplaceFunctionSwitch) {
      services.switchFireplaceFunction = new AirfiSwitchService(
        this,
        this.platform,
        {
          configuredNameKey: 'service.switch.fireplaceFunction',
          name: 'FireplaceFunction',
          subtype: '_fireplace',
          updateFrequency: 1,
          writeAddress: '4x00058',
        }
      ).getService();
      services.ventilation.addLinkedService(services.switchFireplaceFunction);
    }

    if (this.hasFeature('boostedCooling') && exposeBoostedCoolingSwitch) {
      services.switchBoostedCooling = new AirfiSwitchService(
        this,
        this.platform,
        {
          configuredNameKey: 'service.switch.boostedCooling',
          name: 'BoostedCooling',
          subtype: '_boostedCooling',
          updateFrequency: 1,
          writeAddress: '4x00051',
        }
      ).getService();
      services.ventilation.addLinkedService(services.switchBoostedCooling);
    }

    if (this.hasFeature('saunaFunction') && exposeSaunaFunctionSwitch) {
      services.switchSaunaFunction = new AirfiSwitchService(
        this,
        this.platform,
        {
          configuredNameKey: 'service.switch.saunaFunction',
          name: 'SaunaFunction',
          subtype: '_sauna',
          updateFrequency: 1,
          writeAddress: '4x00057',
        }
      ).getService();
      services.ventilation.addLinkedService(services.switchSaunaFunction);
    }
  }

  /**
   * Checks whether data was retrieved from the air handling unit and whether
   * the modbus map version is supported.
   */
  private isSupportedDevice(): boolean {
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

    this.firmwareVersion = AirfiInformationService.getVersionString(
      this.getRegisterValue('3x00002')
    );

    this.modbusMapVersion = AirfiInformationService.getVersionString(
      this.getRegisterValue('3x00003')
    );

    if (
      !semverGte(
        this.modbusMapVersion,
        AirfiAirHandlingUnitAccessory.MIN_MODBUS_VERSION
      )
    ) {
      this.log.error(
        `Device firmware version ${this.firmwareVersion} is unsupported. ` +
          'Please upgrade to a newer version.'
      );

      return false;
    }

    // Firmware 3.2.0 has a hidden register address causing issues with the
    // plugin; therefore, it is not supported.
    if (this.firmwareVersion === '3.2.0') {
      this.log.error(
        'Air handling unit firmware version 3.2.0 is unsupported. ' +
          'Please downgrade or upgrade to another version.'
      );

      return false;
    }

    return true;
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
   * Reads both holding and input registers from the air handling unit.
   */
  private async readRegisters(): Promise<void> {
    // Read holding register
    await this.airfiController
      .read(1, this.holdingRegisterLength, 4)
      .then((values) => {
        this.holdingRegister = values;
      });

    // Read input register
    await this.airfiController
      .read(1, this.inputRegisterLength, 3)
      .then((values) => {
        this.inputRegister = values;
      });
  }

  /**
   * Pause interval execution and restart it after waiting time.
   *
   * @param seconds
   *   Number of seconds to wait before restarting
   */
  private async restartSync(seconds: number) {
    clearInterval(this.intervalId);

    this.sequenceCount = 0;
    this.log.warn(`Restarting device data sync in ${seconds} seconds...`);

    await sleep(seconds);
    this.startPeriodicSync();
    this.log.info('Device data sync restarted');
  }

  /**
   * Set feature flags based on the modbus map version.
   */
  private setFeatureFlags() {
    const deviceInfoHeadline = `----- ${this.accessory.displayName} -----`;
    this.log.info(deviceInfoHeadline);
    this.log.info('  Firmware version:', this.firmwareVersion);
    this.log.info('  Modbus map version:', this.modbusMapVersion);
    this.log.info(deviceInfoHeadline.replace(/./g, '-'));

    if (semverGte(this.modbusMapVersion, '2.1.0')) {
      this.featureFlags.minimumTemperatureSet = true;
    }

    if (semverGte(this.modbusMapVersion, '2.5.0')) {
      this.featureFlags.fireplaceFunction = true;
      this.featureFlags.boostedCooling = true;
      this.featureFlags.saunaFunction = true;
    }

    this.log.debug('Feature flags:', this.featureFlags);
  }

  /**
   * Set the input and holding register lengths based on the modbus map version.
   */
  private setRegisterLengths() {
    const registerLengths = {
      '2.7.0': [42, 59],
      '2.5.0': [40, 58],
      '2.3.0': [40, 55],
      '2.1.0': [40, 51],
      '2.0.0': [40, 34],
      '1.5.0': [31, 12],
    };

    for (const [
      version,
      [inputRegisterLength, holdingRegisterLength],
    ] of Object.entries(registerLengths)) {
      if (semverGte(this.modbusMapVersion, version)) {
        this.inputRegisterLength = inputRegisterLength;
        this.holdingRegisterLength = holdingRegisterLength;
        this.log.debug(
          `Setting input register length to ${this.inputRegisterLength} and ` +
            `holding register length to ${this.holdingRegisterLength}`
        );

        break;
      }
    }
  }

  /**
   * Determine if the accessory should execute a read or write operation.
   *
   * @returns True if the accessory should execute, false otherwise.
   */
  private shouldExecute(): boolean {
    this.sequenceCount++;
    if (this.sequenceCount > AirfiAirHandlingUnitAccessory.READ_FREQUENCY) {
      this.sequenceCount = 1;
    }

    // Return if it's not a read sequence and there's nothing to write
    return !(this.sequenceCount > 1 && this.queue.size === 0);
  }

  /**
   * Start the periodic sync operations.
   */
  private startPeriodicSync(): void {
    this.intervalId = setInterval(() => {
      this.deviceSync().catch((error: Error) => {
        this.log.error(`Device sync failed: ${error.message}`);
        this.restartSync(10);
      });
    }, AirfiAirHandlingUnitAccessory.INTERVAL_FREQUENCY);
  }

  /**
   * Write values from queue to the air handling unit.
   */
  private async writeQueue(): Promise<void> {
    this.log.debug('Writing values to device');

    for (const [address, value] of this.queue) {
      await this.airfiController.write(address, value).finally(() => {
        this.queue.delete(address);
      });
    }
  }
}
