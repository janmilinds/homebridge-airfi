import { Characteristic, Logger, Service } from 'homebridge';

import AirfiVentilationUnitAccessory from '../airfiVentilationUnit';

/**
 * Accessory service class for defining services communicating on modbus
 * interface.
 */
export abstract class AirfiService {
  protected readonly accessory: AirfiVentilationUnitAccessory;

  protected readonly Characteristic: typeof Characteristic;

  protected readonly log: Logger;

  protected service: Service;

  /**
   * Defines the Airfi accessory service.
   *
   * @param accessory
   *   Accessory object.
   * @param service
   *   Service object to define accessory service.
   * @param updateFrequency
   *   Number of seconds to run periodic updates on service charasterictics.
   */
  constructor(
    accessory: AirfiVentilationUnitAccessory,
    service: Service,
    updateFrequency = 0
  ) {
    this.accessory = accessory;
    this.Characteristic = accessory.Characteristic;
    this.log = accessory.log;
    this.service = service;

    if (updateFrequency > 0) {
      setTimeout(() => {
        this.updateState();
        setInterval(() => this.updateState(), updateFrequency * 1000);
      }, 5000);
    }
  }

  /**
   * Rerturn the service created by this class for accessory to register.
   */
  getService() {
    return this.service;
  }

  /**
   * Updates service state with a frequency set in constructor.
   */
  protected updateState(): void {
    return;
  }
}
