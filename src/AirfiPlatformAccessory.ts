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
    new AirfiInformationService(this.accessory, this.platform, {
      configuredNameKey: 'service.information',
      name: 'VentilationUnit',
      service: this.platform.Service.AccessoryInformation,
      updateFrequency: 60,
    });

    // Setup accessory services
    this.services.push(
      new AirfiFanService(this.accessory, this.platform, {
        configuredNameKey: 'service.fan',
        name: 'Ventilation',
        updateFrequency: 1,
      }).getService()
    );
    this.services.push(
      new AirfiHumiditySensorService(this.accessory, this.platform, {
        configuredNameKey: 'service.humiditySensor',
        name: 'ExtractAirHumidity',
        updateFrequency: 60,
      }).getService()
    );
    this.services.push(
      new AirfiTemperatureSensorService(this.accessory, this.platform, {
        configuredNameKey: 'service.temperatureSensor.outdoorAir',
        name: 'OutdoorAir',
        readAddress: '3x00004',
        subtype: '_outdoorAirTemp',
        updateFrequency: 60,
      }).getService()
    );
    this.services.push(
      new AirfiTemperatureSensorService(this.accessory, this.platform, {
        configuredNameKey: 'service.temperatureSensor.extractAir',
        name: 'ExtractAir',
        readAddress: '3x00006',
        subtype: '_extractAirTemp',
        updateFrequency: 60,
      }).getService()
    );
    this.services.push(
      new AirfiTemperatureSensorService(this.accessory, this.platform, {
        configuredNameKey: 'service.temperatureSensor.exhaustAir',
        name: 'ExhaustAir',
        readAddress: '3x00007',
        subtype: '_exhaustAirTemp',
        updateFrequency: 60,
      }).getService()
    );
    this.services.push(
      new AirfiTemperatureSensorService(this.accessory, this.platform, {
        configuredNameKey: 'service.temperatureSensor.supplyAir',
        name: 'SupplyAir',
        readAddress: '3x00008',
        subtype: '_supplyAirTemp',
        updateFrequency: 60,
      }).getService()
    );
    this.services.push(
      new AirfiThermostatService(this.accessory, this.platform, {
        configuredNameKey: 'service.thermostat',
        name: 'SupplyAirTemperature',
        updateFrequency: 1,
      }).getService()
    );

    if (this.platform.config.exposeFireplaceSwitch) {
      this.services.push(
        new AirfiSwitchService(this.accessory, this.platform, {
          configuredNameKey: 'service.switch.fireplaceFunction',
          name: 'FireplaceFunction',
          subtype: '_fireplace',
          updateFrequency: 1,
          writeAddress: '4x00058',
        }).getService()
      );
    }

    if (this.platform.config.exposeBoostedCoolingSwitch) {
      this.services.push(
        new AirfiSwitchService(this.accessory, this.platform, {
          configuredNameKey: 'service.switch.boostedCooling',
          name: 'BoostedCooling',
          subtype: '_boostedCooling',
          updateFrequency: 1,
          writeAddress: '4x00051',
        }).getService()
      );
    }

    if (this.platform.config.exposeSaunaSwitch) {
      this.services.push(
        new AirfiSwitchService(this.accessory, this.platform, {
          configuredNameKey: 'service.switch.saunaFunction',
          name: 'SaunaFunction',
          subtype: '_sauna',
          updateFrequency: 1,
          writeAddress: '4x00057',
        }).getService()
      );
    }

    const accessoryServices = this.accessory.services
      .filter((service) => service.displayName !== '')
      .map((service) => service.displayName);
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
