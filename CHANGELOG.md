# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.1.10] - 2026-05-03

### Added
- `ask_clarifying_questions` tool for collecting planner clarifications in a tabbed UI before producing a final plan
- `🗑️ Delete saved plan` action for saved plans opened from `/plan list`

### Changed
- `PLAN` mode now exposes the clarifying-questions tool while keeping it disabled in `BUILD` mode

## [0.1.9] - 2026-04-18

### Fixed
- the `/plan list` popover border now uses the same `borderAccent` color as the local `/todo` popover

## [0.1.8] - 2026-04-18

### Changed
- `/plan list` now opens directly without an argument-completion selection step
- the saved-plans popover title is now `Saved Plans`

### Fixed
- the `/plan list` popover now renders with a clearer accent-colored border so it stands out from the background

## [0.1.7] - 2026-04-18

### Added
- `💾 Save plan for later` in the plan action menu to store a generated plan without switching to `BUILD`
- `/plan list` centered popover for browsing and selecting saved plans from earlier sessions
- saved-plan parsing and listing helpers for loading `.pi/plans/*.md` newest-first

### Changed
- saving a plan for later now ends the current planning interaction while keeping pi in `PLAN` mode

### Fixed
- required plan action dialogs no longer dismiss on `Escape`; they now require an explicit selection
- required plan action dialogs now show `User input...` instead of the default `Working...` spinner text while waiting for a selection

## [0.1.6] - 2026-04-18

### Added
- completed plan review in `BUILD` mode now offers `🗑️ Delete completed plan`, `📁 Keep saved plan`, and `➕ Additional work`

### Changed
- accepted plans now remain tracked after implementation so users can delete the saved plan or request additional work

## [0.1.5] - 2026-04-18

### Changed
- refinement turns now show a custom `✏️ Refining plan...` working message instead of the default spinner text

## [0.1.4] - 2026-04-18

### Added
- plan review UI now offers `❌ Discard plan` to dismiss a generated plan and stay in `PLAN` mode

### Changed
- accepting a plan now switches to `BUILD` mode and immediately starts implementation
- plan review menu labels now use emojis for accept (`✅`) and refine (`✏️`) actions

## [0.1.3] - 2026-04-18

### Added
- accepted plans are now autosaved to `.pi/plans/` before switching from `PLAN` to `BUILD`
- plan review UI now offers `Accept and switch to BUILD mode` or `Refine plan`
- refining a plan now opens an editor for specific user feedback

### Changed
- planner guidance now asks the agent to emit structured `Plan:` sections with numbered steps

## [0.1.2] - 2026-04-18

### Changed
- planner mode now starts in `PLAN` by default for new sessions without stored planner state
- README now documents installing the package directly from GitHub with `pi install git:github.com/bwks/pi-planner`
- README now documents one-run loading from GitHub with `pi -e git:github.com/bwks/pi-planner`

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
