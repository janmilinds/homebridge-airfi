import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  Characteristic,
  Logger,
  Service,
} from 'homebridge';

import { AirfiModbusController } from './controller';
import { AirfiFanService, AirfiService } from './services';

/**
 * Airfi Ventilation unit – accessory that defines services available through
 * this plugin.
 */
export default class AirfiVentilationUnitAccessory implements AccessoryPlugin {
  private readonly airfiController: AirfiModbusController;

  public readonly Characteristic: typeof Characteristic;

  private isNetworking = false;

  public readonly log: Logger;

  private readonly name: string;

  public readonly Service: typeof Service;

  private services: AirfiService[] = [];

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

    const fanService = new AirfiFanService(
      this,
      this.airfiController,
      'Ventilation'
    );
    this.services.push(fanService);

    setTimeout(() => setInterval(() => this.run(), 1000), 5000);

    this.log.info(`${this.name} initialized.`);
  }

  /**
   * Run write & read operations for each service.
   */
  private async run() {
    try {
      if (this.isNetworking) {
        this.log.info(`${this.name} is busy completing previous operations.`);
        return;
      }

      this.isNetworking = true;

      await this.airfiController.open();

      for (const service of this.services) {
        await service.runQueue();
        await service.runUpdates();
      }
    } catch (error) {
      this.log.error(`Controller Error: ${error}`);
    } finally {
      this.airfiController.close();
      this.isNetworking = false;
    }
  }

  getServices(): Service[] {
    return this.services.map((service) => service.getService());
  }
}
