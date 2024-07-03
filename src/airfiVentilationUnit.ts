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
  AirfiSwitchService,
  AirfiTemperatureSensorService,
  AirfiThermostatService,
} from './services';
import { RegisterAddress, WriteQueue } from './types';
import { sleep } from './utils';

/**
 * Airfi Ventilation unit – accessory that defines services available through
 * this plugin.
 */
export default class AirfiVentilationUnitAccessory implements AccessoryPlugin {
  private static readonly HOLDING_REGISTER_LENGTH = 58;

  private static readonly INPUT_REGISTER_LENGTH = 40;

  private static readonly INTERVAL_FREQUENCY = 1000;

  private static readonly READ_FREQUENCY = 3;

  private readonly airfiController: AirfiModbusController;

  readonly Characteristic: typeof Characteristic;

  readonly config: AccessoryConfig;

  private holdingRegister: number[] = [];

  private inputRegister: number[] = [];

  private intervalId: NodeJS.Timeout;

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
      new AirfiTemperatureSensorService(
        this,
        'Outdoor air',
        '_outdoorAir',
        '3x00004'
      );
    const extractAirTemperatureSensorService =
      new AirfiTemperatureSensorService(
        this,
        'Extract air',
        '_extractAir',
        '3x00006'
      );
    const exhaustAirTemperatureSensorService =
      new AirfiTemperatureSensorService(
        this,
        'Exhaust air',
        '_exhaustAir',
        '3x00007'
      );
    const supplyAirTemperatureSensorService = new AirfiTemperatureSensorService(
      this,
      'Supply air',
      '_supplyAir',
      '3x00008'
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
      5
    );
    this.services.push(thermostatService);

    if (this.config.exposeFireplaceSwitch) {
      const fireplaceSwitchService = new AirfiSwitchService(
        this,
        'Fireplace mode',
        '_fireplace',
        '4x00058'
      );
      this.services.push(fireplaceSwitchService);
    }

    if (this.config.exposePowerCoolingSwitch) {
      const powerCoolingSwitchService = new AirfiSwitchService(
        this,
        'Power cooling',
        '_powerCooling',
        '4x00051'
      );
      this.services.push(powerCoolingSwitchService);
    }

    if (this.config.exposeSaunaSwitch) {
      const saunaSwitchService = new AirfiSwitchService(
        this,
        'Sauna mode',
        '_sauna',
        '4x00057'
      );
      this.services.push(saunaSwitchService);
    }

    // Run periodic operations into modbus.
    this.intervalId = setInterval(
      () => this.run(),
      AirfiVentilationUnitAccessory.INTERVAL_FREQUENCY
    );

    this.log.info(`${this.name} initialized.`);
  }

  /**
   * Converts string representation of register address into register type and
   * address.
   *
   * @param registerAddress
   */
  private getRegisterAddress(registerAddress: RegisterAddress): number[] {
    if (!/^[3|4]x[\d]{5}$/.test(registerAddress)) {
      this.log.error(
        `Invalid register address format for "${registerAddress}"`
      );
      return [0, 0];
    }
    return registerAddress.split('x').map((value) => parseInt(value));
  }

  getServices(): Service[] {
    return this.services.map((service) => service.getService());
  }

  /**
   * Return value from a register.
   *
   * @param registerAddress
   *   String representation of register address including register type and
   *   address
   */
  getRegisterValue(registerAddress: RegisterAddress): number {
    const [register, address] = this.getRegisterAddress(registerAddress);

    if (register === 3) {
      return this.inputRegister[address - 1];
    }

    if (register === 4) {
      return this.holdingRegister[address - 1];
    }

    return -1;
  }

  /**
   * Queue value to be written into holding register.
   *
   * @param registerAddress
   *   Register address to write.
   * @param value
   *   Value to be written.
   */
  queueInsert(registerAddress: RegisterAddress, value: number) {
    const [register, address] = this.getRegisterAddress(registerAddress);

    if (register === 4) {
      this.holdingRegister[address - 1] = value;
      this.queue[address] = value;
    } else {
      this.log.error(
        `Wrong write register type "${register}"` +
          ' – only holding register is writable'
      );
    }
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

    this.isNetworking = true;

    await this.airfiController
      .open()
      .then(async () => {
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
