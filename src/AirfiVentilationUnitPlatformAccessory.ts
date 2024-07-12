import { PlatformAccessory } from 'homebridge';

import { AirfiHomebridgePlatform } from './AirfiHomebridgePlatform';
import {
  AirfiFanService,
  AirfiHumiditySensorService,
  AirfiInformationService,
  AirfiSwitchService,
  AirfiTemperatureSensorService,
  AirfiThermostatService,
} from './services';

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
    // Set accessory information
    new AirfiInformationService(
      this.accessory,
      this.platform,
      'Ventilation unit'
    );

    // Setup accessory services
    new AirfiFanService(this.accessory, this.platform, 'Ventilation', 1);
    new AirfiHumiditySensorService(
      this.accessory,
      this.platform,
      'Extract air humidity'
    );
    new AirfiTemperatureSensorService(
      this.accessory,
      this.platform,
      'Outdoor air',
      '_outdoorAirTemp',
      '3x00004'
    );
    new AirfiTemperatureSensorService(
      this.accessory,
      this.platform,
      'Extract air',
      '_extractAirTemp',
      '3x00006'
    );
    new AirfiTemperatureSensorService(
      this.accessory,
      this.platform,
      'Exhaust air',
      '_exhaustAirTemp',
      '3x00007'
    );
    new AirfiTemperatureSensorService(
      this.accessory,
      this.platform,
      'Supply air',
      '_supplyAirTemp',
      '3x00008'
    );
    new AirfiThermostatService(
      this.accessory,
      this.platform,
      'Supply air temperature'
    );

    if (this.platform.config.exposeFireplaceSwitch) {
      new AirfiSwitchService(
        this.accessory,
        this.platform,
        'Fireplace mode',
        '_fireplace',
        '4x00058'
      );
    } else {
      const fireplaceSwitch = this.accessory.getService('Fireplace mode');

      if (fireplaceSwitch) {
        this.accessory.removeService(fireplaceSwitch);
      }
    }

    if (this.platform.config.exposePowerCoolingSwitch) {
      new AirfiSwitchService(
        this.accessory,
        this.platform,
        'Power cooling',
        '_powerCooling',
        '4x00051'
      );
    } else {
      const powerCoolingSwitch = this.accessory.getService('Power cooling');

      if (powerCoolingSwitch) {
        this.accessory.removeService(powerCoolingSwitch);
      }
    }

    if (this.platform.config.exposeSaunaSwitch) {
      new AirfiSwitchService(
        this.accessory,
        this.platform,
        'Sauna mode',
        '_sauna',
        '4x00057'
      );
    } else {
      const saunaSwitch = this.accessory.getService('Sauna mode');

      if (saunaSwitch) {
        this.accessory.removeService(saunaSwitch);
      }
    }
  }
}
