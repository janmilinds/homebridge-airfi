import { AccessoryConfig, CharacteristicValue } from 'homebridge';
import AirfiVentilationUnitAccessory from '../airfiVentilationUnit';
import { AirfiModbusController } from '../controller';
import { AirfiService } from './airfiService';

export default class AirfiInformationService extends AirfiService {
  private static readonly READ_ADDRESS_FIRMWARE_REVISION = 2;

  private firmwareRevision = 'unknown';

  private readonly manufacturer = 'Airfi';

  constructor(
    accessory: AirfiVentilationUnitAccessory,
    controller: AirfiModbusController,
    config: AccessoryConfig
  ) {
    super(accessory, controller, new accessory.Service.AccessoryInformation());

    this.service
      .getCharacteristic(this.accessory.Characteristic.Identify)
      .onSet(this.setIdentify.bind(this));

    this.service.setCharacteristic(
      this.accessory.Characteristic.Manufacturer,
      this.manufacturer
    );
    this.service.setCharacteristic(
      this.accessory.Characteristic.Model,
      config.model
    );
    this.service.setCharacteristic(
      this.accessory.Characteristic.SerialNumber,
      config.serialNumber
    );
    this.service
      .getCharacteristic(this.accessory.Characteristic.FirmwareRevision)
      .onGet(this.getFirmwareRevision.bind(this));

    this.log.debug('Airfi Information service initialized.');
  }

  private async getFirmwareRevision() {
    this.log.debug('Firmware revision is:', this.firmwareRevision);
    return this.firmwareRevision;
  }

  private async setIdentify(value: CharacteristicValue) {
    this.log.debug('Triggered SET Identify:', value);
  }

  /**
   * {@inheritDoc AirfiService.runUpdates}
   */
  public async runUpdates() {
    await this.controller
      .read(AirfiInformationService.READ_ADDRESS_FIRMWARE_REVISION)
      .then((value) => {
        this.firmwareRevision = value.toString().split('').join('.');
      })
      .catch((error) => {
        this.log.error(error);
      });
  }
}
