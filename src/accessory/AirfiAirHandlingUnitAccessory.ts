import EventEmitter from 'events';
import { Logging, PlatformAccessory, Service } from 'homebridge';

import { AirfiHomebridgePlatform } from '../AirfiHomebridgePlatform';
import { AirfiDevice } from '../device';
import {
  AirfiFanService,
  AirfiHumiditySensorService,
  AirfiInformationService,
  AirfiSwitchService,
  AirfiTemperatureSensorService,
  AirfiThermostatService,
} from '../services';
import { AirfiDeviceContext } from '../types';

/**
 * Platform accessory for the Airfi air handling unit.
 */
export class AirfiAirHandlingUnitAccessory extends EventEmitter {
  private device: AirfiDevice;

  public readonly log: Logging;

  constructor(
    private readonly accessory: PlatformAccessory<AirfiDeviceContext>,
    private readonly platform: AirfiHomebridgePlatform
  ) {
    super();

    const {
      context: { config },
    } = accessory;
    this.log = platform.log;

    this.device = new AirfiDevice(
      config.host,
      config.port,
      this.log,
      this.accessory.displayName,
      this.platform.config.debug
    );

    this.device
      .initialize()
      .then(() => {
        this.initializeServices();
        this.emit('initialized');

        this.log.debug(
          'Finished initializing accessory:',
          this.accessory.displayName
        );
      })
      .catch((error: Error) => {
        this.log.error(
          `Error while initializing "${this.accessory.displayName}":`,
          error.message
        );
        this.emit('error');
      });

    this.device.on('restart-required', (seconds: number) => {
      this.device.restartSync(seconds);
    });
  }

  getAccessory(): PlatformAccessory<AirfiDeviceContext> {
    return this.accessory;
  }

  getPlatform(): AirfiHomebridgePlatform {
    return this.platform;
  }

  getDevice(): AirfiDevice {
    return this.device;
  }

  /**
   * Initialize the accessory services.
   */
  private initializeServices() {
    const services: Record<string, Service> = {};

    // Clear accessory services prior to any changes.
    this.accessory.services
      .filter((service) => service.constructor.name !== 'AccessoryInformation')
      .forEach((service) => {
        this.accessory.removeService(service);
      });

    // Set accessory information
    new AirfiInformationService(this, {
      displayName: this.accessory.displayName,
      name: '',
      updateFrequency: 60,
    });

    services.ventilation = new AirfiFanService(this, {
      configuredNameKey: 'service.fan',
      name: 'Ventilation',
      updateFrequency: 1,
    }).getService();
    services.ventilation.setPrimaryService(true);

    services.thermostat = new AirfiThermostatService(this, {
      configuredNameKey: 'service.thermostat',
      name: 'SupplyAirTemperature',
      updateFrequency: 1,
    }).getService();
    services.ventilation.addLinkedService(services.thermostat);

    services.humiditySensor = new AirfiHumiditySensorService(this, {
      configuredNameKey: 'service.humiditySensor',
      name: 'ExtractAirHumidity',
      updateFrequency: 60,
    }).getService();
    services.ventilation.addLinkedService(services.humiditySensor);

    services.temperatureOutdoorAir = new AirfiTemperatureSensorService(this, {
      configuredNameKey: 'service.temperatureSensor.outdoorAir',
      name: 'OutdoorAir',
      readAddress: '3x00004',
      subtype: '_outdoorAirTemp',
      updateFrequency: 60,
    }).getService();
    services.ventilation.addLinkedService(services.temperatureOutdoorAir);

    services.temperatureExtractAir = new AirfiTemperatureSensorService(this, {
      configuredNameKey: 'service.temperatureSensor.extractAir',
      name: 'ExtractAir',
      readAddress: '3x00006',
      subtype: '_extractAirTemp',
      updateFrequency: 60,
    }).getService();
    services.ventilation.addLinkedService(services.temperatureExtractAir);

    services.temperatureExhaustAir = new AirfiTemperatureSensorService(this, {
      configuredNameKey: 'service.temperatureSensor.exhaustAir',
      name: 'ExhaustAir',
      readAddress: '3x00007',
      subtype: '_exhaustAirTemp',
      updateFrequency: 60,
    }).getService();
    services.ventilation.addLinkedService(services.temperatureExhaustAir);

    services.temperatureSupplyAir = new AirfiTemperatureSensorService(this, {
      configuredNameKey: 'service.temperatureSensor.supplyAir',
      name: 'SupplyAir',
      readAddress: '3x00008',
      subtype: '_supplyAirTemp',
      updateFrequency: 60,
    }).getService();
    services.ventilation.addLinkedService(services.temperatureSupplyAir);

    const {
      exposeFireplaceFunctionSwitch,
      exposeBoostedCoolingSwitch,
      exposeSaunaFunctionSwitch,
    } = this.accessory.context.config;

    if (
      this.device.hasFeature('fireplaceFunction') &&
      exposeFireplaceFunctionSwitch
    ) {
      services.switchFireplaceFunction = new AirfiSwitchService(this, {
        configuredNameKey: 'service.switch.fireplaceFunction',
        name: 'FireplaceFunction',
        subtype: '_fireplace',
        updateFrequency: 1,
        writeAddress: '4x00058',
      }).getService();
      services.ventilation.addLinkedService(services.switchFireplaceFunction);
    }

    if (
      this.device.hasFeature('boostedCooling') &&
      exposeBoostedCoolingSwitch
    ) {
      services.switchBoostedCooling = new AirfiSwitchService(this, {
        configuredNameKey: 'service.switch.boostedCooling',
        name: 'BoostedCooling',
        subtype: '_boostedCooling',
        updateFrequency: 1,
        writeAddress: '4x00051',
      }).getService();
      services.ventilation.addLinkedService(services.switchBoostedCooling);
    }

    if (this.device.hasFeature('saunaFunction') && exposeSaunaFunctionSwitch) {
      services.switchSaunaFunction = new AirfiSwitchService(this, {
        configuredNameKey: 'service.switch.saunaFunction',
        name: 'SaunaFunction',
        subtype: '_sauna',
        updateFrequency: 1,
        writeAddress: '4x00057',
      }).getService();
      services.ventilation.addLinkedService(services.switchSaunaFunction);
    }
  }
}
