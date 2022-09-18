# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Hardware revision value
- Humidity sensor

### Changed

- Modbus read/write operations are done centralized manner in the accessory instead of services.

### Fixed

- Added missing charasteristic into information service
- Fan state logging

## [1.0.0] - 2022-09-17

### Added

- Initial release with Airfi ventilation unit fan controls
- Modbus controller for communicating through ModbusTCP with the ventilation unit