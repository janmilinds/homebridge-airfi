import { Characteristic, Logger, PlatformAccessory, Service } from 'homebridge';

import { AirfiHomebridgePlatform } from '../AirfiHomebridgePlatform';

/**
 * Accessory service class for defining services communicating on modbus
 * interface.
 */
export abstract class AirfiService {
  protected readonly Characteristic: typeof Characteristic;

  protected readonly log: Logger;

  protected readonly platform: AirfiHomebridgePlatform;

  protected service: Service;

  /**
   * Defines the Airfi platform service.
   *
   * @param platform
   *   Platform object.
   * @param service
   *   Service object to define platform service.
   * @param updateFrequency
   *   Number of seconds to run periodic updates on service charasterictics.
   */
  constructor(
    accessory: PlatformAccessory,
    platform: AirfiHomebridgePlatform,
    service: typeof Service,
    displayName: string,
    subType: string = '',
    updateFrequency = 0
  ) {
    this.Characteristic = platform.Characteristic;
    this.log = platform.log;
    this.platform = platform;
    this.service =
      accessory.getService(displayName) ||
      accessory.addService(service, displayName, subType);

    if (updateFrequency > 0) {
      setTimeout(() => {
        this.updateState();
        setInterval(() => this.updateState(), updateFrequency * 1000);
      }, 5000);
    }
  }

  public getService(): Service {
    return this.service;
  }

  /**
   * Updates service state with a frequency set in constructor.
   */
  protected updateState(): void {
    return;
  }
}
