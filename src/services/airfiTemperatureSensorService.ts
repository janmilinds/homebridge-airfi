import AirfiVentilationUnitAccessory from '../airfiVentilationUnit';
import { RegisterAddress } from '../types';
import { AirfiService } from './airfiService';

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
   * @param displayName
   *   Name shown on the sensor.
   * @param subtype
   *   Subtype name to differentiate different temperature sensors.
   * @param readAddress
   *   Register read address to get temperature readings.
   */
  constructor(
    accessory: AirfiVentilationUnitAccessory,
    displayName: string,
    subtype: string,
    readAddress: RegisterAddress
  ) {
    super(
      accessory,
      new accessory.Service.TemperatureSensor(displayName, subtype),
      60
    );

    this.readAddress = readAddress;
    this.subtype = subtype;

    this.service.setCharacteristic(this.Characteristic.Name, displayName);

    this.service
      .getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

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
   * Run periodic updates to service state.
   */
  protected updateState() {
    // Read temperature value.
    this.currentTemperature = AirfiTemperatureSensorService.convertTemperature(
      this.accessory.getRegisterValue(this.readAddress)
    );
    this.service
      .getCharacteristic(this.Characteristic.CurrentTemperature)
      .updateValue(this.currentTemperature);
  }
}
