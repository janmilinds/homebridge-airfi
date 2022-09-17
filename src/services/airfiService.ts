import { Service } from 'homebridge';

export declare class AirfiService {
  public getService(): Service;
  public runUpdates(): Promise<void>;
}
