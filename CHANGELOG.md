# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-04-18

### Added
- initial `pi-planner` package structure for GitHub distribution
- planner mode extension with `/mode plan` and `/mode build`
- read-only tool gating in `PLAN` mode for `read`, `grep`, `find`, and `ls`
- blocking of file mutations and user shell commands while in `PLAN` mode
- session persistence for planner mode state
- footer status indicator showing the active mode
- tests for extension parsing and planner mode behavior
- MIT license and README documentation

### Changed
- `/mode act` is accepted as an alias for `/mode build`
- BUILD status now uses a brighter green footer indicator with `🤖 BUILD 🤖`
- PLAN footer status is shortened to `⏸ PLAN`
