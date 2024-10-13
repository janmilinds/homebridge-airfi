import { AirfiAirHandlingUnitAccessory } from '../accessory';
import AirfiService from './AirfiService';
import { AirfiHomebridgePlatform } from '../AirfiHomebridgePlatform';
import {
  FilterChangeIndication,
  RegisterAddress,
  ServiceOptions,
} from '../types';

/**
 * Defines the filter maintenance service to display the filter change
 * indication.
 */
export default class AirfiFilterMaintenanceService extends AirfiService {
  static readonly FILTER_CHANGE_INDICATION: RegisterAddress = '4x00034';

  private filterChangeIndication: FilterChangeIndication = 0;

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
      service: platform.Service.FilterMaintenance,
    });

    this.service
      .getCharacteristic(this.Characteristic.FilterChangeIndication)
      .onGet(this.getFilterChangeIndication.bind(this));

    this.updateState();

    this.log.debug('Airfi FilterMaintenance service initialized.');
  }

  private async getFilterChangeIndication() {
    this.log.debug('FilterChangeIndication is', this.filterChangeIndication);
    return this.filterChangeIndication;
  }

  /**
   * {@inheritDoc AirfiService.updateState}
   */
  protected updateState() {
    // Read Filter Change Indication state
    this.filterChangeIndication = this.device.getRegisterValue(
      AirfiFilterMaintenanceService.FILTER_CHANGE_INDICATION
    ) as FilterChangeIndication;
    this.service
      .getCharacteristic(this.Characteristic.FilterChangeIndication)
      .updateValue(this.filterChangeIndication);
  }
}
