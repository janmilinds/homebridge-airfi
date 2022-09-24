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
  AirfiTemperatureSensorService,
  AirfiThermostatService,
} from './services';
import { RegisterType, WriteQueue } from './types';

/**
 * Airfi Ventilation unit – accessory that defines services available through
 * this plugin.
 */
export default class AirfiVentilationUnitAccessory implements AccessoryPlugin {
  private readonly airfiController: AirfiModbusController;

  public readonly Characteristic: typeof Characteristic;

  public readonly config: AccessoryConfig;

  private holdingRegister: number[] = [];

  private inputRegister: number[] = [];

  private isNetworking = false;

  public readonly log: Logger;

  private readonly name: string;

  public readonly Service: typeof Service;

  private services: AirfiService[] = [];

  private writeQueue: WriteQueue = {};

  constructor(log: Logger, config: AccessoryConfig, api: API) {
    this.config = config;
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
    const informationService = new AirfiInformationService(this);
    this.services.push(informationService);

    // Add fan service
    const fanService = new AirfiFanService(this, 'Ventilation', 1);
    this.services.push(fanService);

    // Humidity sensor service.
    const humiditySensorService = new AirfiHumiditySensorService(
      this,
      'Extract air humidity',
      30
    );
    this.services.push(humiditySensorService);

    // Temperature sensors
    const outdoorAirTemperatureSensorService =
      new AirfiTemperatureSensorService(this, 'Outdoor air', '_outdoorAir', 4);
    const extractAirTemperatureSensorService =
      new AirfiTemperatureSensorService(this, 'Extract air', '_extractAir', 6);
    const exhaustAirTemperatureSensorService =
      new AirfiTemperatureSensorService(this, 'Exhaust air', '_exhaustAir', 7);
    const supplyAirTemperatureSensorService = new AirfiTemperatureSensorService(
      this,
      'Supply air',
      '_supplyAir',
      8
    );
    this.services.push(
      outdoorAirTemperatureSensorService,
      extractAirTemperatureSensorService,
      exhaustAirTemperatureSensorService,
      supplyAirTemperatureSensorService
    );

    const thermostatService = new AirfiThermostatService(
      this,
      'Supply air temperature',
      15
    );
    this.services.push(thermostatService);

    // Initial fetch.
    this.run();

    // Run periodic operations into modbus.
    setTimeout(() => setInterval(() => this.run(), 1000), 2000);

    this.log.info(`${this.name} initialized.`);
  }

  /**
   * Return value from modbus holding register.
   *
   * @param address
   *   Register address to get value.
   */
  public getHoldingRegisterValue(address: number): number {
    // Shift address to 0-based array index.
    const value = this.holdingRegister[address - 1];

    return value ? value : 0;
  }

  /**
   * Return value from modbus input register.
   *
   * @param address
   *   Register address to get value.
   */
  public getInputRegisterValue(address: number): number {
    // Shift address to 0-based array index.
    const value = this.inputRegister[address - 1];

    return value ? value : 0;
  }

  /**
   * Queue value to be written into holding register.
   *
   * @param writeAddress
   *   Register address to write.
   * @param value
   *   Value to be written.
   * @param readAddress
   *   Register read address to update immediately into the object state.
   * @param readRegisterType
   *   Which register to read: 3 = input register, 4 = holding register.
   */
  public queueInsert(
    address: number,
    value: number,
    readAddress = 0,
    readRegisterType: RegisterType = 3
  ) {
    if (readAddress > 0) {
      if (readRegisterType === 3) {
        this.inputRegister[readAddress - 1] = value;
      } else if (readRegisterType === 4) {
        this.holdingRegister[readAddress - 1] = value;
      }
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
        .read(1, 40, 3)
        .then((values) => {
          this.inputRegister = values;
        })
        .catch((error) => this.log.error(error as string));
      await this.airfiController
        .read(1, 51, 4)
        .then((values) => {
          this.holdingRegister = values;
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
