# MULTI-RUNTIME.md — Controller for 4 Top-Level Agents

## Goal

Run and manage 4 top-level agents in one process via interactive mode, with mouse-click pane selection.

## Highest Boundary

- `Runtime` is the highest app-level class passed to UI.
- Use **pool of `Runtime` instances**, not Agent/subagent.

## Architecture

### 1. Runtime Pool

- `Runtime[]` (4 instances), each owns handle/session/model.
- All share one `Context`; handlers use `owns(agent)`.

### 2. Controller UI

- 4 panes (transcript + status) + global status bar.
- Mouse click selects active pane.

### 3. Input Routing

- Prompt goes to active runtime.
- `/switch <id>` or keybinding as fallback.

### 4. Lifecycle

- Spawn/dispose/cancel per runtime.

### 5. Coordination (same directory)

- `coord.json` (task, owner, status, paths).
- File claim locks.
- Serialized submit + check/test + commit.

## Minimal Implementation Order

1. Monitor only (status + output tail) + click select.
2. Input routing to active runtime.
3. Lifecycle controls.
4. Coordination (claim + submit).

## Constraints

- Same process, multiple Runtime.
- Same directory → serialize writes.
- Extend UI/runtime pool only; do not touch agent loop.
