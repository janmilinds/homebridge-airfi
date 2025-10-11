import { Logging } from 'homebridge';
import ModbusRTU from 'modbus-serial';
import { DebugOptions, RegisterType } from '../types';

/**
 * Modbus controller handling reading and writing registers in the Airfi
 * air handling unit.
 */
export default class AirfiModbusController {
  private static readonly MODBUS_READ_LIMIT = 30;

  private client: ModbusRTU;

  private isConnected = false;

  private host!: string;

  private port!: number;

  constructor(
    host: string,
    port: number,
    public readonly log: Logging,
    private readonly debugOptions: DebugOptions = {}
  ) {
    this.host = host;
    this.port = port;
    this.client = new ModbusRTU();
  }

  open(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.log.debug(`Connecting ${this.host}:${this.port}...`);

      if (this.isConnected) {
        this.log.warn('Already connected to modbus server');
        resolve();
        return;
      }

      this.client
        .connectTCP(this.host, { port: this.port })
        .then(() => {
          this.client.setID(1);
          this.client.setTimeout(2000);
        })
        .then(() => {
          this.log.debug(`Connected on ${this.host}:${this.port}`);
          this.isConnected = true;
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isConnected) {
        this.isConnected = false;
        this.client.close(() => {
          this.log.debug('Connection closed');
          resolve();
        });
      } else {
        this.log.debug('Disconnected already');
        resolve();
      }
    });
  }

  /**
   * Read value from input register.
   *
   * @param startAddress
   *   Input register address to start reading information.
   * @param length
   *   Length of registers to read.
   * @param registerType
   *   Which register to read: 3 = input register, 4 = holding register.
   */
  async read(
    startAddress: number,
    length = 1,
    registerType: RegisterType
  ): Promise<number[]> {
    if (!this.isConnected) {
      return Promise.reject(
        new Error('Unable to read: no connection to modbus server')
      );
    }

    // Modbus read is restricted to certain amount of registers at a time so
    // split reading into sequences.
    const sequences = Array.from(
      Array(Math.ceil(length / AirfiModbusController.MODBUS_READ_LIMIT)),
      (e, i) => i
    );

    let result: number[] = [];
    for (const i of sequences) {
      const start = i * AirfiModbusController.MODBUS_READ_LIMIT + startAddress;
      const readLength = Math.min(
        AirfiModbusController.MODBUS_READ_LIMIT,
        length - i * AirfiModbusController.MODBUS_READ_LIMIT
      );
      const read =
        registerType === 4
          ? this.client.readHoldingRegisters(start, readLength)
          : this.client.readInputRegisters(start, readLength);

      await read
        .then(({ data }) => {
          this.log.debug(`Reading from ${start} to ${start - 1 + readLength}`);
          result = [...result, ...data];
        })
        .catch(({ message }: Error) => {
          return Promise.reject(
            new Error(`Unable to read register: "${message}"`)
          );
        });
    }

    if (result.length === length) {
      this.log.debug(
        `Values for ${registerType === 4 ? 'holding' : 'input'}` +
          ` register from ${startAddress} to ${length}:`,

        this.debugOptions.printModbusMap
          ? result.reduce((result, value, i) => {
              const address = `${startAddress + i}`;
              const registerAddress =
                `${registerType}x` +
                `${'00000'.substring(address.length)}${address}`;

              return {
                ...result,
                [registerAddress]: value,
              };
            }, {})
          : result
      );
      return Promise.resolve(result);
    }

    return Promise.reject(
      new Error(
        `Result length (${result.length}) does not match with query length` +
          `(${length})`
      )
    );
  }

  /**
   * Writes value into the holding register.
   *
   * @param address
   *   Holding register address to write value.
   * @param value
   *   Value to be written into the register.
   */
  write(address: number, value: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Unable to write: no connection to modbus server'));
      }

      this.client
        .writeRegister(address, value)
        .then(() => {
          this.log.debug(
            `Successfully written value "${value}" to register "${address}"`
          );
          resolve();
        })
        .catch(({ message }) => {
          reject(
            new Error(
              `Unable to write value "${value}" to register "${address}":` +
                `"${message}"`
            )
          );
        });
    });
  }
}
