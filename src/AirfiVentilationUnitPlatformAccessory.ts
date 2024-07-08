import { PlatformAccessory } from 'homebridge';

import { AirfiHomebridgePlatform } from './AirfiHomebridgePlatform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class AirfiVentilationUnitPlatformAccessory {
  constructor(
    private readonly platform: AirfiHomebridgePlatform,
    private readonly accessory: PlatformAccessory
  ) {
    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Airfi')
      .setCharacteristic(
        this.platform.Characteristic.Model,
        this.platform.config.model
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.platform.config.serialNumber
      );
  }
}
