import 'webrtc';

type FanActiveState = 0 | 1;

type FanRotationSpeedState = 0 | 1 | 2 | 3 | 4 | 5;

type WriteQueue = {
  [key: number]: number;
};
