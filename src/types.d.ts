import 'webrtc';

interface AirfiFanState {
  Active: Active;
  RotationSpeed: RotationSpeed;
}

type Active = 0 | 1;

type RotationSpeed = 0 | 1 | 2 | 3 | 4 | 5;
