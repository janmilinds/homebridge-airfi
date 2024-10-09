import { CharacteristicValue } from 'homebridge';

import { AirfiAirHandlingUnitAccessory } from '../AirfiAirHandlingUnitAccessory';
import AirfiService from './AirfiService';
import { AirfiHomebridgePlatform } from '../AirfiHomebridgePlatform';
import {
  FanActiveState,
  FanRotationSpeedState,
  RegisterAddress,
  ServiceOptions,
} from '../types';
import { sleep } from '../utils';

/**
 * Defines the fan service for controlling speed and "At home"/"Away" states of
 * the Airfi air handling unit.
 */
export default class AirfiFanService extends AirfiService {
  static readonly ROTATION_SPEED_STEP = 20;

  static readonly ACTIVE: RegisterAddress = '4x00012';

  static readonly ROTATION_SPEED: RegisterAddress = '4x00001';

  private active: FanActiveState = 0;

  private rotationSpeed = 0;

  /**
   * {@inheritDoc AirfiService.constructor}
   */
  constructor(
    device: AirfiAirHandlingUnitAccessory,
    platform: AirfiHomebridgePlatform,
    serviceOptions: ServiceOptions
  ) {
    super(device, platform, {
      ...serviceOptions,
      service: platform.Service.Fanv2,
    });

    this.service
      .getCharacteristic(this.Characteristic.Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

    // Set RotationSpeed charasteristic to correspond with speed supported by
    // the Airfi air handling unit.
    this.service
      .getCharacteristic(this.Characteristic.RotationSpeed)
      .setProps({ minStep: AirfiFanService.ROTATION_SPEED_STEP });

    this.service
      .getCharacteristic(this.Characteristic.RotationSpeed)
      .onGet(this.getRotationSpeed.bind(this))
      .onSet(this.setRotationSpeed.bind(this));

    this.updateState();

    this.log.debug('Airfi Fan service initialized.');
  }

  private async getActive() {
    this.log.debug('Fan Active is', this.active);
    return this.active;
  }

  private async setActive(value: CharacteristicValue) {
    // Only change fan state if it differs from current state,
    if (value !== this.active) {
      this.device.queueInsert(
        AirfiFanService.ACTIVE,
        AirfiFanService.convertActiveState(value as FanActiveState)
      );
      this.log.info(`Fan Active ${this.active} → ${value}`);

      // Delay state set if both speed and active is set at the same time.
      if (value === 1) {
        await sleep(0.25);
      }
      this.active = value as FanActiveState;
    }
  }

  private async getRotationSpeed() {
    this.log.debug('RotationSpeed is:', this.rotationSpeed);
    return this.rotationSpeed;
  }

  private async setRotationSpeed(value: CharacteristicValue) {
    // Airfi air handling unit supports only speeds 1–5, so only change speed on
    // that range. Speed 0 anyway sets the fan inactive.
    if ((value as number) > 0 && value !== this.rotationSpeed) {
      // Delay speed set if fan is not active.
      if (this.active === 0) {
        await sleep(1);
      }

      this.log.info(`Fan RotationSpeed ${this.rotationSpeed} → ${value}`);
      this.rotationSpeed = value as number;
      this.device.queueInsert(
        AirfiFanService.ROTATION_SPEED,
        AirfiFanService.convertRotationSpeed(this.rotationSpeed, 'write')
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
   * @returns Rotation speed as percentage or air handling speed (1–5).
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
   * {@inheritDoc AirfiService.updateState}
   */
  protected updateState() {
    // Read active state
    this.active = AirfiFanService.convertActiveState(
      this.device.getRegisterValue(AirfiFanService.ACTIVE) as FanActiveState
    );
    this.service
      .getCharacteristic(this.Characteristic.Active)
      .updateValue(this.active);

    // Read rotation speed state
    this.rotationSpeed = AirfiFanService.convertRotationSpeed(
      this.device.getRegisterValue(AirfiFanService.ROTATION_SPEED),
      'read'
    );
    this.service
      .getCharacteristic(this.Characteristic.RotationSpeed)
      .updateValue(this.rotationSpeed);
  }
}
