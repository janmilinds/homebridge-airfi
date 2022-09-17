import { Logger, Service } from 'homebridge';

import AirfiVentilationUnitAccessory from '../airfiVentilationUnit';
import { AirfiModbusController } from '../controller';
import { WriteQueue } from '../types';

/**
 * Accessory service class for defining services communicating on modbus
 * interface.
 */
export abstract class AirfiService {
  protected readonly accessory: AirfiVentilationUnitAccessory;

  protected readonly controller: AirfiModbusController;

  protected readonly log: Logger;

  protected service: Service;

  protected queue: WriteQueue;

  constructor(
    accessory: AirfiVentilationUnitAccessory,
    controller: AirfiModbusController,
    service: Service
  ) {
    this.accessory = accessory;
    this.controller = controller;
    this.log = accessory.log;
    this.service = service;
    this.queue = {};
  }

  /**
   * Update device charasteristic values by reading them from the ventilation
   * unit.
   */
  public runUpdates(): Promise<void> {
    return new Promise<void>((resolve) => {
      resolve();
    });
  }

  /**
   * Write values from queue to the ventilation unit.
   */
  public runQueue(): Promise<void> {
    return new Promise<void>((resolve) => {
      Object.entries(this.queue).map(([address, value]) => {
        this.controller
          .write(parseInt(address), value)
          .then()
          .finally(() => {
            delete this.queue[address];
          });
      });

      resolve();
    });
  }

  /**
   * Rerturn the service created by this class for accessory to register.
   */
  public getService() {
    return this.service;
  }
}
