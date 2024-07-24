
<p align="center">

<img src="https://github.com/homebridge/branding/raw/latest/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>


# Homebridge Airfi

Homebridge plugin for controlling [Airfi air handling unit](https://airfi.fi/en/air-handling-units/) in the Apple Home app.

The plugin communicates with the air handling unit through Modbus TCP interface.

## Features

- Fan control
  - Control fan speed
  - Control "At home"/"Away" states
- Supply air temperature control
- Sensors
  - Humidity sensor
  - Temperature sensors
    - Outdoor air
    - Supply air
    - Extract air
    - Exhaust air
- Switches (configurable)
  - Boosted cooling mode
  - Fireplace function
  - Sauna function

## Upgrading from version 1.x

It's recommended to completely uninstall the previous version of Homebridge Airfi and perform a clean install of the version 2.x.

Unpair the accessory/child bridge from Home app and uninstall Homebridge Airfi plugin. Previous configuration is not compatible with the new version since plugin has changed from accessory plugin to platform plugin. In case the new version is not detected correctly as a platform plugin (Showing "accessory" key instead of "platform" key JSON config editor) it might be necessary to remove `accessories` directory in homebridge to clear any cached accessories from previous version.

## Installation

Install either through [Homebridge UI](https://github.com/oznu/homebridge-config-ui-x#plugin-screen) or with npm:

```bash
npm install -g homebrigde-airfi
```

### Requirements

This plugin supports air handling units Model 60, 100, 130, 150, 250, 350 manufactured by Airfi.

- Node.js >= 18.17.0
- Homebridge >= 1.6.0
- Modbus map v2.5 or greater on the air handling unit

### Configuration

Plugin configuration is available through Homebridge UI. Example config.json:

```json
{
    "platforms": [
        {
            "name": "Homebrige Airfi",
            "host": "127.0.0.1",
            "port": 502,
            "model": "Model 60",
            "serialNumber": "1234567",
            "language": "en",
            "platform": "Homebridge Airfi"
        }
    ]
}
```
