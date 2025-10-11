import { CharacteristicValue } from 'homebridge';

import AirfiService from './AirfiService';
import { AirfiAirHandlingUnitAccessory } from '../accessory';
import AirfiTemperatureSensorService from './AirfiTemperatureSensorService';
import { AirfiHomebridgePlatform } from '../AirfiHomebridgePlatform';
import { RegisterAddress, ServiceOptions } from '../types';

/**
 * Defines the thermostat service to set the target temperature for supply air.
 */
export default class AirfiThermostatService extends AirfiService {
  private static readonly MINIMUM_TEMPERATURE = 10;

  private static readonly MAXIMUM_TEMPERATURE = 21;

  private static readonly CURRENT_TEMPERATURE: RegisterAddress = '3x00008';

  private static readonly TARGET_MIN_TEMPERATURE: RegisterAddress = '4x00050';

  private static readonly TARGET_TEMPERATURE: RegisterAddress = '4x00005';

  private currentTemperature = 0;

  private targetTemperature = 0;

  private targetMinTemperature = 0;

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
      service: platform.Service.Thermostat,
    });

    this.service
      .getCharacteristic(this.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));

    this.service
      .getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.service.setCharacteristic(
      this.Characteristic.TargetHeatingCoolingState,
      this.Characteristic.TargetHeatingCoolingState.AUTO
    );
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

    this.updateState();

    this.log.debug('Airfi Thermostat service initialized.');
  }

  private getCurrentHeatingCoolingState() {
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
    if ((value as number) !== this.targetTemperature) {
      this.log.info(
        `TargetTemperature ${this.targetTemperature}°C → ${value}°C`
      );
      this.targetTemperature = this.targetMinTemperature = value as number;
      this.device.queueInsert(
        AirfiThermostatService.TARGET_TEMPERATURE,
        (value as number) * 10
      );

      if (this.device.hasFeature('minimumTemperatureSet')) {
        this.device.queueInsert(
          AirfiThermostatService.TARGET_MIN_TEMPERATURE,
          value as number
        );
      }
    }
  }

  private async getTemperatureDisplayUnits() {
    return this.Characteristic.TemperatureDisplayUnits.CELSIUS;
  }

  /**
   * {@inheritDoc AirfiService.updateState}
   */
  protected updateState() {
    // Read current temperature value.
    this.currentTemperature = AirfiTemperatureSensorService.convertTemperature(
      this.device.getRegisterValue(AirfiThermostatService.CURRENT_TEMPERATURE)
    );
    this.service
      .getCharacteristic(this.Characteristic.CurrentTemperature)
      .updateValue(this.currentTemperature);

    // Read target temperature value.
    this.targetTemperature = AirfiTemperatureSensorService.convertTemperature(
      this.device.getRegisterValue(AirfiThermostatService.TARGET_TEMPERATURE)
    );

    if (this.device.hasFeature('minimumTemperatureSet')) {
      this.targetMinTemperature = this.device.getRegisterValue(
        AirfiThermostatService.TARGET_MIN_TEMPERATURE
      );
    }

    this.service
      .getCharacteristic(this.Characteristic.TargetTemperature)
      .updateValue(this.targetTemperature);

    if (
      this.device.hasFeature('minimumTemperatureSet') &&
      this.targetTemperature !== this.targetMinTemperature
    ) {
      this.syncTargetMinTemperature();
    }
  }

  /**
   * Sync heat exchanger bypass minimum temperature with set target temperature.
   */
  private syncTargetMinTemperature() {
    this.device.queueInsert(
      AirfiThermostatService.TARGET_MIN_TEMPERATURE,
      this.targetTemperature
    );
  }
}
