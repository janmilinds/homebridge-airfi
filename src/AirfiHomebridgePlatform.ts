import {
  API,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';
import semverGte from 'semver/functions/gte';

import { AirfiModbusController } from './controller';
import { AirfiInformationService } from './services';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { RegisterAddress, WriteQueue } from './types';
import { sleep } from './utils';

import { AirfiVentilationUnitPlatformAccessory } from './AirfiVentilationUnitPlatformAccessory';
/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class AirfiHomebridgePlatform implements DynamicPlatformPlugin {
  private static readonly HOLDING_REGISTER_LENGTH = 58;

  private static readonly INPUT_REGISTER_LENGTH = 40;

  private static readonly INTERVAL_FREQUENCY = 1000;

  private static readonly READ_FREQUENCY = 3;

  private static readonly minModbusVersion = '2.5.0';

  public readonly Service: typeof Service;

  public readonly Characteristic: typeof Characteristic;

  private readonly airfiController!: AirfiModbusController;

  public readonly accessories: PlatformAccessory[] = [];

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

    if (!this.validate()) {
      return;
    }

    this.log.debug('Config:', this.config);

    this.airfiController = new AirfiModbusController(
      this.config.host,
      this.config.port,
      log
    );
    this.name = this.config.name as string;
    this.serialNumber = this.config.serialNumber;

    // Initial modbus register read.
    this.run().then(() => {
      const deviceModbusMapVersion = AirfiInformationService.getVersionString(
        this.getRegisterValue('3x00003')
      );

      this.log.info('Device Modbus map version:', deviceModbusMapVersion);

      if (
        semverGte(
          deviceModbusMapVersion,
          AirfiHomebridgePlatform.minModbusVersion
        ) === false
      ) {
        this.log.error(
          `The device Modbus map version ${deviceModbusMapVersion} is not supported. ` +
            `Minimun required Modbus map version is ${AirfiHomebridgePlatform.minModbusVersion}. Please update the device firmware.`
        );
        return;
      }

      this.isInitialized = true;
      this.log.debug('Finished initializing platform:', this.config.name);
    });

    // When this event is fired it means Homebridge has restored all cached
    // accessories from disk. Dynamic Platform plugins should only register new
    // accessories after this event was fired, in order to ensure they weren't
    // added to homebridge already. This event can also be used to start
    // discovery of new accessories.
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
   * This function is invoked when homebridge restores cached accessories from
   * disk at startup. It should be used to set up event handlers for
   * characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if
    // it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {
    const devices = [
      {
        uniqueId: this.serialNumber,
        displayName: 'Ventilation unit',
      },
    ];

    // loop over the discovered devices and register each one if it has not
    // already been registered
    for (const device of devices) {
      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.uniqueId);

      this.log.debug('Discovered device:', device.displayName);

      // see if an accessory with the same uuid has already been registered and
      // restored from the cached devices we stored in the `configureAccessory`
      // method above
      const existingAccessory = this.accessories.find(
        (accessory) => accessory.UUID === uuid
      );

      if (existingAccessory) {
        // the accessory already exists
        this.log.info(
          'Restoring existing accessory from cache:',
          existingAccessory.displayName
        );

        // if you need to update the accessory.context then you should run
        // `api.updatePlatformAccessories`. e.g.:
        // this.log.debug('Existing accessory:', existingAccessory);
        // existingAccessory.context.device = device;
        // this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        new AirfiVentilationUnitPlatformAccessory(this, existingAccessory);

        // it is possible to remove platform accessories at any time using
        // `api.unregisterPlatformAccessories`, e.g.:
        // remove platform accessories when no longer present
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.displayName);

        // create a new accessory
        const accessory = new this.api.platformAccessory(
          device.displayName,
          uuid
        );

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the
        // accessory you may need
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        new AirfiVentilationUnitPlatformAccessory(this, accessory);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
      }
    }

    this.api.updatePlatformAccessories(this.accessories);
  }

  /**
   * Check if all required parameters are present in the config.
   *
   * @returns Boolean whether the configuration is valid.
   */
  private validate() {
    let errors = 0;

    if (!this.config.host) {
      this.log.error('Missing required config parameter: host');
      errors++;
    }

    if (!this.config.port) {
      this.log.error('Missing required config parameter: port');
      errors++;
    }

    if (!this.config.name) {
      this.log.error('Missing required config parameter: name');
      errors++;
    }

    if (!this.config.model) {
      this.log.error('Missing required config parameter: model');
      errors++;
    }

    if (!this.config.serialNumber) {
      this.log.error('Missing required config parameter: serialNumber');
      errors++;
    }

    if (errors) {
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
        `Wrong write register type "${register}" – only holding register is writable`
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

  /**
   * Write values from queue to the ventilation unit.
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
