import EventEmitter from 'events';
import { Logging, PlatformAccessory } from 'homebridge';

import { AirfiHomebridgePlatform } from '../AirfiHomebridgePlatform';
import { AirfiDevice } from '../device';
import { AirfiServiceFactory } from '../services';
import { AirfiDeviceContext } from '../types';

/**
 * Platform accessory for the Airfi air handling unit.
 */
export class AirfiAirHandlingUnitAccessory extends EventEmitter {
  private device: AirfiDevice;

  public readonly log: Logging;

  private readonly serviceFactory: AirfiServiceFactory;

  constructor(
    private readonly accessory: PlatformAccessory<AirfiDeviceContext>,
    private readonly platform: AirfiHomebridgePlatform
  ) {
    super();

    const {
      context: { config },
    } = accessory;
    this.log = platform.log;

    this.device = new AirfiDevice(
      config.host,
      config.port,
      this.log,
      this.accessory.displayName,
      this.platform.config.debug
    );

    this.serviceFactory = new AirfiServiceFactory(this);

    this.device
      .initialize()
      .then(() => {
        this.serviceFactory.createAllServices();
        this.emit('initialized');

        this.log.debug(
          'Finished initializing accessory:',
          this.accessory.displayName
        );
      })
      .catch((error: Error) => {
        this.log.error(
          `Error while initializing "${this.accessory.displayName}":`,
          error.message
        );
        this.emit('error');
      });

    this.device.on('restart-required', (seconds: number) => {
      this.device.restartSync(seconds);
    });
  }

  getAccessory(): PlatformAccessory<AirfiDeviceContext> {
    return this.accessory;
  }

  getPlatform(): AirfiHomebridgePlatform {
    return this.platform;
  }

  getDevice(): AirfiDevice {
    return this.device;
  }
}
