import { CharacteristicValue, Logger, Service } from 'homebridge';

import AirfiVentilationUnitAccessory from '../airfiVentilationUnit';
import { AirfiModbusController } from '../controller';
import { Active, RotationSpeed, AirfiFanState } from '../types';
import { AirfiService } from './airfiService';

export default class AirfiFanService implements AirfiService {
  static readonly ROTATION_SPEED_READ_ADDRESS = 24;

  private readonly accessory;

  private readonly controller: AirfiModbusController;

  private readonly log: Logger;

  private service: Service;

  private state: AirfiFanState = {
    Active: 1,
    RotationSpeed: 3,
  };

  constructor(
    accessory: AirfiVentilationUnitAccessory,
    controller: AirfiModbusController
  ) {
    this.accessory = accessory;
    this.controller = controller;
    this.log = this.accessory.log;
    this.service = new this.accessory.Service.Fanv2();
    this.service
      .getCharacteristic(this.accessory.Characteristic.Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

    // Set RotationSpeed charasteristic to correspond with speed supported by
    // the Airfi ventilation unit.
    this.service
      .getCharacteristic(this.accessory.Characteristic.RotationSpeed)
      .setProps({ minValue: 0, maxValue: 5 });

    this.service
      .getCharacteristic(this.accessory.Characteristic.RotationSpeed)
      .onGet(this.getRotationSpeed.bind(this))
      .onSet(this.setRotationSpeed.bind(this));

    this.log.debug('Airfi Fan service initialized.');
  }

  private async getActive() {
    this.log.debug('Fan Active is', this.state.Active);
    return this.state.Active;
  }

  private async setActive(value: CharacteristicValue) {
    // Only change fan state if it differs from current state,
    if (value !== this.state.Active) {
      this.log.info(`Fan Active ${this.state.Active} → ${value}`);
      this.state.Active = value as Active;
    }
  }

  private async getRotationSpeed() {
    this.log.debug('RotationSpeed is:', this.state.RotationSpeed);
    return this.state.RotationSpeed;
  }

  private async setRotationSpeed(value: CharacteristicValue) {
    // Airfi ventilation unit supports only speeds 1–5, so only change speed on
    // that range. Speed 0 anyway sets the fan inactive.
    if (value > 0) {
      this.state.RotationSpeed = value as RotationSpeed;
      this.log.info(`Fan RotationSpeed ${this.state.Active} → ${value}`);
    }
  }

  public async runUpdates() {
    await this.controller
      .read(AirfiFanService.ROTATION_SPEED_READ_ADDRESS)
      .then((value) => {
        this.state.RotationSpeed = value as RotationSpeed;
        this.service
          .getCharacteristic(this.accessory.Characteristic.RotationSpeed)
          .updateValue(this.state.RotationSpeed);
      })
      .catch((error) => {
        this.log.error(error);
      });
  }

  public getService() {
    return this.service;
  }
}
