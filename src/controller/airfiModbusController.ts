import { Logger } from 'homebridge';
import { ModbusTCPClient } from 'jsmodbus';
import { Socket, SocketConnectOpts } from 'net';
import { RegisterType } from '../types';

/**
 * Modbus controller handling reading and writing registers in the Airfi
 * ventilation unit.
 */
export default class airfiModbusController {
  private client: ModbusTCPClient;

  private isConnected = false;

  private log: Logger;

  private options: SocketConnectOpts;

  private socket: Socket;

  constructor(host: string, port: number, log: Logger) {
    const timeout = 10000;

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
      const rejectListener = (error: Error) => {
        reject(
          `Error connecting ${Object.values(this.options).join(':')}: ${error}`
        );
      };

      this.socket.once('error', rejectListener);

      if (!this.isConnected) {
        this.socket.connect(this.options, () => {
          this.socket.removeListener('error', rejectListener);
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
  read(
    startAddress: number,
    length = 1,
    registerType: RegisterType
  ): Promise<number[]> {
    return new Promise((resolve, reject) => {
      this.log.debug(`Reading from "${startAddress}" to "${length}"`);

      if (!this.isConnected) {
        reject('Unable to read: no connection to modbus server');
      }

      const read =
        registerType === 4
          ? this.client.readHoldingRegisters(startAddress, length)
          : this.client.readInputRegisters(startAddress, length);

      read
        .then(
          ({
            response: {
              body: { values },
            },
          }) => {
            this.log.debug(
              `Values for ${registerType === 4 ? 'holding' : 'input'}` +
                ` register address "${startAddress}" for length ${length}: ` +
                `"${values}"`
            );
            resolve(values as number[]);
          }
        )
        .catch(({ err, message }) => {
          reject(`Unable to read register: ${err} - ${message}`);
        });
    });
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
