import { CharacteristicValue } from 'homebridge';

import AirfiVentilationUnitAccessory from '../airfiVentilationUnit';
import { AirfiModbusController } from '../controller';
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

  constructor(
    accessory: AirfiVentilationUnitAccessory,
    controller: AirfiModbusController,
    displayName: string
  ) {
    super(accessory, controller, new accessory.Service.Fanv2(displayName));

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
      this.queue[AirfiFanService.WRITE_ADDRESS_ACTIVE] =
        AirfiFanService.convertActiveState(value as Active);
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
      this.queue[AirfiFanService.WRITE_ADDRESS_ROTATION_SPEED] =
        this.state.RotationSpeed;
      this.log.info(`Fan RotationSpeed ${this.state.Active} → ${value}`);
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
   * {@inheritDoc AirfiService.runUpdates}
   */
  public async runUpdates() {
    await this.controller
      .read(AirfiFanService.READ_ADDRESS_ACTIVE)
      .then((value) => {
        this.state.Active = AirfiFanService.convertActiveState(value as Active);
        this.service
          .getCharacteristic(this.accessory.Characteristic.Active)
          .updateValue(this.state.Active);
      })
      .catch((error) => {
        this.log.error(error);
      });

    await this.controller
      .read(AirfiFanService.READ_ADDRESS_ROTATION_SPEED)
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
}
