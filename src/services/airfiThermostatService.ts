import { CharacteristicValue } from 'homebridge';
import AirfiVentilationUnitAccessory from '../airfiVentilationUnit';
import { AirfiService } from './airfiService';
import AirfiTemperatureSensorService from './airfiTemperatureSensorService';

/**
 * Defines the thermostat service to set the target temperature for supply air.
 */
export default class AirfiThermostatService extends AirfiService {
  private static readonly MINIMUM_TEMPERATURE = 15;

  private static readonly MAXIMUM_TEMPERATURE = 22;

  private static readonly READ_ADDRESS_CURRENT_TEMPERATURE = 8;

  private static readonly READ_ADDRESS_EXHAUST_AIR_TEMPERATURE = 7;

  private static readonly READ_ADDRESS_EXTRACT_AIR_TEMPERATURE = 6;

  private static readonly READ_ADDRESS_TARGET_TEMPERATURE = 5;

  private static readonly WRITE_ADDRESS_TARGET_TEMPERATURE = 5;

  private currentTemperature = 17;

  private targetTemperature = 17;

  /**
   * @param accessory
   *   Accessory object.
   * @param displayName
   *   Name shown on the sensor.
   */
  constructor(accessory: AirfiVentilationUnitAccessory, displayName: string) {
    super(accessory, new accessory.Service.Thermostat(displayName), 60);

    this.service.setCharacteristic(this.Characteristic.Name, displayName);

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
      .onGet(this.getTargetHeatingCoolingState.bind(this));

    this.service
      .getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.service
      .getCharacteristic(this.Characteristic.TargetTemperature)
      .setProps({
        maxValue: AirfiThermostatService.MAXIMUM_TEMPERATURE,
        minStep: 1,
        minValue: AirfiThermostatService.MINIMUM_TEMPERATURE,
      })
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

    this.service
      .getCharacteristic(this.Characteristic.TemperatureDisplayUnits)
      .onGet(this.getTemperatureDisplayUnits.bind(this));

    this.log.debug('Airfi Thermostat service initialized.');
  }

  private getCurrentHeatingCoolingState() {
    const exhaustAirTemperature =
      AirfiTemperatureSensorService.convertTemperature(
        this.accessory.getInputRegisterValue(
          AirfiThermostatService.READ_ADDRESS_EXHAUST_AIR_TEMPERATURE
        )
      );
    const extractAirTemperature =
      AirfiTemperatureSensorService.convertTemperature(
        this.accessory.getInputRegisterValue(
          AirfiThermostatService.READ_ADDRESS_EXTRACT_AIR_TEMPERATURE
        )
      );
    const currentTemperature = AirfiTemperatureSensorService.convertTemperature(
      this.accessory.getInputRegisterValue(
        AirfiThermostatService.READ_ADDRESS_CURRENT_TEMPERATURE
      )
    );
    const targetTemperature = AirfiTemperatureSensorService.convertTemperature(
      this.accessory.getHoldingRegisterValue(
        AirfiThermostatService.READ_ADDRESS_TARGET_TEMPERATURE
      )
    );

    // Determine heating state by the delta of extract and exhaust air.
    // If Δ ≥ 1°C ⇒ heat is being extracted from extract air to supply air and
    // thus the air is being heated.
    const delta = extractAirTemperature - exhaustAirTemperature;

    if (delta >= 1 && targetTemperature > currentTemperature) {
      return this.Characteristic.CurrentHeatingCoolingState.HEAT;
    }

    return this.Characteristic.CurrentHeatingCoolingState.OFF;
  }

  private async getCurrentTemperature() {
    this.log.debug('Thermostat CurrentTemperature is', this.currentTemperature);
    return this.currentTemperature;
  }

  private async getTargetHeatingCoolingState() {
    return this.Characteristic.TargetHeatingCoolingState.AUTO;
  }

  private async getTargetTemperature() {
    this.log.debug('Thermostat TargetTemperature is', this.targetTemperature);
    return this.targetTemperature;
  }

  private async setTargetTemperature(value: CharacteristicValue) {
    this.targetTemperature = value as number;
    this.accessory.queueInsert(
      AirfiThermostatService.WRITE_ADDRESS_TARGET_TEMPERATURE,
      (value as number) * 10,
      AirfiThermostatService.READ_ADDRESS_TARGET_TEMPERATURE,
      4
    );
  }

  private async getTemperatureDisplayUnits() {
    return this.Characteristic.TemperatureDisplayUnits.CELSIUS;
  }

  /**
   * Run periodic updates to service state.
   */
  protected updateState() {
    // Read current temperature value.
    this.currentTemperature = AirfiTemperatureSensorService.convertTemperature(
      this.accessory.getInputRegisterValue(
        AirfiThermostatService.READ_ADDRESS_CURRENT_TEMPERATURE
      )
    );
    this.service
      .getCharacteristic(this.Characteristic.CurrentTemperature)
      .updateValue(this.currentTemperature);

    // Read target temperature value.
    this.targetTemperature = AirfiTemperatureSensorService.convertTemperature(
      this.accessory.getHoldingRegisterValue(
        AirfiThermostatService.READ_ADDRESS_TARGET_TEMPERATURE
      )
    );
    this.service
      .getCharacteristic(this.Characteristic.TargetTemperature)
      .updateValue(this.targetTemperature);

    // Set heating/cooling state.
    this.service
      .getCharacteristic(this.Characteristic.CurrentHeatingCoolingState)
      .updateValue(this.getCurrentHeatingCoolingState());
  }
}
