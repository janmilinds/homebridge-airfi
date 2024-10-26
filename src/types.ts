import { PlatformConfig } from 'homebridge';

export interface AirfiDeviceConfig {
  exposeFireplaceFunctionSwitch?: boolean;
  exposeBoostedCoolingSwitch?: boolean;
  exposeSaunaFunctionSwitch?: boolean;
  host: string;
  model: string;
  port: number;
  serialNumber: string;
}

export interface AirfiDeviceContext {
  config: AirfiDeviceConfig;
}

export interface AirfiPlatformConfig extends PlatformConfig {
  debug?: DebugOptions;
  devices: AirfiDeviceConfig[];
  language: 'en' | 'fi' | 'sv';
  name: string;
}

export interface DebugOptions {
  printModbusMap?: boolean;
}

export type FanActiveState = 0 | 1;

export type FanRotationSpeedState = 0 | 1 | 2 | 3 | 4 | 5;

export type RegisterAddress =
  `${3 | 4}x${number}${number}${number}${number}${number}`;

export type RegisterType = 3 | 4;

export type ServiceOptions<T = Record<string, unknown>> = T & {
  configuredNameKey?: string;
  displayName?: string;
  name: string;
  readAddress?: RegisterAddress;
  subtype?: string;
  updateFrequency?: number;
  writeAddress?: RegisterAddress;
};

export type SwitchOnState = 0 | 1;

export type WriteQueue = Map<number, number>;
