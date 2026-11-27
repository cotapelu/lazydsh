## Onboarding Files

`AGENTS.md` (patterns + runtime API) · `ARCH.md` (architecture) ·
`CAUTRUC.md` (file map) · `TODO.md` (history + remaining)

---

## Session 2026-11-27: Contracts & Architecture Cleanup

**Objective:** Complete the contract boundary between Runtime and TUI, eliminate duplicate imports, reorganize utils by ownership.

### Completed

- **Contracts (`interfaces.ts`):** Added 12 explicit types for Runtime↔TUI boundary
  - `RunOptions`, `SelectionInfo`, `EffortsInfo`, `SessionSummary`, `ForkPoint`
  - `JobInfo`, `JobOutput`, `AuthProvider`, `AuthorizationFlow`, `ChoiceSet`
  - `SessionStats` (re-export), `ModelConnectionTestResult`, `ToolDefinition`

- **Runtime (`runtime.ts`):** All 30 public methods now use explicit contract return types
  - Replaced anonymous object returns with interfaces.ts types
  - Updated imports to include all new contract types

- **Duplicate imports eliminated (2 shared files):**
  - `src/runtime/provider-catalog.ts` — `builtinProviders`, `getBuiltinModels`, `getBuiltinProviders`
  - `src/runtime/custom-providers/types.ts` — `PiAiProviderProfile`

- **Utils reorganization by ownership:**
  - `src/utils/` (4 shared): `format.ts`, `limits.ts`, `stats.ts`, `version.ts`
  - `src/interactive-mode/utils/` (3 TUI-only): `ansi.ts`, `models-are-equal.ts`, `truncate.ts`

- **Tests:** Updated `test/runtime.test.ts` for `JobOutput` return type

### Verification

- ✅ `npm run check` — 206 files, no errors
- ✅ `npm run build` — 34 files, 604.99 kB
- ✅ `npm test` — 172/173 passing (1 flaky network test)

### Updated Documentation

- `TODO.md` — Added session summary, updated layout diagram, added completed checklist
