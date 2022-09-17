import { Logger } from 'homebridge';
import { ModbusTCPClient } from 'jsmodbus';
import { Socket, SocketConnectOpts } from 'net';

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
      const rejectListener = (err: Error) => {
        this.log.error(
          `Error connecting ${Object.values(this.options).join(':')}`
        );
        reject(err);
      };

      this.socket.once('error', rejectListener);
      this.socket.connect(this.options, () => {
        this.socket.removeListener('error', rejectListener);
        this.isConnected = true;
        this.log.debug(`Connected on ${Object.values(this.options).join(':')}`);
        resolve();
      });
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
   * @param address
   *   Input register address to read information.
   */
  read(address: number): Promise<number> {
    return new Promise((resolve) => {
      this.log.debug(`Reading address ${address}`);

      if (!this.isConnected) {
        this.log.error('Not connected to device');
      }

      this.client
        .readInputRegisters(address, 1)
        .then(
          ({
            response: {
              body: {
                values: [value],
              },
            },
          }) => {
            this.log.debug(`Value for address "${address}" is "${value}"`);
            resolve(value);
          }
        )
        .catch((error) => {
          this.log.error(`Unable to read register "${address}": ${error}`);
        });
    });
  }

  /**
   * Writes value into the holding register.
   *
   * @param address
   *   Holding register value to write value.
   * @param value
   *   Value to be writte into the register.
   */
  write(address: number, value: number): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.isConnected) {
        this.log.error('Not connected to device');
      }

      this.client
        .writeSingleRegister(address, value)
        .then(() => {
          this.log.debug(
            `Successfully write value "${value}" register "${address}"`
          );
          resolve();
        })
        .catch((error) => {
          this.log.error(
            `Unable to write value "${value}" register "${address}": ${error}`
          );
        });
    });
  }
}
