# pi-planner

A [pi](https://github.com/mariozechner/pi-coding-agent) package that adds a planner mode.

## Features

- `/plan` switches pi into planning mode
- `/build` switches pi back into implementation mode
- in `PLAN` mode, mutating system actions are blocked
- the active toolset is reduced to read-only tools
- current mode is shown in the footer status line
- planner mode is restored from session history

## Install

From this repo while developing:

```bash
pi install -l .
```

Or load it for one run only:

```bash
pi -e .
```

After installing, reload pi if needed:

```text
/reload
```

## Usage

Switch modes with:

```text
/plan
/build
```

When `PLAN` mode is active:

- `write`, `edit`, `bash`, and other non-read-only tools are blocked
- user `!` and `!!` shell commands are blocked
- pi is instructed to analyze, inspect, and plan instead of making changes

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
