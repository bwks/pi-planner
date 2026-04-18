# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.1.1] - 2026-04-18

### Changed
- replaced `/mode plan` and `/mode build` with dedicated `/plan` and `/build` commands
- planner guidance and blocked-action messages now point users to `/build`
- BUILD footer status now uses vibrant orange styling with `🤖 BUILD 🤖`
- PLAN footer status now uses vibrant blue styling with `📋 PLAN 📋`
- added test coverage to ensure the extension registers `/plan` and `/build`

## [0.1.0] - 2026-04-18

### Added
- initial `pi-planner` package structure for GitHub distribution
- planner mode extension with `/plan` and `/build`
- read-only tool gating in `PLAN` mode for `read`, `grep`, `find`, and `ls`
- blocking of file mutations and user shell commands while in `PLAN` mode
- session persistence for planner mode state
- footer status indicator showing the active mode
- tests for extension parsing and planner mode behavior
- MIT license and README documentation

### Changed
- BUILD status uses a colored footer indicator
- PLAN footer status uses a colored footer indicator
