import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  Characteristic,
  Logger,
  Service,
} from 'homebridge';

import { AirfiModbusController } from './controller';
import { AirfiFanService } from './services';

/**
 * AirfiVentilationUnitAccessory
 */
export default class AirfiVentilationUnitAccessory implements AccessoryPlugin {
  private readonly airfiController: AirfiModbusController;

  public readonly Characteristic: typeof Characteristic;

  public readonly log: Logger;

  private readonly name: string;

  public readonly Service: typeof Service;

  private services: Service[] = [];

  constructor(log: Logger, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;

    if (!(config.host && config.port)) {
      throw new Error('No host and port configured.');
    }

    this.airfiController = new AirfiModbusController(
      config.host,
      config.port,
      this.log
    );

    this.Characteristic = api.hap.Characteristic;
    this.Service = api.hap.Service;

    const informationService = new this.Service.AccessoryInformation();
    informationService.setCharacteristic(
      this.Characteristic.Manufacturer,
      'Airfi'
    );

    this.services.push(informationService);

    const fanService = new AirfiFanService(this, this.airfiController);
    this.services.push(fanService.getService());

    setTimeout(() => setInterval(() => this.fetch(), 1000), 5000);

    log.info(`${this.name} initialized.`);
  }

  private async fetch() {
    try {
      await this.airfiController.open();
      const outdoorTemp = await this.airfiController.read(4);
      this.log.info('Outdoor temperature is', outdoorTemp);
    } catch (error) {
      this.log.error(`Error fetching values: ${error}`);
    } finally {
      this.airfiController.close();
    }
  }

  getServices(): Service[] {
    return this.services;
  }
}
