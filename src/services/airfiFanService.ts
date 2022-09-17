import { CharacteristicValue, Logger, Service } from 'homebridge';
import AirfiVentilationUnitAccessory from '../airfiVentilationUnit';

type Active = 0 | 1;

interface AirfiFanState {
  Active: Active;
}

export default class AirfiFanService {
  private readonly log: Logger;

  private service: Service;

  private state: AirfiFanState = {
    Active: 1,
  };

  constructor(accessory: AirfiVentilationUnitAccessory) {
    this.log = accessory.log;
    this.service = new accessory.Service.Fanv2();
    this.service
      .getCharacteristic(accessory.Characteristic.Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

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

  public getService() {
    return this.service;
  }
}
