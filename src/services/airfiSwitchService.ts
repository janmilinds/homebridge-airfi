import { CharacteristicValue } from 'homebridge';

import AirfiVentilationUnitAccessory from '../airfiVentilationUnit';
import { RegisterAddress, SwitchOnState } from '../types';
import { AirfiService } from './airfiService';

/**
 * Defines the switch service to control ON/OFF characteristics of the
 * ventilation unit.
 */
export default class AirfiSwitchService extends AirfiService {
  private on: boolean = false;

  private readonly subtype: string;

  private readonly writeAddress: RegisterAddress;

  /**
   * @param accessory
   *   Accessory object.
   * @param displayName
   *   Name shown on the switch.
   * @param subtype
   *   Subtype name to differentiate different switches.
   * @param writeAddress
   *   Register write address to set switch state.
   */
  constructor(
    accessory: AirfiVentilationUnitAccessory,
    displayName: string,
    subtype: string,
    writeAddress: RegisterAddress
  ) {
    super(
      accessory,
      new accessory.Service.Switch(displayName, subtype),
      1
    );

    this.subtype = subtype;
    this.writeAddress = writeAddress;

    this.service.setCharacteristic(this.Characteristic.Name, displayName);

    this.service
      .getCharacteristic(this.Characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));

    this.log.debug(
      `Airfi Switch (${this.subtype}) service initialized.`
    );
  }

  private async getOn() {
    this.log.debug(`Switch (${this.subtype}) On is`, this.on);
    return this.on;
  }

  private async setOn(value: CharacteristicValue) {
    // Only change on state if it differs from current state,
    if (value !== this.on) {
      this.accessory.queueInsert(
        this.writeAddress,
        value === true ? 1 : 0 as SwitchOnState
      );
      this.log.info(`Switch (${this.subtype}) On ${this.on} → ${value}`);
    }
  }

  /**
   * Run periodic updates to service state.
   */
  protected updateState() {
    // Read on state
    this.on =
      this.accessory.getRegisterValue(this.writeAddress) as SwitchOnState === 1
    ;
    this.service
      .getCharacteristic(this.Characteristic.On)
      .updateValue(this.on);
  }
}
