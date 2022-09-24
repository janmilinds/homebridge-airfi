import { CharacteristicValue } from 'homebridge';
import AirfiVentilationUnitAccessory from '../airfiVentilationUnit';
import { AirfiService } from './airfiService';

/**
 * Provides the base information about accessory.
 */
export default class AirfiInformationService extends AirfiService {
  private static readonly READ_ADDRESS_FIRMWARE_REVISION = 2;

  private static readonly READ_ADDRESS_HARDWARE_REVISION = 1;

  private firmwareRevision = 'unknown';

  private hardwareRevision = 'unknown';

  private readonly manufacturer = 'Airfi';

  constructor(accessory: AirfiVentilationUnitAccessory) {
    super(accessory, new accessory.Service.AccessoryInformation(), 60);

    this.service
      .getCharacteristic(this.Characteristic.Identify)
      .onSet(this.setIdentify.bind(this));
    this.service.setCharacteristic(
      this.Characteristic.Manufacturer,
      this.manufacturer
    );
    this.service.setCharacteristic(
      this.Characteristic.Model,
      accessory.config.model
    );
    this.service.setCharacteristic(
      this.Characteristic.SerialNumber,
      accessory.config.serialNumber
    );
    this.service
      .getCharacteristic(this.Characteristic.FirmwareRevision)
      .onGet(this.getFirmwareRevision.bind(this));
    this.service
      .getCharacteristic(this.Characteristic.HardwareRevision)
      .onGet(this.getHardwareRevision.bind(this));

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

  private static getVersionString(value: CharacteristicValue): string {
    return value.toString().split('').join('.');
  }

  /**
   * {@inheritDoc AirfiService.updateState}
   */
  protected updateState() {
    // Update Firmware Revision.
    this.firmwareRevision = AirfiInformationService.getVersionString(
      this.accessory.getInputRegisterValue(
        AirfiInformationService.READ_ADDRESS_FIRMWARE_REVISION
      )
    );
    this.service
      .getCharacteristic(this.Characteristic.FirmwareRevision)
      .updateValue(this.firmwareRevision);

    // Update Hardware Revision.
    this.hardwareRevision = AirfiInformationService.getVersionString(
      this.accessory.getInputRegisterValue(
        AirfiInformationService.READ_ADDRESS_HARDWARE_REVISION
      )
    );
    this.service
      .getCharacteristic(this.Characteristic.FirmwareRevision)
      .updateValue(this.firmwareRevision);
  }
}
