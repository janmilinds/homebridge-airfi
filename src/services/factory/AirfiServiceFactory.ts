import { PlatformAccessory, Service } from 'homebridge';

import {
  AirfiInformationService,
  AirfiFanService,
  AirfiThermostatService,
  AirfiTemperatureSensorService,
  AirfiHumiditySensorService,
  AirfiSwitchService,
} from '../';
import type { AirfiAirHandlingUnitAccessory } from '../../accessory/AirfiAirHandlingUnitAccessory';
import type { AirfiHomebridgePlatform } from '../../AirfiHomebridgePlatform';
import { AirfiDevice } from '../../device';
import { AirfiDeviceContext } from '../../types';

interface ServiceCollection {
  information: Service;
  ventilation: Service;
  thermostat: Service;
  temperatureSensors: {
    supplyAir: Service;
    exhaustAir: Service;
    extractAir: Service;
    outdoorAir: Service;
  };
  humiditySensor: Service;
  switches?: {
    fireplaceFunction?: Service;
    boostedCooling?: Service;
    saunaFunction?: Service;
  };
}

/**
 * Factory class to create and configure HomeKit services for Airfi accessories.
 */
export class AirfiServiceFactory {
  private readonly device: AirfiDevice;

  private readonly platform: AirfiHomebridgePlatform;

  private readonly platformAccessory: PlatformAccessory<AirfiDeviceContext>;

  constructor(private readonly accessory: AirfiAirHandlingUnitAccessory) {
    this.device = accessory.getDevice();
    this.platform = accessory.getPlatform();
    this.platformAccessory = accessory.getAccessory();
  }

  /**
   * Create and configure all HomeKit services for the accessory.
   */
  public createAllServices(): ServiceCollection {
    // Clear existing services first
    this.clearExistingServices();

    const services: ServiceCollection = {
      information: this.createInformationService(),
      ventilation: this.createVentilationService(),
      thermostat: this.createThermostatService(),
      temperatureSensors: this.createTemperatureSensors(),
      humiditySensor: this.createHumiditySensor(),
      switches: this.createSwitchServices(),
    };

    // Set primary service and linked services.
    services.ventilation.setPrimaryService(true);
    AirfiServiceFactory.linkServices(services);

    return services;
  }

  /**
   * Remove all existing services except AccessoryInformation.
   */
  private clearExistingServices(): void {
    this.platformAccessory.services.forEach((service) => {
      if (service.UUID !== this.platform.Service.AccessoryInformation.UUID) {
        this.platformAccessory.removeService(service);
      }
    });
  }

  /**
   * Create the accessory information service.
   */
  private createInformationService(): Service {
    return new AirfiInformationService(this.accessory, {
      displayName: this.platformAccessory.displayName,
      name: '',
      updateFrequency: 60,
    }).getService();
  }

  /**
   * Create the main ventilation fan service.
   */
  private createVentilationService(): Service {
    return new AirfiFanService(this.accessory, {
      configuredNameKey: 'service.fan',
      name: 'Ventilation',
      updateFrequency: 1,
    }).getService();
  }

  /**
   * Create thermostat service.
   */
  private createThermostatService(): Service {
    return new AirfiThermostatService(this.accessory, {
      configuredNameKey: 'service.thermostat',
      name: 'SupplyAirTemperature',
      updateFrequency: 1,
    }).getService();
  }

  /**
   * Create temperature sensor services.
   */
  private createTemperatureSensors(): ServiceCollection['temperatureSensors'] {
    return {
      outdoorAir: new AirfiTemperatureSensorService(this.accessory, {
        configuredNameKey: 'service.temperatureSensor.outdoorAir',
        name: 'OutdoorAir',
        subtype: '_outdoorAirTemp',
        updateFrequency: 60,
        readAddress: '3x00004',
      }).getService(),

      extractAir: new AirfiTemperatureSensorService(this.accessory, {
        configuredNameKey: 'service.temperatureSensor.extractAir',
        name: 'ExtractAir',
        subtype: '_extractAirTemp',
        updateFrequency: 60,
        readAddress: '3x00006',
      }).getService(),

      exhaustAir: new AirfiTemperatureSensorService(this.accessory, {
        configuredNameKey: 'service.temperatureSensor.exhaustAir',
        name: 'ExhaustAir',
        subtype: '_exhaustAirTemp',
        updateFrequency: 60,
        readAddress: '3x00007',
      }).getService(),

      supplyAir: new AirfiTemperatureSensorService(this.accessory, {
        configuredNameKey: 'service.temperatureSensor.supplyAir',
        name: 'SupplyAir',
        subtype: '_supplyAirTemp',
        updateFrequency: 60,
        readAddress: '3x00008',
      }).getService(),
    };
  }

  /**
   * Create humidity sensor services.
   */
  private createHumiditySensor(): ServiceCollection['humiditySensor'] {
    return new AirfiHumiditySensorService(this.accessory, {
      configuredNameKey: 'service.humiditySensor',
      name: 'ExtractAirHumidity',
      updateFrequency: 60,
    }).getService();
  }

  /**
   * Create switch services based on device features.
   */
  private createSwitchServices(): ServiceCollection['switches'] {
    const switches: NonNullable<ServiceCollection['switches']> = {};

    // Get configuration
    const {
      exposeFireplaceFunctionSwitch,
      exposeBoostedCoolingSwitch,
      exposeSaunaFunctionSwitch,
    } = this.platform.config;

    // Fireplace function switch
    if (
      this.device.hasFeature('fireplaceFunction') &&
      exposeFireplaceFunctionSwitch
    ) {
      switches.fireplaceFunction = new AirfiSwitchService(this.accessory, {
        configuredNameKey: 'service.switch.fireplaceFunction',
        name: 'FireplaceFunction',
        subtype: '_fireplace',
        updateFrequency: 1,
        writeAddress: '4x00058',
      }).getService();
    }

    // Boosted cooling switch
    if (
      this.device.hasFeature('boostedCooling') &&
      exposeBoostedCoolingSwitch
    ) {
      switches.boostedCooling = new AirfiSwitchService(this.accessory, {
        configuredNameKey: 'service.switch.boostedCooling',
        name: 'BoostedCooling',
        subtype: '_boosted_cooling',
        updateFrequency: 1,
        writeAddress: '4x00051',
      }).getService();
    }

    // Sauna function switch
    if (this.device.hasFeature('saunaFunction') && exposeSaunaFunctionSwitch) {
      switches.saunaFunction = new AirfiSwitchService(this.accessory, {
        configuredNameKey: 'service.switch.saunaFunction',
        name: 'SaunaFunction',
        subtype: '_sauna',
        updateFrequency: 1,
        writeAddress: '4x00057',
      }).getService();
    }

    return Object.keys(switches).length > 0 ? switches : undefined;
  }

  /**
   * Link services together for better organization in HomeKit.
   */
  private static linkServices(services: ServiceCollection): void {
    const {
      ventilation,
      thermostat,
      temperatureSensors,
      humiditySensor,
      switches,
    } = services;

    // Link all services to main ventilation service
    if (thermostat) {
      ventilation.addLinkedService(thermostat);
    }

    // Link temperature sensors
    Object.values(temperatureSensors).forEach((sensor) => {
      ventilation.addLinkedService(sensor);
    });

    // Link humidity sensor
    if (humiditySensor) {
      ventilation.addLinkedService(humiditySensor);
    }

    // Link switches
    if (switches) {
      Object.values(switches).forEach((switchService) => {
        if (switchService) ventilation.addLinkedService(switchService);
      });
    }
  }
}
