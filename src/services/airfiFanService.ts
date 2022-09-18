import { CharacteristicValue } from 'homebridge';

import AirfiVentilationUnitAccessory from '../airfiVentilationUnit';
import { Active, RotationSpeed, AirfiFanState } from '../types';
import { AirfiService } from './airfiService';

/**
 * Defines the fan service for controlling speed and "At home"/"Away" states of
 * the Airfi ventilation unit.
 */
export default class AirfiFanService extends AirfiService {
  static readonly READ_ADDRESS_ACTIVE = 16;

  static readonly READ_ADDRESS_ROTATION_SPEED = 24;

  static readonly WRITE_ADDRESS_ACTIVE = 12;

  static readonly WRITE_ADDRESS_ROTATION_SPEED = 1;

  private state: AirfiFanState = {
    Active: 1,
    RotationSpeed: 3,
  };

  /**
   * {@inheritDoc AirfiService.constructor}
   */
  constructor(
    accessory: AirfiVentilationUnitAccessory,
    displayName: string,
    updateFrequency = 0
  ) {
    super(accessory, new accessory.Service.Fanv2(displayName), updateFrequency);

    this.service.setCharacteristic(
      this.accessory.Characteristic.Name,
      displayName
    );

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
      this.accessory.queueInsert(
        AirfiFanService.WRITE_ADDRESS_ACTIVE,
        AirfiFanService.convertActiveState(value as Active),
        AirfiFanService.READ_ADDRESS_ACTIVE
      );
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
      this.log.info(`Fan RotationSpeed ${this.state.RotationSpeed} → ${value}`);
      this.state.RotationSpeed = value as RotationSpeed;
      this.accessory.queueInsert(
        AirfiFanService.WRITE_ADDRESS_ROTATION_SPEED,
        this.state.RotationSpeed,
        AirfiFanService.READ_ADDRESS_ROTATION_SPEED
      );
    }
  }

  /**
   * Inverts the active state from/to device.
   *
   * From device perspective:
   * -  1 = "Away" state = "inactive"
   * -  0 = "At home" state = "active".
   *
   * @param value
   *   Active state value to conver.
   */
  private static convertActiveState(value: Active): Active {
    return Math.abs(value - 1) as Active;
  }

  /**
   * Run periodic updates to service state.
   */
  protected updateState() {
    // Read active state
    this.state.Active = AirfiFanService.convertActiveState(
      this.accessory.getInputRegisterValue(
        AirfiFanService.READ_ADDRESS_ACTIVE
      ) as Active
    );
    this.service
      .getCharacteristic(this.accessory.Characteristic.Active)
      .updateValue(this.state.Active);

    // Read rotation speed state
    this.state.RotationSpeed = this.accessory.getInputRegisterValue(
      AirfiFanService.READ_ADDRESS_ROTATION_SPEED
    ) as RotationSpeed;
    this.service
      .getCharacteristic(this.accessory.Characteristic.RotationSpeed)
      .updateValue(this.state.RotationSpeed);
  }
}
