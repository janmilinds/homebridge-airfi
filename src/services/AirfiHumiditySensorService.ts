import { PlatformAccessory } from 'homebridge';

import { AirfiService } from './AirfiService';
import { AirfiHomebridgePlatform } from '../AirfiHomebridgePlatform';
import { RegisterAddress } from '../types';

/**
 * Defines the humidity sensor service to read relative humidity from the
 * ventilation unit sensor.
 */
export default class AirfiHumiditySensorService extends AirfiService {
  static readonly READ_ADDRESS_RELATIVE_HUMIDITY: RegisterAddress = '3x00023';

  private relativeHumidity = 0;

  /**
   * Defines the Airfi platform service.
   *
   * @param accessory
   *  Accessory object.
   * @param platform
   *   Platform object.
   * @param displayName
   *  Name shown on the service.
   */
  constructor(
    accessory: PlatformAccessory,
    platform: AirfiHomebridgePlatform,
    displayName: string
  ) {
    super(
      accessory,
      platform,
      platform.Service.HumiditySensor,
      displayName,
      '_humidity',
      30
    );

    this.service.setCharacteristic(this.Characteristic.Name, displayName);

    this.service
      .getCharacteristic(this.Characteristic.CurrentRelativeHumidity)
      .onGet(this.getRelativeHumidity.bind(this));

    this.updateState();

    this.log.debug('Airfi HumiditySensor service initialized.');
  }

  private async getRelativeHumidity() {
    this.log.debug('HumiditySensor RelativeHumidity is', this.relativeHumidity);
    return this.relativeHumidity;
  }

  /**
   * {@inheritDoc AirfiService.updateState}
   */
  protected updateState() {
    // Read relative humidity value.
    this.relativeHumidity = this.platform.getRegisterValue(
      AirfiHumiditySensorService.READ_ADDRESS_RELATIVE_HUMIDITY
    );
    this.service
      .getCharacteristic(this.Characteristic.CurrentRelativeHumidity)
      .updateValue(this.relativeHumidity);
  }
}
