import { PlatformAccessory, Service } from 'homebridge';

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
 * Platform accessory for the Airfi ventilation unit.
 */
export class AirfiPlatformAccessory {
  private readonly services: Service[] = [];

  constructor(
    private readonly platform: AirfiHomebridgePlatform,
    private readonly accessory: PlatformAccessory
  ) {
    // Set accessory information
    this.services.push(
      new AirfiInformationService(
        this.accessory,
        this.platform,
        'Ventilation unit'
      ).getService()
    );

    // Setup accessory services
    this.services.push(
      new AirfiFanService(
        this.accessory,
        this.platform,
        'Ventilation'
      ).getService()
    );
    this.services.push(
      new AirfiHumiditySensorService(
        this.accessory,
        this.platform,
        'Extract air humidity'
      ).getService()
    );
    this.services.push(
      new AirfiTemperatureSensorService(
        this.accessory,
        this.platform,
        'Outdoor air',
        '_outdoorAirTemp',
        '3x00004'
      ).getService()
    );
    this.services.push(
      new AirfiTemperatureSensorService(
        this.accessory,
        this.platform,
        'Extract air',
        '_extractAirTemp',
        '3x00006'
      ).getService()
    );
    this.services.push(
      new AirfiTemperatureSensorService(
        this.accessory,
        this.platform,
        'Exhaust air',
        '_exhaustAirTemp',
        '3x00007'
      ).getService()
    );
    this.services.push(
      new AirfiTemperatureSensorService(
        this.accessory,
        this.platform,
        'Supply air',
        '_supplyAirTemp',
        '3x00008'
      ).getService()
    );
    this.services.push(
      new AirfiThermostatService(
        this.accessory,
        this.platform,
        'Supply air temperature'
      ).getService()
    );

    if (this.platform.config.exposeFireplaceSwitch) {
      this.services.push(
        new AirfiSwitchService(
          this.accessory,
          this.platform,
          'Fireplace mode',
          '_fireplace',
          '4x00058'
        ).getService()
      );
    }

    if (this.platform.config.exposePowerCoolingSwitch) {
      this.services.push(
        new AirfiSwitchService(
          this.accessory,
          this.platform,
          'Power cooling',
          '_powerCooling',
          '4x00051'
        ).getService()
      );
    }

    if (this.platform.config.exposeSaunaSwitch) {
      this.services.push(
        new AirfiSwitchService(
          this.accessory,
          this.platform,
          'Sauna mode',
          '_sauna',
          '4x00057'
        ).getService()
      );
    }

    const accessoryServices = this.accessory.services.map(
      (service) => service.displayName
    );
    const enabledServices = this.services.map((service) => service.displayName);
    const removableServices = accessoryServices.filter(
      (service) => !enabledServices.includes(service)
    );

    this.platform.log.debug('Accessory services:', accessoryServices);
    this.platform.log.debug('Enabled services:', enabledServices);
    this.platform.log.debug('Removable services:', removableServices);

    // Remove any non-existing services
    removableServices.forEach((service) => {
      this.platform.log.info('Removing non-existing service:', service);
      this.accessory.removeService(
        this.accessory.services.find(
          (accessoryService) => accessoryService.displayName === service
        ) as Service
      );
    });
  }
}
