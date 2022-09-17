import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  Characteristic,
  Logger,
  Service,
} from 'homebridge';
import { AirfiFanService } from './services';

/**
 * AirfiVentilationUnitAccessory
 */
export default class AirfiVentilationUnitAccessory implements AccessoryPlugin {
  public readonly Characteristic: typeof Characteristic;

  public readonly log: Logger;

  private readonly name: string;

  public readonly Service: typeof Service;

  private services: Service[] = [];

  constructor(log: Logger, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;
    this.Characteristic = api.hap.Characteristic;
    this.Service = api.hap.Service;

    const informationService = new this.Service.AccessoryInformation();
    informationService.setCharacteristic(
      this.Characteristic.Manufacturer,
      'Airfi'
    );

    this.services.push(informationService);

    const fanService = new AirfiFanService(this);
    this.services.push(fanService.getService());

    log.info(`${this.name} initialized.`);
  }

  getServices(): Service[] {
    return this.services;
  }
}
