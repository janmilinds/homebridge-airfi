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
    this.service
      .getCharacteristic(this.Characteristic.ResetFilterIndication)
      .onSet(this.resetFilterChangeIndication.bind(this));

    this.updateState();

    this.log.debug('Airfi FilterMaintenance service initialized.');
  }

  private async getFilterChangeIndication() {
    this.log.debug('FilterChangeIndication is', this.filterChangeIndication);
    return this.filterChangeIndication;
  }

  private async resetFilterChangeIndication() {
    this.filterChangeIndication = 0;
    this.device.queueInsert(
      AirfiFilterMaintenanceService.FILTER_CHANGE_INDICATION,
      0
    );
    this.log.info('FilterChangeIndication Reset');
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
