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
  private static readonly HOLDING_REGISTER_LENGTH = 51;

  private static readonly INPUT_REGISTER_LENGTH = 40;

  private readonly airfiController: AirfiModbusController;

  readonly Characteristic: typeof Characteristic;

  readonly config: AccessoryConfig;

  private holdingRegister: number[] = [];

  private inputRegister: number[] = [];

  private isNetworking = false;

  readonly log: Logger;

  private readonly name: string;

  readonly Service: typeof Service;

  private queue: WriteQueue = {};

  private services: AirfiService[] = [];

  constructor(log: Logger, config: AccessoryConfig, api: API) {
    if (!(config.host && config.port)) {
      throw new Error('No host and port configured.');
    }

    this.Characteristic = api.hap.Characteristic;
    this.config = config;
    this.log = log;
    this.name = config.name;
    this.Service = api.hap.Service;
    this.airfiController = new AirfiModbusController(
      config.host,
      config.port,
      this.log
    );

    // Initial modbus register read.
    this.run();

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
  getHoldingRegisterValue(address: number): number {
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
  getInputRegisterValue(address: number): number {
    // Shift address to 0-based array index.
    const value = this.inputRegister[address - 1];

    return value ? value : 0;
  }

  getServices(): Service[] {
    return this.services.map((service) => service.getService());
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
  queueInsert(
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
   * Run read & write operations for modbus registers.
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

      // Write holding register.
      if (Object.keys(this.queue).length > 0) {
        await this.writeQueue();
      }

      // Read and save holding register.
      await this.airfiController
        .read(1, AirfiVentilationUnitAccessory.HOLDING_REGISTER_LENGTH, 4)
        .then((values) => {
          this.holdingRegister = values;
        })
        .catch((error) => this.log.error(error as string));

      // Read and save input register.
      await this.airfiController
        .read(1, AirfiVentilationUnitAccessory.INPUT_REGISTER_LENGTH, 3)
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

  /**
   * Write values from queue to the ventilation unit.
   */
  private writeQueue(): Promise<void> {
    return new Promise<void>((resolve) => {
      Object.entries(this.queue).map(([address, value]) => {
        this.airfiController
          .write(parseInt(address), value)
          .then()
          .catch((error) => this.log.error(error as string))
          .finally(() => {
            delete this.queue[address];
          });
      });

      resolve();
    });
  }
}
