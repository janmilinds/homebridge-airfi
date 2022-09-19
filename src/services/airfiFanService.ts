import { CharacteristicValue } from 'homebridge';

import AirfiVentilationUnitAccessory from '../airfiVentilationUnit';
import { FanActiveState, FanRotationSpeedState } from '../types';
import { AirfiService } from './airfiService';

/**
 * Defines the fan service for controlling speed and "At home"/"Away" states of
 * the Airfi ventilation unit.
 */
export default class AirfiFanService extends AirfiService {
  static readonly READ_ADDRESS_ACTIVE = 16;

  static readonly READ_ADDRESS_ROTATION_SPEED = 24;

  static readonly ROTATION_SPEED_STEP = 20;

  static readonly WRITE_ADDRESS_ACTIVE = 12;

  static readonly WRITE_ADDRESS_ROTATION_SPEED = 1;

  private active: FanActiveState = 1;

  private rotationSpeed = 60;

  /**
   * {@inheritDoc AirfiService.constructor}
   */
  constructor(
    accessory: AirfiVentilationUnitAccessory,
    displayName: string,
    updateFrequency = 0
  ) {
    super(accessory, new accessory.Service.Fanv2(displayName), updateFrequency);

    this.service.setCharacteristic(this.Characteristic.Name, displayName);

    this.service
      .getCharacteristic(this.Characteristic.Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

    // Set RotationSpeed charasteristic to correspond with speed supported by
    // the Airfi ventilation unit.
    this.service
      .getCharacteristic(this.Characteristic.RotationSpeed)
      .setProps({ minStep: AirfiFanService.ROTATION_SPEED_STEP });

    this.service
      .getCharacteristic(this.Characteristic.RotationSpeed)
      .onGet(this.getRotationSpeed.bind(this))
      .onSet(this.setRotationSpeed.bind(this));

    this.log.debug('Airfi Fan service initialized.');
  }

  private async getActive() {
    this.log.debug('Fan Active is', this.active);
    return this.active;
  }

  private async setActive(value: CharacteristicValue) {
    // Only change fan state if it differs from current state,
    if (value !== this.active) {
      this.accessory.queueInsert(
        AirfiFanService.WRITE_ADDRESS_ACTIVE,
        AirfiFanService.convertActiveState(value as FanActiveState),
        AirfiFanService.READ_ADDRESS_ACTIVE
      );
      this.log.info(`Fan Active ${this.active} → ${value}`);
      this.active = value as FanActiveState;
    }
  }

  private async getRotationSpeed() {
    this.log.debug('RotationSpeed is:', this.rotationSpeed);
    return this.rotationSpeed;
  }

  private async setRotationSpeed(value: CharacteristicValue) {
    // Airfi ventilation unit supports only speeds 1–5, so only change speed on
    // that range. Speed 0 anyway sets the fan inactive.
    if (value > 0) {
      this.log.info(`Fan RotationSpeed ${this.rotationSpeed} → ${value}`);
      this.rotationSpeed = value as number;
      this.accessory.queueInsert(
        AirfiFanService.WRITE_ADDRESS_ROTATION_SPEED,
        AirfiFanService.convertRotationSpeed(this.rotationSpeed, 'write'),
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
   *   Active state value to convert.
   *
   * @returns Active state 1 | 0
   */
  private static convertActiveState(value: FanActiveState): FanActiveState {
    return Math.abs(value - 1) as FanActiveState;
  }

  /**
   * Convert rotation speed values
   *
   * @param value
   *   Value to convert.
   * @param direction
   *   Conversion direction read: speed → percentage, write: percentage → speed.
   *
   * @returns Rotation speed as percentage or ventilation unit speed (1–5).
   */
  private static convertRotationSpeed(
    value: number | FanRotationSpeedState,
    direction: 'read' | 'write'
  ): number {
    if (direction === 'read') {
      return value * AirfiFanService.ROTATION_SPEED_STEP;
    } else {
      return Math.ceil(value / AirfiFanService.ROTATION_SPEED_STEP);
    }
  }

  /**
   * Run periodic updates to service state.
   */
  protected updateState() {
    // Read active state
    this.active = AirfiFanService.convertActiveState(
      this.accessory.getInputRegisterValue(
        AirfiFanService.READ_ADDRESS_ACTIVE
      ) as FanActiveState
    );
    this.service
      .getCharacteristic(this.Characteristic.Active)
      .updateValue(this.active);

    // Read rotation speed state
    this.rotationSpeed = AirfiFanService.convertRotationSpeed(
      this.accessory.getInputRegisterValue(
        AirfiFanService.READ_ADDRESS_ROTATION_SPEED
      ),
      'read'
    );
    this.service
      .getCharacteristic(this.Characteristic.RotationSpeed)
      .updateValue(this.rotationSpeed);
  }
}
