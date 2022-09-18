
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>


# Homebridge Airfi

Homebridge plugin for controlling Airfi ventilation unit through Modbus TCP.

## Features

- Fan control
  - Control fan speed
  - Control "At home"/"Away" states
- Sensors
  - Humidity sensor

## Supported ventilation units

This plugin supports ventilation units Model 60, 100, 130, 150, 250, 350 manufactured by Airfi.

## Installation

Install either through [Homebridge UI](https://github.com/oznu/homebridge-config-ui-x#plugin-screen) or with npm:

```bash
npm install -g homebrigde-airfi
```

Plugin configuration is available through Homebridge UI. Example config.json:

```json
{
    "accessories": [
        {
            "name": "Homebrige Airfi",
            "host": "127.0.0.1",
            "port": 502,
            "model": "Model 60",
            "serialNumber": "1234567",
            "accessory": "Homebridge Airfi"
        }
    ]
}
```
