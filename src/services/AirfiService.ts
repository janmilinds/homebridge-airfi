import {
  Characteristic,
  Logger,
  PlatformAccessory,
  Service,
  WithUUID,
} from 'homebridge';

import { AirfiHomebridgePlatform } from '../AirfiHomebridgePlatform';
import { ServiceOptions } from '../types';

/**
 * Accessory service class for defining services communicating on modbus
 * interface.
 */
export default abstract class AirfiService {
  protected readonly Characteristic: typeof Characteristic;

  protected readonly log: Logger;

  protected readonly platform: AirfiHomebridgePlatform;

  protected service: Service;

  /**
   * @param accessory
   *   Accessory object.
   * @param platform
   *   Platform object.
   * @param serviceOptions
   *   Various options defining the service characteristics.
   */
  constructor(
    accessory: PlatformAccessory,
    platform: AirfiHomebridgePlatform,
    serviceOptions: ServiceOptions<{ service: WithUUID<typeof Service> }>
  ) {
    this.Characteristic = platform.Characteristic;
    this.log = platform.log;
    this.platform = platform;
    this.service =
      accessory.getService(serviceOptions.name || serviceOptions.service) ||
      accessory.addService(
        new serviceOptions.service(
          serviceOptions.name,
          serviceOptions?.subtype || ''
        )
      );

    const displayName = serviceOptions?.configuredNameKey
      ? platform.t(serviceOptions.configuredNameKey)
      : serviceOptions.name;

    this.service.setCharacteristic(this.Characteristic.Name, displayName);

    // Add ConfiguredName characteristic if it's not already set.
    if (!this.service.testCharacteristic(this.Characteristic.ConfiguredName)) {
      this.service.addCharacteristic(this.Characteristic.ConfiguredName);
    }
    this.service.setCharacteristic(
      this.Characteristic.ConfiguredName,
      displayName
    );

    if (serviceOptions?.updateFrequency && serviceOptions.updateFrequency > 0) {
      setTimeout(() => {
        setInterval(
          () => this.updateState(),
          (serviceOptions.updateFrequency as number) * 1000
        );
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
