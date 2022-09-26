# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1] - 2022-09-26

### Changed

- Error logging improvements
- Prevent establishing multiple connections to modbus server

## [1.3.0] - 2022-09-24

### Added

- Thermostat for changing supply air temperature

### Changed

- Modbus read/write and logging improvements

## [1.2.1] - 2022-09-21

### Fixed

- Restore modbus read/write sequence to 1s intervals

## [1.2.0] - 2022-09-19

### Added

- Temperature sensors for outdoor, supply, extract and exhaust air

## [1.1.0] - 2022-09-18

### Added

- Hardware revision value
- Humidity sensor

### Changed

- Modbus read/write operations are done centralized manner in the accessory instead of services.
- Fan speeds are represented as full range percentage for better compatibility with Siri.

### Fixed

- Added missing charasteristic into information service
- Fan state logging

## [1.0.0] - 2022-09-17

### Added

- Initial release with Airfi ventilation unit fan controls
- Modbus controller for communicating through ModbusTCP with the ventilation unit