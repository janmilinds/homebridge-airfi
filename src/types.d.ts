export type FanActiveState = 0 | 1;

export type FanRotationSpeedState = 0 | 1 | 2 | 3 | 4 | 5;

export type RegisterAddress =
  `${3 | 4}x${number}${number}${number}${number}${number}`;

export type RegisterType = 3 | 4;

export type ServiceOptions<T = { [key: string, unknown] }> = T & {
  configuredNameKey?: string;
  name: string;
  readAddress?: RegisterAddress;
  subtype?: string;
  updateFrequency?: number;
  writeAddress?: RegisterAddress;
};

export type SwitchOnState = 0 | 1;

export type WriteQueue = {
  [key: RegisterAddress]: number;
};
