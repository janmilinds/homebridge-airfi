import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  Characteristic,
  Logger,
  Service,
} from 'homebridge';

import { AirfiModbusController } from './controller';
import {
  AirfiFanService,
  AirfiHumiditySensorService,
  AirfiInformationService,
  AirfiService,
} from './services';
import { WriteQueue } from './types';

/**
 * Airfi Ventilation unit – accessory that defines services available through
 * this plugin.
 */
export default class AirfiVentilationUnitAccessory implements AccessoryPlugin {
  private readonly airfiController: AirfiModbusController;

  public readonly Characteristic: typeof Characteristic;

  private inputRegister: number[] = [];

  private isNetworking = false;

  public readonly log: Logger;

  private readonly name: string;

  public readonly Service: typeof Service;

  private services: AirfiService[] = [];

  private writeQueue: WriteQueue = {};

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

    // Add information service.
    const informationService = new AirfiInformationService(this, config);
    this.services.push(informationService);

    // Add fan service
    const fanService = new AirfiFanService(this, 'Ventilation', 1);
    this.services.push(fanService);

    // Humidity sensor service.
    const humiditySensorService = new AirfiHumiditySensorService(
      this,
      'Humidity sensor',
      30
    );
    this.services.push(humiditySensorService);

    // Initial fetch.
    this.run();

    // Run periodic operations into modbus.
    setTimeout(() => setInterval(() => this.run(), 5000), 2000);

    this.log.info(`${this.name} initialized.`);
  }

  /**
   * Return value from modbus register.
   *
   * @param address
   *   Register address to get value.
   */
  public getInputRegisterValue(address): number {
    // Shift address to 0-based array index.
    const value = this.inputRegister[address - 1];

    return value ? value : 0;
  }

  /**
   * Queue value to be writte into holding register.
   *
   * @param writeAddress
   *   Register address to write.
   * @param value
   *   Value to be written.
   * @param readAddress
   *   Register read address to update immediately into the object state.
   */
  public queueInsert(address, value, readAddress = 0) {
    if (readAddress > 0) {
      this.inputRegister[readAddress - 1] = value;
    }
    this.writeQueue[address] = value;
  }

  /**
   * Write values from queue to the ventilation unit.
   */
  private runQueue(): Promise<void> {
    return new Promise<void>((resolve) => {
      Object.entries(this.writeQueue).map(([address, value]) => {
        this.airfiController
          .write(parseInt(address), value)
          .then()
          .catch((error) => this.log.error(error as string))
          .finally(() => {
            delete this.writeQueue[address];
          });
      });

      resolve();
    });
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

      await this.airfiController
        .open()
        .catch((error) => this.log.error(error as string));
      await this.runQueue();
      await this.airfiController
        .read(1, 40)
        .then((values) => {
          this.inputRegister = values;
        })
        .catch((error) => this.log.error(error as string));
    } catch (error) {
      this.log.error(error as string);
    } finally {
      this.airfiController.close();
      this.isNetworking = false;
    }
  }

  getServices(): Service[] {
    return this.services.map((service) => service.getService());
  }
}
