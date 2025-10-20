import { Characteristic, Logging, Service, WithUUID } from 'homebridge';

import { AirfiAirHandlingUnitAccessory } from '../accessory';
import { AirfiDevice } from '../device';
import i18n from '../i18n';
import { ServiceOptions } from '../types';

/**
 * Accessory service class for defining services communicating on modbus
 * interface.
 */
export abstract class AirfiService {
  protected readonly device: AirfiDevice;

  protected readonly Characteristic: typeof Characteristic;

  protected readonly log: Logging;

  protected service: Service;

  /**
   * @param device
   *   Air handling unit instance.
   * @param platform
   *   Platform object.
   * @param serviceOptions
   *   Various options defining the service characteristics.
   */
  constructor(
    protected readonly accessory: AirfiAirHandlingUnitAccessory,
    serviceOptions: ServiceOptions<{
      service: WithUUID<typeof Service>;
    }>
  ) {
    const platform = this.accessory.getPlatform();
    const platformAccessory = this.accessory.getAccessory();

    this.Characteristic = platform.Characteristic;
    this.device = this.accessory.getDevice();
    this.log = platform.log;
    this.service =
      platformAccessory.getService(
        serviceOptions.name || serviceOptions.service
      ) ||
      platformAccessory.addService(
        new serviceOptions.service(
          serviceOptions.name,
          serviceOptions?.subtype || ''
        )
      );

    const displayName = serviceOptions?.configuredNameKey
      ? i18n.t(serviceOptions.configuredNameKey)
      : serviceOptions.displayName
        ? serviceOptions.displayName
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
