import { Logging } from 'homebridge';
import semverGte from 'semver/functions/gte';

import { AirfiInformationService } from '../services';
import { FeatureFlags } from '../types';

export class AirfiFeatureManager {
  private readonly featureFlags: FeatureFlags = {
    fireplaceFunction: false,
    boostedCooling: false,
    minimumTemperatureSet: false,
    saunaFunction: false,
  };

  private firmwareVersion = '';

  private static readonly MIN_MODBUS_VERSION = '1.5.0';

  private modbusMapVersion = '';

  constructor(private readonly log: Logging) {}

  /**
   * Initialize feature detection based on device version information.
   *
   * @param displayName
   *   The display name of the device.
   * @param initialValues
   *   Initial input register values read from the device.
   */
  initialize(displayName: string, initialValues: number[]): void {
    if (!this.isSupportedDevice(initialValues)) {
      return;
    }

    // Set feature flags based on versions
    this.setFeatureFlags();

    // Log device information
    this.logDeviceInfo(displayName);
  }

  /**
   * Check if device supports a specific feature.
   *
   * @param key
   *   The feature flag key to check.
   *
   * @returns True if the feature is supported, false otherwise.
   */
  hasFeature(key: keyof FeatureFlags): boolean {
    return this.featureFlags[key] ?? false;
  }

  /**
   * Calculate register lengths based on modbus map version.
   *
   * @returns Tuple containing input register length and holding register length.
   */
  getRegisterLengths(): [number, number] {
    const registerLengths: Record<
      `${number}.${number}.${number}`,
      [number, number]
    > = {
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
        this.log.debug(
          `Setting input register length to ${inputRegisterLength} and ` +
            `holding register length to ${holdingRegisterLength}`
        );
        return [inputRegisterLength, holdingRegisterLength];
      }
    }

    return registerLengths['1.5.0'];
  }

  /**
   * Validate if device is supported by this plugin.
   *
   * @param inputRegister
   *   Initial input register values read from the device.
   *
   * @returns True if the device is supported, otherwise throws an error.
   */
  private isSupportedDevice(inputRegister: number[]): boolean {
    // Verify that data was retrieved from the air handling unit.
    if (inputRegister.length < 3) {
      throw new Error(
        'Failed to retrieve data from the air handling unit. ' +
          'Please check your network settings, the air handling unit is ' +
          'powered on and connected to a network. Then restart Homebridge ' +
          'and try again.'
      );
    }

    this.firmwareVersion = AirfiInformationService.getVersionString(
      // 3x00002
      inputRegister[1]
    );

    this.modbusMapVersion = AirfiInformationService.getVersionString(
      // 3x00003
      inputRegister[2]
    );

    if (
      !semverGte(this.modbusMapVersion, AirfiFeatureManager.MIN_MODBUS_VERSION)
    ) {
      throw new Error(
        `Device firmware version ${this.firmwareVersion} is unsupported. ` +
          'Please upgrade to a newer version.'
      );
    }

    // Firmware 3.2.0 has a hidden register address causing issues with the
    // plugin; therefore, it is not supported.
    if (this.firmwareVersion === '3.2.0') {
      throw new Error(
        'Air handling unit firmware version 3.2.0 is unsupported. ' +
          'Please downgrade or upgrade to another version.'
      );
    }

    return true;
  }

  /**
   * Set feature flags based on the modbus map version.
   */
  private setFeatureFlags() {
    if (semverGte(this.modbusMapVersion, '2.1.0')) {
      this.featureFlags.minimumTemperatureSet = true;
    }

    if (semverGte(this.modbusMapVersion, '2.5.0')) {
      this.featureFlags.fireplaceFunction = true;
      this.featureFlags.boostedCooling = true;
      this.featureFlags.saunaFunction = true;
    }
  }

  /**
   * Log device information and features.
   */
  private logDeviceInfo(displayName: string): void {
    const deviceInfoHeadline = `----- ${displayName} -----`;
    this.log.info(deviceInfoHeadline);
    this.log.info('  Firmware version:', this.firmwareVersion);
    this.log.info('  Modbus map version:', this.modbusMapVersion);
    this.log.info(deviceInfoHeadline.replace(/./g, '-'));

    this.log.debug('Feature flags:', this.featureFlags);
  }
}
