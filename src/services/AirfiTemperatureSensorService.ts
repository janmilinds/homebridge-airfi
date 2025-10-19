import AirfiService from './AirfiService';
import { AirfiAirHandlingUnitAccessory } from '../accessory';
import { RegisterAddress, ServiceOptions } from '../types';

/**
 * Defines the temperature sensor service to read temperature from the
 * air handling unit's sensors.
 */
export default class AirfiTemperatureSensorService extends AirfiService {
  private currentTemperature = 0;

  private readonly readAddress: RegisterAddress;

  private readonly subtype: string;

  /**
   * {@inheritDoc AirfiService.constructor}
   */
  constructor(
    accessory: AirfiAirHandlingUnitAccessory,
    serviceOptions: ServiceOptions
  ) {
    super(accessory, {
      ...serviceOptions,
      service: accessory.getPlatform().Service.TemperatureSensor,
    });

    this.readAddress = serviceOptions.readAddress as RegisterAddress;
    this.subtype = serviceOptions.subtype as string;

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
   * Converts temperature value from air handling unit to celcius.
   *
   * @param value
   *   Temperature value from air handling unit.
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
      this.device.getRegisterValue(this.readAddress)
    );
    this.service
      .getCharacteristic(this.Characteristic.CurrentTemperature)
      .updateValue(this.currentTemperature);
  }
}
