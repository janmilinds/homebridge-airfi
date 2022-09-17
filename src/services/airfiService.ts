import { Service } from 'homebridge';

export declare class AirfiService {
  public getService(): Service;
  public runQueue(): Promise<void>;
  public runUpdates(): Promise<void>;
}
