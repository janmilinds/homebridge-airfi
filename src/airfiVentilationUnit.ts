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
import { sleep } from './utils';

/**
 * Airfi Ventilation unit – accessory that defines services available through
 * this plugin.
 */
export default class AirfiVentilationUnitAccessory implements AccessoryPlugin {
  private static readonly HOLDING_REGISTER_LENGTH = 51;

  private static readonly INPUT_REGISTER_LENGTH = 40;

  private static readonly INTERVAL_FREQUENCY = 1000;

  private static readonly READ_FREQUENCY = 3;

  private readonly airfiController: AirfiModbusController;

  readonly Characteristic: typeof Characteristic;

  readonly config: AccessoryConfig;

  private holdingRegister: number[] = [];

  private inputRegister: number[] = [];

  private intervalId: NodeJS.Timer;

  private isNetworking = false;

  readonly log: Logger;

  private readonly name: string;

  readonly Service: typeof Service;

  private queue: WriteQueue = {};

  private services: AirfiService[] = [];

  private sequenceCount = 0;

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
    this.intervalId = setInterval(
      () => this.run(),
      AirfiVentilationUnitAccessory.INTERVAL_FREQUENCY
    );

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
    this.queue[address] = value;
  }

  /**
   * Pause interval execution and restart it after waiting time.
   *
   * @param seconds
   *   Number of seconds to wait before restarting
   */
  private async restart(seconds: number) {
    clearInterval(this.intervalId);

    this.sequenceCount = 0;
    this.log.warn(`Restarting modbus read/write in ${seconds} seconds...`);

    await sleep(seconds);
    this.intervalId = setInterval(
      () => this.run(),
      AirfiVentilationUnitAccessory.INTERVAL_FREQUENCY
    );
    this.log.info('Modbus read/write operations restarted');
  }

  /**
   * Run read & write operations for modbus registers.
   */
  private async run() {
    const queueLength = Object.keys(this.queue).length;

    this.sequenceCount++;
    if (this.sequenceCount > AirfiVentilationUnitAccessory.READ_FREQUENCY) {
      this.sequenceCount = 1;
    }

    // Return if it's not a read sequence and there's nothing to write.
    if (this.sequenceCount > 1 && queueLength === 0) {
      return;
    }

    if (this.isNetworking) {
      this.log.warn(`${this.name} is busy completing previous operations`);
      this.restart(10);
      return;
    }

    await this.airfiController
      .open()
      .then(async () => {
        this.isNetworking = true;

        // Write holding register.
        if (queueLength > 0) {
          await this.writeQueue();
        }

        if (this.sequenceCount === 1) {
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
        }
      })
      .catch((error) => {
        this.log.error(error as string);
      })
      .finally(() => {
        this.airfiController.close();
        this.isNetworking = false;
      });
  }

  /**
   * Write values from queue to the ventilation unit.
   */
  private async writeQueue(): Promise<void> {
    this.log.debug('Writing values to modbus');

    for (const queueItem of Object.entries(this.queue)) {
      const [address, value] = queueItem;
      await this.airfiController
        .write(parseInt(address), value)
        .catch((error) => this.log.error(error as string))
        .finally(() => {
          delete this.queue[address];
        });
    }

    return Promise.resolve();
  }
}
