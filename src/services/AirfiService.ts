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
   * @param accessory
   *   Accessory object.
   * @param platform
   *   Platform object.
   * @param AccessoryService
   *   Service class to define an accessory service.
   * @param displayName
   *   Name shown on the service.
   * @param subType
   *   Subtype name to differentiate different services.
   * @param updateFrequency
   *   Number of seconds to run periodic updates on service charasterictics.
   */
  constructor(
    accessory: PlatformAccessory,
    platform: AirfiHomebridgePlatform,
    AccessoryService: typeof Service,
    displayName: string,
    subType: string = '',
    updateFrequency = 0
  ) {
    this.Characteristic = platform.Characteristic;
    this.log = platform.log;
    this.platform = platform;
    this.service =
      accessory.getService(displayName) ||
      accessory.addService(new AccessoryService(displayName, subType));

    if (updateFrequency > 0) {
      setTimeout(() => {
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
