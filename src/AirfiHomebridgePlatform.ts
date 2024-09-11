import {
  API,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  Service,
  Characteristic,
} from 'homebridge';
import { Validator } from 'jsonschema';

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

    // Homebridge 1.8.0 introduced a `log.success` method that can be used to
    // log success messages. For users that are on a version prior to 1.8.0, we
    // need a 'polyfill' for this method.
    if (!log.success) {
      log.success = log.info;
    }

    if (!this.validateConfig()) {
      this.log.error(
        'Plugin configuration is invalid. Please check the configuration ' +
          'and restart Homebridge.'
      );

      return;
    }

    this.log.debug('Config:', this.config);

    if (this.config.language) {
      i18n.changeLanguage(this.config.language);
    }

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
  private discoverDevices() {
    for (const device of this.config.devices) {
      const uuid = this.api.hap.uuid.generate(device.serialNumber);

      this.log.debug('Discovered device:', device);

      const existingAccessory = this.accessories.find(
        (accessory) => accessory.UUID === uuid
      );

      if (existingAccessory) {
        this.log.info(
          'Restoring existing accessory from cache:',
          existingAccessory.context.displayName
        );
      } else {
        const displayName = `Airfi ${device.model} #${device.serialNumber}`;

        this.log.info('Adding new accessory:', displayName);

        const accessory = new this.api.platformAccessory<AirfiDeviceContext>(
          displayName,
          uuid
        );

        accessory.context = { config: device, displayName, uniqueId: uuid };

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
      }
    }
  }

  /**
   * Remove any accessories that are no longer present in configuration.
   */
  private removeUnconfiguredAccessories() {
    const configuredAccessories = this.config.devices.map(
      ({ serialNumber }) => serialNumber
    );

    const obsoleteAccessories = this.accessories.filter(
      ({
        context: {
          config: { serialNumber },
        },
      }) => !configuredAccessories.includes(serialNumber)
    );

    if (obsoleteAccessories.length > 0) {
      this.log.debug(
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

  public t(key: string, options?: Record<string, unknown>): string {
    return i18n.t(key, options) as string;
  }
}
