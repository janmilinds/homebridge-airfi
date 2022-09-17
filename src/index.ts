import { API } from 'homebridge';

import AirfiVentilationUnitAccessory from './airfiVentilationUnit';

export = (api: API) => {
  api.registerAccessory('Homebridge Airfi', AirfiVentilationUnitAccessory);
};
