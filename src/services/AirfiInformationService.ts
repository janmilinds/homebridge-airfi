import { CharacteristicValue, PlatformAccessory } from 'homebridge';

import { AirfiService } from './AirfiService';
import { AirfiHomebridgePlatform } from '../AirfiHomebridgePlatform';
import { RegisterAddress } from '../types';

/**
 * Provides the base information about platform.
 */
export default class AirfiInformationService extends AirfiService {
  private static readonly READ_ADDRESS_FIRMWARE_REVISION: RegisterAddress =
    '3x00002';

  private static readonly READ_ADDRESS_HARDWARE_REVISION: RegisterAddress =
    '3x00001';

  private firmwareRevision = 'unknown';

  private hardwareRevision = 'unknown';

  private readonly manufacturer = 'Airfi';

  /**
   * @param accessory
   *   Accessory object.
   * @param platform
   *   Platform object.
   * @param displayName
   *   Name shown on the service.
   */
  constructor(
    accessory: PlatformAccessory,
    platform: AirfiHomebridgePlatform,
    displayName: string
  ) {
    super(
      accessory,
      platform,
      platform.Service.AccessoryInformation,
      displayName,
      '_info',
      60
    );

    this.service
      .getCharacteristic(this.Characteristic.Identify)
      .onSet(this.setIdentify.bind(this));
    this.service.setCharacteristic(
      this.Characteristic.Manufacturer,
      this.manufacturer
    );
    this.service.setCharacteristic(
      this.Characteristic.Model,
      platform.config.model
    );
    this.service.setCharacteristic(
      this.Characteristic.SerialNumber,
      platform.config.serialNumber
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

  private async setIdentify(value: CharacteristicValue) {
    this.log.debug('Triggered SET Identify:', value);
  }

  public static getVersionString(value: CharacteristicValue): string {
    return value.toString().split('').join('.');
  }

  /**
   * {@inheritDoc AirfiService.updateState}
   */
  protected updateState() {
    // Update Firmware Revision.
    this.firmwareRevision = AirfiInformationService.getVersionString(
      this.platform.getRegisterValue(
        AirfiInformationService.READ_ADDRESS_FIRMWARE_REVISION
      )
    );
    this.service
      .getCharacteristic(this.Characteristic.FirmwareRevision)
      .updateValue(this.firmwareRevision);

    // Update Hardware Revision.
    this.hardwareRevision = AirfiInformationService.getVersionString(
      this.platform.getRegisterValue(
        AirfiInformationService.READ_ADDRESS_HARDWARE_REVISION
      )
    );
    this.service
      .getCharacteristic(this.Characteristic.FirmwareRevision)
      .updateValue(this.firmwareRevision);
  }
}
