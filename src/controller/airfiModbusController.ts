import { Logger } from 'homebridge';
import { ModbusTCPClient } from 'jsmodbus';
import { Socket, SocketConnectOpts } from 'net';
import { RegisterType } from '../types';

/**
 * Modbus controller handling reading and writing registers in the Airfi
 * ventilation unit.
 */
export default class AirfiModbusController {
  private static readonly MODBUS_READ_LIMIT = 30;

  private client: ModbusTCPClient;

  private isConnected = false;

  private log: Logger;

  private options: SocketConnectOpts;

  private socket: Socket;

  constructor(host: string, port: number, log: Logger) {
    const timeout = 5000;

    this.log = log;
    this.options = { host, port };
    this.socket = new Socket();
    this.socket.setTimeout(timeout);
    this.socket.on('timeout', () => {
      this.socket.emit('error', new Error('Timeout'));
    });
    this.socket.on('error', (err) => {
      this.log.error(`Socket error: ${err.message}`);
    });
    this.client = new ModbusTCPClient(this.socket, 1, timeout);
  }

  open(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.log.debug(`Connecting ${Object.values(this.options).join(':')}...`);
      const rejectListener = (error: Error) => {
        reject(error.toString());
      };

      this.socket.once('error', rejectListener);

      if (!this.isConnected) {
        this.socket.connect(this.options, () => {
          this.socket.off('error', rejectListener);
          this.isConnected = true;
          this.log.debug(
            `Connected on ${Object.values(this.options).join(':')}`
          );
          resolve();
        });
      } else {
        this.log.warn('Already connected to modbus server');
        resolve();
      }
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isConnected) {
        this.isConnected = false;
        const doneListener = (hadError: boolean) => {
          this.log.debug(
            `Disconnected ${hadError ? 'with error' : 'succesfully'}`
          );
          resolve();
        };
        this.socket.once('close', doneListener);
        this.socket.destroy();
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
      return Promise.reject('Unable to read: no connection to modbus server');
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
        .then(
          ({
            response: {
              body: { values },
            },
          }) => {
            this.log.debug(
              `Reading from "${start}" to "${start - 1 + readLength}"`
            );
            result = [...result, ...values];
          }
        )
        .catch(({ err, message }) => {
          return Promise.reject(`Unable to read register: ${err} - ${message}`);
        });
    }

    if (result.length === length) {
      this.log.debug(
        `Values for ${registerType === 4 ? 'holding' : 'input'}` +
          ` register from "${startAddress}" to "${length}": ` +
          `"${result}"`
      );
      return Promise.resolve(result);
    }

    return Promise.reject(
      `Result length (${result.length}) does not match with query length` +
        `(${length})`
    );
  }

  /**
   * Writes value into the holding register.
   *
   * @param address
   *   Holding register value to write value.
   * @param value
   *   Value to be written into the register.
   */
  write(address: number, value: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.isConnected) {
        reject('Unable to write: no connection to modbus server');
      }

      this.client
        .writeSingleRegister(address, value)
        .then(() => {
          this.log.debug(
            `Successfully written value "${value}" register "${address}"`
          );
          resolve();
        })
        .catch(({ err, message }) => {
          reject(
            `Unable to write value "${value}" register "${address}":` +
              `${err} – ${message}`
          );
        });
    });
  }
}
