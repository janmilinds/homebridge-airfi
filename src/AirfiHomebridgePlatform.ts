import {
  API,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  Service,
  Characteristic,
} from 'homebridge';
import { Validator } from 'jsonschema';

import { AirfiAirHandlingUnitAccessory } from './accessory';
import configSchema from '../config.schema.json';
import i18n from './i18n';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { AirfiDeviceContext, AirfiPlatformConfig } from './types';

/**
 * Homebridge platform for the Airfi air handling unit.
 */
export class AirfiHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;

  public readonly Characteristic: typeof Characteristic;

  public readonly accessories: PlatformAccessory<AirfiDeviceContext>[] = [];

  constructor(
    public readonly log: Logging,
    public readonly config: AirfiPlatformConfig,
    public readonly api: API
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    log.prefix = config.name;

    if (!this.validateConfig()) {
      this.log.error(
        'Plugin configuration is invalid. Please check the configuration ' +
          'and restart Homebridge.'
      );

      return;
    }

    this.log.debug('Config:', this.config);
    i18n.changeLanguage(this.config.language);

    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');

      this.removeUnconfiguredAccessories();
      this.discoverDevices();
    });
  }

  /**
   * {@inheritDoc DynamicPlatformPlugin.configureAccessory}
   */
  configureAccessory(accessory: PlatformAccessory<AirfiDeviceContext>) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if
    // it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * Creates a UUID for the given identifier strings.
   *
   * @param identifier
   *  Identifier string.
   * @param args
   *   0..n additional identifier strings to distinguish the device.
   *
   * @returns The generated UUID.
   */
  private createUUID(identifier: string, ...args: string[]) {
    return this.api.hap.uuid.generate([identifier, ...args].join('-'));
  }

  /**
   * Discover devices and register them as accessories.
   */
  private discoverDevices() {
    for (const device of this.config.devices) {
      const displayName = `Airfi ${device.model} #${device.serialNumber}`;
      const uuid = this.createUUID(device.serialNumber);

      this.log.debug('Discovered device:', device);

      const existingAccessory = this.accessories.find(
        (accessory) => accessory.UUID === uuid
      );

      if (existingAccessory) {
        existingAccessory.context.config = device;
        existingAccessory.displayName = displayName;

        const airHandlingUnitAccessory = new AirfiAirHandlingUnitAccessory(
          existingAccessory,
          this
        );

        airHandlingUnitAccessory.once('initialized', () => {
          this.log.info('Restoring accessory from cache:', displayName);
          this.api.updatePlatformAccessories([existingAccessory]);
        });
      } else {
        const accessory = new this.api.platformAccessory<AirfiDeviceContext>(
          displayName,
          uuid
        );

        accessory.context = { config: device };

        const airHandlingUnitAccessory = new AirfiAirHandlingUnitAccessory(
          accessory,
          this
        );

        airHandlingUnitAccessory.once('initialized', () => {
          this.log.info('Adding new accessory:', displayName);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
            accessory,
          ]);
        });
      }
    }
  }

  /**
   * Remove any accessories that are no longer present in configuration.
   */
  private removeUnconfiguredAccessories() {
    const configuredAccessoryUUIDs = this.config.devices.map(
      ({ serialNumber }) => this.createUUID(serialNumber)
    );

    const obsoleteAccessories = this.accessories.filter(
      ({ UUID }) => !configuredAccessoryUUIDs.includes(UUID)
    );

    if (obsoleteAccessories.length > 0) {
      this.log.info(
        'Unregistering obsolete accessories:',
        obsoleteAccessories.map(({ displayName }) => displayName)
      );

      // Remove any obsolete cached accessories.
      this.api.unregisterPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        obsoleteAccessories
      );
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
          `Property "${error.property.split('.')[1]}" ${error.message}`
        );
      });

      return false;
    }

    return true;
  }
}
