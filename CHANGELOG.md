# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-01-06

### Changed
- Update dependencies to latest stable versions for security and compatibility

## [2.0.0] - 2025-10-23

⚠️ **Update notice**

When updating from v1, the plugin must be **reconfigured** to apply the new architecture and settings. Home app automations and accessory configurations may need to be recreated after updating.

### Added
- Multilingual support for displayed accessory names (English, Finnish, Swedish)
- ConfiguredName characteristic for default names in HomeKit
- Upgrade instructions added to README

### Changed
- Complete rewrite of the plugin as a dynamic platform plugin (preferred architecture)
- Migrated to the `modbus-serial` Modbus client
- Support for Homebridge v2
- Refactored config schema, Platform and Accessory classes
- Improved error handling and process for unregistering obsolete devices/accessories
- Accessory service improvements
- Support for older firmware and Modbus versions via feature flagging
- Migrated to ESLint 9
- Updated and bumped dependencies

### Fixed
- Correct handling of `Set` function with Identify characteristic

---

_This release includes all improvements and fixes introduced during the 2.0.0-beta.0 → 2.0.0-beta.11 cycle._

## [1.7.0] - 2024-07-03

### Added

- Option to expose Fireplace, Sauna and Power cooling modes as switches

### Changed

- Update dependencies, Node.js 20, Homebridge 1.8

## [1.6.0] - 2023-09-17

### Changed

- Update dependencies
- Set thermostat minimum temperature to 10°C

## [1.5.0] - 2023-07-05

### Changed

- Update dependencies

## [1.4.1] - 2023-02-18

### Changed

- Update dependencies

## [1.3.6] - 2022-10-24

### Fixed

- Negative temperature value presentation

## [1.3.5] - 2022-10-03

### Changed

- Sync minimum target temperature (heat exchanger bypass) with target temperature
- Small code improvements

## [1.3.4] - 2022-10-01

### Changed

- Re-enable thermostat service
- Modbus controller changes: split register reading into multiple parts

### Fixed

- Ventilation unit restarting issue due to reading too many registers at once
- `MaxListenersExceededWarning` when ventilation unit is out of network

## [1.3.3] - 2022-09-29

### Changed

- Disable thermostat service due to ventilation unit restarting every 4 hours

## [1.3.2] - 2022-09-26

### Changed

- Pause periodic modbus execution in case modbus server becomes unresponsive

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