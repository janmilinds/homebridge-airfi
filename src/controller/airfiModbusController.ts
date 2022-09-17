import { Logger } from 'homebridge';
import { ModbusTCPClient } from 'jsmodbus';
import { Socket, SocketConnectOpts } from 'net';

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
    if (!this.isConnected) {
      throw new Error('No connection to device.');
    }

    return new Promise((resolve, reject) => {
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
            resolve(value);
          }
        )
        .catch((error) => {
          reject(new Error(`Unable to read register ${address}: ${error}`));
        });
    });
  }
}
