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

  private retryAttempt = 0;
  private retryTimeout?: NodeJS.Timeout;
  private readonly maxRetryTime = 15 * 60 * 1000; // 15 minutes
  private readonly retryStartTime = Date.now();

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

    this.initializeWithRetry();

    this.device.on('restart-required', (seconds: number) => {
      this.device.restartSync(seconds);
    });
  }

  /**
   * Initialize device with retry mechanism.
   */
  private initializeWithRetry(): void {
    this.device
      .initialize()
      .then(() => {
        // Clear any pending retry timeout.
        if (this.retryTimeout) {
          clearTimeout(this.retryTimeout);
          this.retryTimeout = undefined;
        }

        this.serviceFactory.createAllServices();
        this.emit('initialized');

        if (this.retryAttempt > 0) {
          this.log.info(
            `Successfully connected to "${this.accessory.displayName}" after ${this.retryAttempt} retry attempt(s)`
          );
        }

        this.log.debug(
          'Finished initializing accessory:',
          this.accessory.displayName
        );
      })
      .catch((error: Error) => {
        this.handleInitializationError(error);
      });
  }

  /**
   * Handle initialization error and determine retry strategy.
   */
  private handleInitializationError(error: Error): void {
    const elapsedTime = Date.now() - this.retryStartTime;

    // Check if we've exceeded the maximum retry time.
    if (elapsedTime >= this.maxRetryTime) {
      this.log.error(
        `Failed to initialize "${this.accessory.displayName}" after 15 minutes of retries: ${error.message}`
      );
      this.emit('error');
      return;
    }

    this.retryAttempt++;
    const retryDelay = this.getRetryDelay();

    this.log.warn(
      `Error initializing "${this.accessory.displayName}" (attempt ${this.retryAttempt}): ${error.message}`
    );
    this.log.info(
      `Retrying connection to "${this.accessory.displayName}" in ${retryDelay / 1000} seconds...`
    );

    this.retryTimeout = setTimeout(() => {
      this.initializeWithRetry();
    }, retryDelay);
  }

  /**
   * Return retry delay based on attempt number.
   *
   * @returns Delay in milliseconds.
   */
  private getRetryDelay(): number {
    /**
     * First retry: 15 seconds
     * Second retry: 30 seconds
     * Subsequent retries: 60 seconds
     */
    const retryDelays = [15, 30, 60];

    // Use the last delay for all attempts beyond the defined ones.
    return (
      retryDelays[Math.min(this.retryAttempt - 1, retryDelays.length - 1)] *
      1000
    );
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

  /**
   * Clean up resources when accessory is being destroyed.
   */
  destroy(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = undefined;
    }

    this.device.removeAllListeners();
    this.removeAllListeners();
  }
}
