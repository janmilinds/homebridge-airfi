import 'webrtc';

type FanActiveState = 0 | 1;

type FanRotationSpeedState = 0 | 1 | 2 | 3 | 4 | 5;

type RegisterAddress = `${3 | 4}x${number}${number}${number}${number}${number}`;

type RegisterType = 3 | 4;

type WriteQueue = {
  [key: RegisterAddress]: number;
};
