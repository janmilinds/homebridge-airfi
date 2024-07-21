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
import { AirfiDeviceContext } from './types';

/**
 * Platform accessory for the Airfi ventilation unit.
 */
export class AirfiPlatformAccessory {
  private readonly services: { [key: string]: Service } = {};

  constructor(
    private readonly platform: AirfiHomebridgePlatform,
    private readonly accessory: PlatformAccessory<AirfiDeviceContext>
  ) {
    // Clear accessory services prior to any changes.
    this.accessory.services
      .filter((service) => service.constructor.name !== 'AccessoryInformation')
      .forEach((service) => {
        this.accessory.removeService(service);
      });

    // Set accessory information
    new AirfiInformationService(this.accessory, this.platform, {
      configuredNameKey: 'service.information',
      name: '',
      updateFrequency: 60,
    });

    // Setup accessory services
    this.services.ventilation = new AirfiFanService(
      this.accessory,
      this.platform,
      {
        configuredNameKey: 'service.fan',
        name: 'Ventilation',
        updateFrequency: 1,
      }
    ).getService();

    this.services.ventilation.setPrimaryService(true);

    this.services.thermostat = new AirfiThermostatService(
      this.accessory,
      this.platform,
      {
        configuredNameKey: 'service.thermostat',
        name: 'SupplyAirTemperature',
        updateFrequency: 1,
      }
    ).getService();
    this.services.ventilation.addLinkedService(this.services.thermostat);

    this.services.humiditySensor = new AirfiHumiditySensorService(
      this.accessory,
      this.platform,
      {
        configuredNameKey: 'service.humiditySensor',
        name: 'ExtractAirHumidity',
        updateFrequency: 60,
      }
    ).getService();
    this.services.ventilation.addLinkedService(this.services.humiditySensor);

    this.services.outdoorAirTemp = new AirfiTemperatureSensorService(
      this.accessory,
      this.platform,
      {
        configuredNameKey: 'service.temperatureSensor.outdoorAir',
        name: 'OutdoorAir',
        readAddress: '3x00004',
        subtype: '_outdoorAirTemp',
        updateFrequency: 60,
      }
    ).getService();
    this.services.ventilation.addLinkedService(this.services.outdoorAirTemp);

    this.services.extractAirTemp = new AirfiTemperatureSensorService(
      this.accessory,
      this.platform,
      {
        configuredNameKey: 'service.temperatureSensor.extractAir',
        name: 'ExtractAir',
        readAddress: '3x00006',
        subtype: '_extractAirTemp',
        updateFrequency: 60,
      }
    ).getService();
    this.services.ventilation.addLinkedService(this.services.extractAirTemp);

    this.services.exhaustAirTemp = new AirfiTemperatureSensorService(
      this.accessory,
      this.platform,
      {
        configuredNameKey: 'service.temperatureSensor.exhaustAir',
        name: 'ExhaustAir',
        readAddress: '3x00007',
        subtype: '_exhaustAirTemp',
        updateFrequency: 60,
      }
    ).getService();
    this.services.ventilation.addLinkedService(this.services.exhaustAirTemp);

    this.services.supplyAirTemp = new AirfiTemperatureSensorService(
      this.accessory,
      this.platform,
      {
        configuredNameKey: 'service.temperatureSensor.supplyAir',
        name: 'SupplyAir',
        readAddress: '3x00008',
        subtype: '_supplyAirTemp',
        updateFrequency: 60,
      }
    ).getService();
    this.services.ventilation.addLinkedService(this.services.supplyAirTemp);

    if (this.platform.config.exposeFireplaceFunctionSwitch) {
      this.services.fireplaceFunction = new AirfiSwitchService(
        this.accessory,
        this.platform,
        {
          configuredNameKey: 'service.switch.fireplaceFunction',
          name: 'FireplaceFunction',
          subtype: '_fireplace',
          updateFrequency: 1,
          writeAddress: '4x00058',
        }
      ).getService();
      this.services.ventilation.addLinkedService(
        this.services.fireplaceFunction
      );
    }

    if (this.platform.config.exposeBoostedCoolingSwitch) {
      this.services.boostedCooling = new AirfiSwitchService(
        this.accessory,
        this.platform,
        {
          configuredNameKey: 'service.switch.boostedCooling',
          name: 'BoostedCooling',
          subtype: '_boostedCooling',
          updateFrequency: 1,
          writeAddress: '4x00051',
        }
      ).getService();
      this.services.ventilation.addLinkedService(this.services.boostedCooling);
    }

    if (this.platform.config.exposeSaunaFunctionSwitch) {
      this.services.saunaFunction = new AirfiSwitchService(
        this.accessory,
        this.platform,
        {
          configuredNameKey: 'service.switch.saunaFunction',
          name: 'SaunaFunction',
          subtype: '_sauna',
          updateFrequency: 1,
          writeAddress: '4x00057',
        }
      ).getService();
      this.services.ventilation.addLinkedService(this.services.saunaFunction);
    }

    this.platform.api.updatePlatformAccessories([this.accessory]);
  }
}
