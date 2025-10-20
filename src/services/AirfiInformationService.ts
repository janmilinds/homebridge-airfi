import { CharacteristicValue } from 'homebridge';

import { AirfiService } from './AirfiService';
import { RegisterAddress, ServiceOptions } from '../types';
import { AirfiAirHandlingUnitAccessory } from '../accessory';

/**
 * Provides the base information about platform.
 */
export class AirfiInformationService extends AirfiService {
  private static readonly READ_ADDRESS_FIRMWARE_REVISION: RegisterAddress =
    '3x00002';

  private static readonly READ_ADDRESS_HARDWARE_REVISION: RegisterAddress =
    '3x00001';

  private firmwareRevision = 'unknown';

  private hardwareRevision = 'unknown';

  private readonly manufacturer = 'Airfi';

  /**
   * {@inheritDoc AirfiService.constructor}
   */
  constructor(
    accessory: AirfiAirHandlingUnitAccessory,
    serviceOptions: ServiceOptions
  ) {
    super(accessory, {
      ...serviceOptions,
      service: accessory.getPlatform().Service.AccessoryInformation,
    });

    this.service
      .getCharacteristic(this.Characteristic.Identify)
      .on('set', this.setIdentify.bind(this));
    this.service.setCharacteristic(
      this.Characteristic.Manufacturer,
      this.manufacturer
    );
    this.service.setCharacteristic(
      this.Characteristic.Model,
      accessory.getAccessory().context.config.model
    );
    this.service.setCharacteristic(
      this.Characteristic.SerialNumber,
      accessory.getAccessory().context.config.serialNumber
    );
    this.service
      .getCharacteristic(this.Characteristic.FirmwareRevision)
      .onGet(this.getFirmwareRevision.bind(this));
    this.service
      .getCharacteristic(this.Characteristic.HardwareRevision)
      .onGet(this.getHardwareRevision.bind(this));

    this.updateState();

    this.log.debug('Airfi Information service initialized.');
  }

  private async getFirmwareRevision() {
    this.log.debug('Firmware revision is:', this.firmwareRevision);
    return this.firmwareRevision;
  }

  private async getHardwareRevision() {
    this.log.debug('Hardware revision is:', this.hardwareRevision);
    return this.hardwareRevision;
  }

  private async setIdentify() {
    this.log.debug(
      'Triggered SET Identify:',
      this.service.getCharacteristic(this.Characteristic.ConfiguredName).value
    );
  }

  public static getVersionString(value: CharacteristicValue): string {
    return value ? value.toString().split('').join('.') : '0.0.0';
  }

  /**
   * {@inheritDoc AirfiService.updateState}
   */
  protected updateState() {
    // Update Firmware Revision.
    this.firmwareRevision = AirfiInformationService.getVersionString(
      this.device.getRegisterValue(
        AirfiInformationService.READ_ADDRESS_FIRMWARE_REVISION
      )
    );
    this.service
      .getCharacteristic(this.Characteristic.FirmwareRevision)
      .updateValue(this.firmwareRevision);

    // Update Hardware Revision.
    this.hardwareRevision = AirfiInformationService.getVersionString(
      this.device.getRegisterValue(
        AirfiInformationService.READ_ADDRESS_HARDWARE_REVISION
      )
    );
    this.service
      .getCharacteristic(this.Characteristic.FirmwareRevision)
      .updateValue(this.firmwareRevision);
  }
}
