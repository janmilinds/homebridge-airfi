import {
  API,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';
import { Validator } from 'jsonschema';
import semverGte from 'semver/functions/gte';

import configSchema from '../config.schema.json';
import { AirfiPlatformAccessory } from './AirfiPlatformAccessory';
import { AirfiModbusController } from './controller';
import i18n from './i18n';
import { AirfiInformationService } from './services';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { AirfiDeviceContext, RegisterAddress, WriteQueue } from './types';
import { sleep } from './utils';

/**
 * Homebridge platform for the Airfi air handling unit.
 */
export class AirfiHomebridgePlatform implements DynamicPlatformPlugin {
  private static readonly HOLDING_REGISTER_LENGTH = 58;

  private static readonly MIN_MODBUS_VERSION = '2.5.0';

  private static readonly INPUT_REGISTER_LENGTH = 40;

  private static readonly INTERVAL_FREQUENCY = 1000;

  private static readonly READ_FREQUENCY = 3;

  public readonly Service: typeof Service;

  public readonly Characteristic: typeof Characteristic;

  private readonly airfiController!: AirfiModbusController;

  public readonly accessories: PlatformAccessory<AirfiDeviceContext>[] = [];

  private holdingRegister: number[] = [];

  private inputRegister: number[] = [];

  private intervalId: NodeJS.Timeout | undefined;

  private isInitialized = false;

  private isNetworking = false;

  private readonly name!: string;

  private queue: WriteQueue = {};

  private sequenceCount = 0;

  private readonly serialNumber: string = '';

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    // Homebridge 1.8.0 introduced a `log.success` method that can be used to
    // log success messages. For users that are on a version prior to 1.8.0, we
    // need a 'polyfill' for this method.
    if (!log.success) {
      log.success = log.info;
    }

    if (!this.validateConfig()) {
      this.log.error(
        'Plugin configuration is invalid. Please check the ' +
          'configuration and restart Homebridge.'
      );

      return;
    }

    this.log.debug('Config:', this.config);

    if (this.config.language) {
      i18n.changeLanguage(this.config.language);
    }

    this.airfiController = new AirfiModbusController(
      this.config.host,
      this.config.port,
      log
    );
    this.name = this.config.name as string;
    this.serialNumber = this.config.serialNumber;

    // Initial modbus register read.
    this.run().then(() => {
      if (
        this.holdingRegister.length === 0 &&
        this.inputRegister.length === 0
      ) {
        this.log.error(
          'Failed to retrieve data from the device. ' +
            'Please check your network settings, the device is powered on ' +
            'and connected to a network. Then restart Homebridge and try again.'
        );
        return;
      }

      const deviceModbusMapVersion = AirfiInformationService.getVersionString(
        this.getRegisterValue('3x00003')
      );

      this.log.info('Device Modbus map version:', deviceModbusMapVersion);

      if (
        semverGte(
          deviceModbusMapVersion,
          AirfiHomebridgePlatform.MIN_MODBUS_VERSION
        ) === false
      ) {
        this.log.error(
          `The device Modbus map version ${deviceModbusMapVersion} is not ` +
            'supported. Minimun required Modbus map version is ' +
            `${AirfiHomebridgePlatform.MIN_MODBUS_VERSION}. Please update ` +
            'the device firmware.'
        );
        return;
      }

      this.isInitialized = true;
      this.log.debug('Finished initializing platform:', this.config.name);
    });

    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');

      const initializationCheck = setInterval(() => {
        // Wait for initialization to complete before discovering devices.
        if (this.isInitialized) {
          clearInterval(initializationCheck);

          this.discoverDevices();

          // Run periodic operations into modbus.
          this.intervalId = setInterval(
            () => this.run(),
            AirfiHomebridgePlatform.INTERVAL_FREQUENCY
          );
        }
      }, 1000);
    });
  }

  /**
   * {@inheritDoc DynamicPlatformPlugin.configureAccessory}
   */
  configureAccessory(accessory: PlatformAccessory<AirfiDeviceContext>) {
    this.log.info(
      'Loading accessory from cache:',
      accessory.context.displayName
    );

    // add the restored accessory to the accessories cache, so we can track if
    // it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * Discover devices and register them as accessories.
   */
  discoverDevices() {
    const devices: AirfiDeviceContext[] = [
      {
        displayName: `Airfi #${this.serialNumber}`,
        uniqueId: this.serialNumber,
      },
    ];

    for (const device of devices) {
      const uuid = this.api.hap.uuid.generate(device.uniqueId);

      this.log.debug('Discovered device:', {
        name: device.displayName,
        uniqueId: device.uniqueId,
        uuid,
      });

      const existingAccessory = this.accessories.find(
        (accessory) => accessory.UUID === uuid
      );

      if (existingAccessory) {
        this.log.info(
          'Restoring existing accessory from cache:',
          device.displayName
        );

        new AirfiPlatformAccessory(this, existingAccessory);
      } else {
        this.log.info('Adding new accessory:', device.displayName);

        const accessory = new this.api.platformAccessory<AirfiDeviceContext>(
          device.displayName,
          uuid
        );

        accessory.context = device;

        new AirfiPlatformAccessory(this, accessory);

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
      }

      const obsoleteAccessories = this.accessories.filter(
        ({ context: { uniqueId } }) =>
          !devices.map(({ uniqueId }) => uniqueId).includes(uniqueId)
      );

      if (obsoleteAccessories.length > 0) {
        this.log.debug(
          'Unregistering obsolete accessories:',
          obsoleteAccessories.map(({ context: { displayName } }) => displayName)
        );

        // Remove any obsolete cached accessories.
        this.api.unregisterPlatformAccessories(
          PLUGIN_NAME,
          PLATFORM_NAME,
          obsoleteAccessories
        );
      }
    }
  }

  /**
   * Validates the plugin configuration.
   *
   * @returns Boolean whether the configuration is valid.
   */
  private validateConfig() {
    const validator = new Validator();
    const errors = validator.validate(this.config, configSchema.schema).errors;

    if (errors.length > 0) {
      errors.forEach((error) => {
        this.log.error(
          'Error with plugin configuration. ' +
            `Property "${error.property.split('.')[1]}" ${error.message}`
        );
      });

      return false;
    }

    return true;
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
      this.queue[address] = value;
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
      AirfiHomebridgePlatform.INTERVAL_FREQUENCY
    );
    this.log.info('Modbus read/write operations restarted');
  }

  /**
   * Run read & write operations for modbus registers.
   */
  private async run() {
    const queueLength = Object.keys(this.queue).length;

    this.sequenceCount++;
    if (this.sequenceCount > AirfiHomebridgePlatform.READ_FREQUENCY) {
      this.sequenceCount = 1;
    }

    // Return if it's not a read sequence and there's nothing to write.
    if (this.sequenceCount > 1 && queueLength === 0) {
      return;
    }

    if (this.isNetworking) {
      this.log.warn(`${this.name} is busy completing previous operations`);
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
            .read(1, AirfiHomebridgePlatform.HOLDING_REGISTER_LENGTH, 4)
            .then((values) => {
              this.holdingRegister = values;
            })
            .catch((error) => this.log.error(error as string));

          // Read and save input register.
          await this.airfiController
            .read(1, AirfiHomebridgePlatform.INPUT_REGISTER_LENGTH, 3)
            .then((values) => {
              this.inputRegister = values;
            })
            .catch((error) => this.log.error(error as string));
        }
      })
      .catch((error) => {
        this.log.error(error as string);
      })
      .finally(() => {
        this.airfiController.close();
        this.isNetworking = false;
      });
  }

  public t(key: string, options?: Record<string, unknown>): string {
    return i18n.t(key, options) as string;
  }

  /**
   * Write values from queue to the air handling unit.
   */
  private async writeQueue(): Promise<void> {
    this.log.debug('Writing values to modbus');

    for (const queueItem of Object.entries(this.queue)) {
      const [address, value] = queueItem;
      await this.airfiController
        .write(parseInt(address), value)
        .catch((error) => this.log.error(error as string))
        .finally(() => {
          delete this.queue[address];
        });
    }

    return Promise.resolve();
  }
}
