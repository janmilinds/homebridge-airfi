import { CharacteristicValue, PlatformAccessory } from 'homebridge';

import AirfiService from './AirfiService';
import { AirfiHomebridgePlatform } from '../AirfiHomebridgePlatform';
import { RegisterAddress, ServiceOptions, SwitchOnState } from '../types';

/**
 * Defines the switch service to control ON/OFF characteristics of the
 * air handling unit.
 */
export default class AirfiSwitchService extends AirfiService {
  private on: boolean = false;

  private readonly subtype: string;

  private readonly writeAddress: RegisterAddress;

  /**
   * {@inheritDoc AirfiService.constructor}
   */
  constructor(
    accessory: PlatformAccessory,
    platform: AirfiHomebridgePlatform,
    serviceOptions: ServiceOptions
  ) {
    super(accessory, platform, {
      ...serviceOptions,
      service: platform.Service.Switch,
    });

    this.subtype = serviceOptions.subtype as string;
    this.writeAddress = serviceOptions.writeAddress as RegisterAddress;

    this.service
      .getCharacteristic(this.Characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));

    this.updateState();

    this.log.debug(`Airfi Switch (${this.subtype}) service initialized.`);
  }

  private async getOn() {
    this.log.debug(`Switch (${this.subtype}) On is`, this.on);
    return this.on;
  }

  private async setOn(value: CharacteristicValue) {
    // Only change on state if it differs from current state,
    if (value !== this.on) {
      this.platform.queueInsert(
        this.writeAddress,
        value === true ? 1 : (0 as SwitchOnState)
      );
      this.log.info(`Switch (${this.subtype}) On ${this.on} → ${value}`);
    }
  }

  /**
   * {@inheritDoc AirfiService.updateState}
   */
  protected updateState() {
    // Read on state
    this.on =
      (this.platform.getRegisterValue(this.writeAddress) as SwitchOnState) ===
      1;
    this.service.getCharacteristic(this.Characteristic.On).updateValue(this.on);
  }
}
