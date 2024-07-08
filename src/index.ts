import { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { AirfiHomebridgePlatform } from './AirfiHomebridgePlatform';

/**
 * This method registers the platform with Homebridge
 */
export default (api: API) => {
  api.registerPlatform(PLATFORM_NAME, AirfiHomebridgePlatform);
};
