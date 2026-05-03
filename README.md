# pi-planner

A [pi](https://github.com/mariozechner/pi-coding-agent) package that adds a planner mode.

## Features

- pi starts in `PLAN` mode by default
- `/plan` switches pi into planning mode
- `/build` switches pi back into implementation mode
- in `PLAN` mode, mutating system actions are blocked
- the active toolset is reduced to read-only tools
- the LLM can ask clarifying questions in a tabbed box before proposing a final plan
- current mode is shown in the footer status line
- plans can be saved for later from the plan action menu
- accepted plans are autosaved before switching to `BUILD`
- accepting a plan automatically starts implementation in `BUILD` mode
- `/plan list` opens a centered popover for browsing saved plans from earlier sessions
- you can delete saved plans from the `/plan list` saved-plan action menu
- completed saved plans can be deleted, kept, or extended with additional work after implementation finishes
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
/plan list
/build
```

When `PLAN` mode is active:

- `write`, `edit`, `bash`, and other non-read-only tools are blocked
- user `!` and `!!` shell commands are blocked
- pi is instructed to analyze, inspect, and plan instead of making changes
- pi can ask clarifying questions with a tabbed question box and use your answers to continue planning
- when pi returns a structured `Plan:` section, you can choose:
  - `✅ Accept and switch to BUILD mode`
  - `💾 Save plan for later`
  - `✏️ Refine plan`
  - `❌ Discard plan`
- required plan action dialogs ignore `Escape`, require an explicit selection, and show `User input...` while waiting for your choice
- choosing `💾 Save plan for later` stores the plan in `.pi/plans/`, ends the current planning interaction, and keeps pi in `PLAN` mode
- `/plan list` opens a centered popover so you can pick a saved plan from an earlier session and continue from it later
- from `/plan list`, choosing `🗑️ Delete saved plan` deletes the selected saved plan and keeps pi in `PLAN` mode
- accepted plans are saved to `.pi/plans/` before switching to `BUILD`
- accepting a plan automatically queues implementation work in `BUILD` mode
- after the build completes, pi lets you choose:
  - `🗑️ Delete completed plan`
  - `📁 Keep saved plan`
  - `➕ Additional work`
- completed-plan action dialogs also require an explicit selection instead of allowing `Escape` to dismiss them, and show `User input...` while waiting
- choosing `➕ Additional work` opens an editor so you can request more implementation while keeping the saved plan around
- refining a plan opens an editor so you can provide specific feedback
- refinement turns show a custom `✏️ Refining plan...` working message
- discarding a plan keeps pi in `PLAN` mode without saving or sending follow-up prompts

Read-only tools allowed in `PLAN` mode:

- `read`
- `grep`
- `find`
- `ls`
- `ask_clarifying_questions`

## Development

Run tests:

```bash
npm test
```

Test the package directly:

```bash
pi -e .
```
