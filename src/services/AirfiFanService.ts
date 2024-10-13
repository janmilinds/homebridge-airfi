import { AirfiAirHandlingUnitAccessory } from '../accessory';
import { AirfiHomebridgePlatform } from '../AirfiHomebridgePlatform';
import AirfiVentilationUnitService from './AirfiVentilationUnitService';
import { ServiceOptions } from '../types';

/**
 * Defines the fan service for controlling speed and "At home"/"Away" states of
 * the Airfi air handling unit.
 */
export default class AirfiFanService extends AirfiVentilationUnitService {
  /**
   * {@inheritDoc AirfiVentilationUnitService.constructor}
   */
  constructor(
    device: AirfiAirHandlingUnitAccessory,
    platform: AirfiHomebridgePlatform,
    serviceOptions: ServiceOptions
  ) {
    super(device, platform, {
      service: platform.Service.Fanv2,
      ...serviceOptions,
    });
  }
}
