import { PlatformAccessory } from 'homebridge';

import { AirfiService } from './AirfiService';
import { AirfiHomebridgePlatform } from '../AirfiHomebridgePlatform';
import { RegisterAddress } from '../types';

/**
 * Defines the temperature sensor service to read temperature from the
 * ventilation unit sensor.
 */
export default class AirfiTemperatureSensorService extends AirfiService {
  private currentTemperature = 0;

  private readonly readAddress: RegisterAddress;

  private readonly subtype: string;

  /**
   * @param accessory
   *   Accessory object.
   * @param platform
   *   Platform object.
   * @param displayName
   *   Name shown on the switch.
   * @param subtype
   *   Subtype name to differentiate different temperature sensors.
   * @param readAddress
   *   Register read address to fetch temperature readings.
   */
  constructor(
    accessory: PlatformAccessory,
    platform: AirfiHomebridgePlatform,
    displayName: string,
    subtype: string,
    readAddress: RegisterAddress
  ) {
    super(
      accessory,
      platform,
      platform.Service.TemperatureSensor,
      displayName,
      subtype,
      30
    );

    this.readAddress = readAddress;
    this.subtype = subtype;

    this.service
      .getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.updateState();

    this.log.debug(
      `Airfi TemperatureSensor (${this.subtype}) service initialized.`
    );
  }

  private async getCurrentTemperature() {
    this.log.debug(
      `TemperatureSensor (${this.subtype}) CurrentTemperature is`,
      this.currentTemperature
    );
    return this.currentTemperature;
  }

  /**
   * Converts temperature value from ventilation unit to celcius.
   *
   * @param value
   *   Temperature value from ventilation unit.
   *
   * @returns Temperature value in °C
   */
  static convertTemperature(value: number): number {
    let temperatureValue = value;

    // Convert negative value based on unsigned 16-bit integer value.
    if (temperatureValue > 62803) {
      temperatureValue = value - 65535;
    }

    return parseFloat((temperatureValue / 10).toFixed(1));
  }

  /**
   * {@inheritDoc AirfiService.updateState}
   */
  protected updateState() {
    // Read temperature value.
    this.currentTemperature = AirfiTemperatureSensorService.convertTemperature(
      this.platform.getRegisterValue(this.readAddress)
    );
    this.service
      .getCharacteristic(this.Characteristic.CurrentTemperature)
      .updateValue(this.currentTemperature);
  }
}
