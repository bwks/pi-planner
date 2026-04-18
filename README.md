# pi-planner

A [pi](https://github.com/mariozechner/pi-coding-agent) package that adds a planner mode.

## Features

- pi starts in `PLAN` mode by default
- `/plan` switches pi into planning mode
- `/build` switches pi back into implementation mode
- in `PLAN` mode, mutating system actions are blocked
- the active toolset is reduced to read-only tools
- current mode is shown in the footer status line
- accepted plans are autosaved before switching to `BUILD`
- planner mode is restored from session history

## Install

Install from GitHub:

```bash
pi install git:github.com/bwks/pi-planner
```

Install into the current project while developing from this repo:

```bash
pi install -l .
```

Load it for one run only from GitHub:

```bash
pi -e git:github.com/bwks/pi-planner
```

Or load this local repo for one run only:

```bash
pi -e .
```

After installing, reload pi if needed:

```text
/reload
```

## Usage

pi starts in `PLAN` mode by default.

Switch modes with:

```text
/plan
/build
```

When `PLAN` mode is active:

- `write`, `edit`, `bash`, and other non-read-only tools are blocked
- user `!` and `!!` shell commands are blocked
- pi is instructed to analyze, inspect, and plan instead of making changes
- when pi returns a structured `Plan:` section, you can choose:
  - `Accept and switch to BUILD mode`
  - `Refine plan`
- accepted plans are saved to `.pi/plans/` before switching to `BUILD`
- refining a plan opens an editor so you can provide specific feedback

Read-only tools allowed in `PLAN` mode:

- `read`
- `grep`
- `find`
- `ls`

## Development

Run tests:

```bash
npm test
```

Test the package directly:

```bash
pi -e .
```
