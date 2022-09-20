import AirfiVentilationUnitAccessory from '../airfiVentilationUnit';
import { AirfiService } from './airfiService';

/**
 *
 */
export default class AirfiThermostatService extends AirfiService {
  private readonly currentHeatingCoolingState;

  private readonly targetHeatingCoolingState;

  private currentTemperature = 0;

  private targetTemperature;

  private readonly temperatureDisplayUnits;

  /**
   * @param accessory
   *   Accessory object.
   * @param displayName
   *   Name shown on the sensor.
   */
  constructor(accessory: AirfiVentilationUnitAccessory, displayName: string) {
    super(accessory, new accessory.Service.Thermostat(displayName), 60);

    this.service.setCharacteristic(this.Characteristic.Name, displayName);

    this.currentHeatingCoolingState =
      this.Characteristic.CurrentHeatingCoolingState.HEAT;
    this.targetHeatingCoolingState =
      this.Characteristic.TargetHeatingCoolingState.AUTO;

    this.service
      .getCharacteristic(this.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));

    this.service
      .getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.service
      .getCharacteristic(this.Characteristic.TargetHeatingCoolingState)
      .setProps({
        minValue: this.Characteristic.TargetHeatingCoolingState.AUTO,
      })
      .onGet(this.getTargetHeatingCoolingState.bind(this))
      .onSet(this.setTargetHeatingCoolingState.bind(this));

    this.service
      .getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.service
      .getCharacteristic(this.Characteristic.TargetTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

    this.service
      .getCharacteristic(this.Characteristic.TemperatureDisplayUnits)
      .onGet(this.getTemperatureDisplayUnits.bind(this))
      .onSet(this.setTemperatureDisplayUnits.bind(this));

    this.log.debug('Airfi Thermostat service initialized.');
  }

  private async getCurrentHeatingCoolingState() {
    return this.currentHeatingCoolingState;
  }

  private async getCurrentTemperature() {
    this.log.debug(
      'Theromostat CurrentTemperature is',
      this.currentTemperature
    );
    return this.currentTemperature;
  }

  private async getTargetHeatingCoolingState() {
    return 0;
  }

  private async setTargetHeatingCoolingState() {
    return 0;
  }

  private async getTargetTemperature() {
    return 0;
  }

  private async setTargetTemperature() {
    return 0;
  }

  private async getTemperatureDisplayUnits() {
    return 0;
  }

  private async setTemperatureDisplayUnits() {
    return 0;
  }

  /**
   * Run periodic updates to service state.
   */
  protected updateState() {}
}
