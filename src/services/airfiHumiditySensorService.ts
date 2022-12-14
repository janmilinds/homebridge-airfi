import AirfiVentilationUnitAccessory from '../airfiVentilationUnit';
import { RegisterAddress } from '../types';
import { AirfiService } from './airfiService';

/**
 * Defines the humidity sensor service to read relative humidity from the
 * ventilation unit sensor.
 */
export default class AirfiHumiditySensorService extends AirfiService {
  static readonly READ_ADDRESS_RELATIVE_HUMIDITY: RegisterAddress = '3x00023';

  private relativeHumidity = 0;

  /**
   * {@inheritDoc AirfiService.constructor}
   */
  constructor(
    accessory: AirfiVentilationUnitAccessory,
    displayName: string,
    updateFrequency = 0
  ) {
    super(
      accessory,
      new accessory.Service.HumiditySensor(displayName),
      updateFrequency
    );

    this.service.setCharacteristic(this.Characteristic.Name, displayName);

    this.service
      .getCharacteristic(this.Characteristic.CurrentRelativeHumidity)
      .onGet(this.getRelativeHumidity.bind(this));

    this.log.debug('Airfi HumiditySensor service initialized.');
  }

  private async getRelativeHumidity() {
    this.log.debug('HumiditySensor RelativeHumidity is', this.relativeHumidity);
    return this.relativeHumidity;
  }

  /**
   * Run periodic updates to service state.
   */
  protected updateState() {
    // Read relative humidity value.
    this.relativeHumidity = this.accessory.getRegisterValue(
      AirfiHumiditySensorService.READ_ADDRESS_RELATIVE_HUMIDITY
    );
    this.service
      .getCharacteristic(this.Characteristic.CurrentRelativeHumidity)
      .updateValue(this.relativeHumidity);
  }
}
