import { AirfiAirHandlingUnitAccessory } from '../accessory';
import { AirfiHomebridgePlatform } from '../AirfiHomebridgePlatform';
import AirfiVentilationUnitService from './AirfiVentilationUnitService';
import { CurrentAirPurifierState, ServiceOptions } from '../types';

/**
 * Defines the air purifier service for controlling speed and "At home"/"Away"
 * states of the Airfi air handling unit.
 */
class AirfiAirPurifierService extends AirfiVentilationUnitService {
  private currentAirPurifierState: CurrentAirPurifierState = 0;

  /**
   * {@inheritDoc AirfiVentilationUnitService.constructor}
   */
  constructor(
    device: AirfiAirHandlingUnitAccessory,
    platform: AirfiHomebridgePlatform,
    serviceOptions: ServiceOptions
  ) {
    super(device, platform, {
      service: platform.Service.AirPurifier,
      ...serviceOptions,
    });

    this.service
      .getCharacteristic(this.Characteristic.CurrentAirPurifierState)
      .onGet(this.getCurrentAirPurifierState.bind(this));

    this.service.setCharacteristic(
      this.Characteristic.TargetAirPurifierState,
      this.Characteristic.TargetAirPurifierState.AUTO
    );

    this.service
      .getCharacteristic(this.Characteristic.TargetAirPurifierState)
      .setProps({ minValue: 1 })
      .onGet(this.getTargetAirPurifierState.bind(this));

    this.updateState();

    this.log.debug('Airfi AirPurifierservice initialized.');
  }

  private async getCurrentAirPurifierState() {
    this.log.debug('CurrentAirPurifierState is', this.currentAirPurifierState);
    return this.currentAirPurifierState;
  }

  private getTargetAirPurifierState() {
    return this.Characteristic.TargetAirPurifierState.AUTO;
  }

  private updateCurrentAirPurifierState() {
    this.currentAirPurifierState =
      this.active === 1
        ? this.Characteristic.CurrentAirPurifierState.PURIFYING_AIR
        : this.Characteristic.CurrentAirPurifierState.INACTIVE;
  }

  /**
   * {@inheritDoc AirfiService.updateState}
   */
  protected updateState() {
    super.updateState();

    this.updateCurrentAirPurifierState();
    this.service
      .getCharacteristic(this.Characteristic.CurrentAirPurifierState)
      .updateValue(this.currentAirPurifierState);
  }
}

export default AirfiAirPurifierService;
