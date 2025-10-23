import EventEmitter from 'events';
import { Logging } from 'homebridge';

import { RegisterType } from '../constants';
import { AirfiModbusController } from '../controller';
import {
  DebugOptions,
  RegisterAddress,
  WriteQueue,
  FeatureFlags,
} from '../types';
import { sleep } from '../utils';
import { AirfiFeatureManager } from './AirfiFeatureManager';

export class AirfiDevice extends EventEmitter {
  private static readonly INTERVAL_FREQUENCY = 1000;

  private static readonly READ_FREQUENCY = 3;

  private readonly controller: AirfiModbusController;

  private readonly featureManager: AirfiFeatureManager;

  private holdingRegister: number[] = [];

  private holdingRegisterLength = 12;

  private inputRegister: number[] = [];

  private inputRegisterLength = 31;

  private intervalId: NodeJS.Timeout | undefined;

  private isNetworking = false;

  private queue: WriteQueue = new Map();

  private sequenceCount = 0;

  constructor(
    host: string,
    port: number,
    private readonly log: Logging,
    private readonly displayName: string,
    debugOptions?: DebugOptions
  ) {
    super();
    this.controller = new AirfiModbusController(host, port, log, debugOptions);
    this.featureManager = new AirfiFeatureManager(log);
  }

  /**
   * Tests connection to the air handling unit and reads version information.
   */
  private async deviceLookup(): Promise<number[]> {
    const inputRegister: number[] = [];
    this.isNetworking = true;

    await this.controller
      .open()
      .then(() => this.controller.read(1, 3, RegisterType.Input))
      .then((values) => {
        inputRegister.push(...values);
      })
      .finally(() => {
        this.controller.close();
        this.isNetworking = false;
      });

    return inputRegister;
  }

  /**
   * Perform a data sync operation with the air handling unit.
   */
  async deviceSync() {
    if (!this.shouldExecute()) return;

    if (this.isNetworking) {
      this.log.warn(
        `${this.displayName} is busy completing previous operations`
      );
      this.emit('restart-required', 10);
      return;
    }

    this.isNetworking = true;

    await this.controller
      .open()
      .then(() => this.performReadWriteOperations())
      .finally(() => {
        this.controller.close();
        this.isNetworking = false;
      });
  }

  /**
   * Perform read and write operations to the air handling unit.
   */
  private async performReadWriteOperations(): Promise<void> {
    // Write operations first
    if (this.queue.size > 0) {
      await this.writeQueue();
    }

    // Read operations only on sequence 1
    if (this.sequenceCount === 1) {
      await this.readRegisters();
    }
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

  /**
   * Return value from a register.
   *
   * @param registerAddress
   *   String representation of register address including register type and
   *   address
   */
  getRegisterValue(registerAddress: RegisterAddress): number {
    const [register, address] = this.getRegisterAddress(registerAddress);

    if (register === RegisterType.Input) {
      return this.inputRegister[address - 1];
    }

    if (register === RegisterType.Holding) {
      return this.holdingRegister[address - 1];
    }

    return -1;
  }

  /**
   * Check whether the feature is supported by the air handling unit.
   *
   * @param key
   *   Feature key to check.
   *
   * @returns Whether the feature is enabled.
   */
  public hasFeature(key: keyof FeatureFlags): boolean {
    return this.featureManager.hasFeature(key);
  }

  /**
   * Initialize the accessory with device data and services.
   */
  async initialize() {
    await this.deviceLookup()
      .then((lookupValues) => {
        this.featureManager.initialize(this.displayName, lookupValues);
        this.log.debug('Feature flags initialized');
        [this.inputRegisterLength, this.holdingRegisterLength] =
          this.featureManager.getRegisterLengths();

        // Retrieve initial data from the air handling unit.
        return this.deviceSync();
      })
      .then(() => {
        // Start periodic sync operations.
        this.startPeriodicSync();
      });
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

    if (register === RegisterType.Holding) {
      this.holdingRegister[address - 1] = value;
      this.queue.set(address, value);
    } else {
      this.log.error(
        `Wrong write register type "${register}". ` +
          'Only holding register is writable'
      );
    }
  }

  /**
   * Reads both holding and input registers from the air handling unit.
   */
  private async readRegisters(): Promise<void> {
    // Read holding register
    await this.controller
      .read(1, this.holdingRegisterLength, RegisterType.Holding)
      .then((values) => {
        this.holdingRegister = values;
      });

    // Read input register
    await this.controller
      .read(1, this.inputRegisterLength, RegisterType.Input)
      .then((values) => {
        this.inputRegister = values;
      });
  }

  /**
   * Pause interval execution and restart it after waiting time.
   *
   * @param seconds
   *   Number of seconds to wait before restarting
   */
  async restartSync(seconds: number) {
    clearInterval(this.intervalId);

    this.sequenceCount = 0;
    this.log.warn(`Restarting device data sync in ${seconds} seconds...`);

    await sleep(seconds);
    this.startPeriodicSync();
    this.log.info('Device data sync restarted');
  }

  /**
   * Determine if the accessory should execute a read or write operation.
   *
   * @returns True if the accessory should execute, false otherwise.
   */
  private shouldExecute(): boolean {
    this.sequenceCount++;
    if (this.sequenceCount > AirfiDevice.READ_FREQUENCY) {
      this.sequenceCount = 1;
    }

    // Return if it's not a read sequence and there's nothing to write
    return !(this.sequenceCount > 1 && this.queue.size === 0);
  }

  /**
   * Start the periodic sync operations.
   */
  private startPeriodicSync(): void {
    this.intervalId = setInterval(() => {
      this.deviceSync().catch((error: Error) => {
        this.log.error(`Device sync failed: ${error.message}`);
        this.emit('restart-required', 10);
      });
    }, AirfiDevice.INTERVAL_FREQUENCY);
  }

  /**
   * Write values from queue to the air handling unit.
   */
  private async writeQueue(): Promise<void> {
    this.log.debug('Writing values to device');

    for (const [address, value] of this.queue) {
      await this.controller.write(address, value).finally(() => {
        this.queue.delete(address);
      });
    }
  }
}
