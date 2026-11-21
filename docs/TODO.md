# TODO: Merge Boot Process Files (Corrected)

**Objective**: Consolidate boot-related files while preserving 100% boot behavior (~122ms cold start, deferred non-blocking).

**Key Insight**: The boot process is **already optimized**. Only file organization cleanup needed — no logic changes.

**Files Affected**: 5 boot files → 3 files (net -2 files)
**Risk Level**: Low (same layer, same lifecycle, tight coupling)

---

## 📋 Current Boot Files Analysis (5 Files)

### **Layer: Binary Entry (CANNOT MERGE)**
| File | Lines | Role | Why Separate |
|------|-------|------|--------------|
| `cli.ts` | 311 | Node.js entry, parse args, create patch file, call `runProfile()` | Runs **before** Cordis exists. Different process phase. |

### **Layer: Cordis Plugin (CANNOT MERGE)**
| File | Lines | Role | Why Separate |
|------|-------|------|--------------|
| `plugin.ts` | 189 | Cordis plugin, creates Runtime, launches UI/commands | Runs **inside** Cordis context. Loaded by Cordis after `runProfile()`. |

### **Layer: Shared Library (CANNOT MERGE)**
| File | Lines | Role | Why Separate |
|------|-------|------|--------------|
| `catalog.ts` | ~200 | Provider/model catalog | Used by **both** `cli.ts` (--list) and `ui.ts` (model selector). Cross-layer dependency. |

### **Layer: Boot Logic (CAN MERGE - Same Phase)**
| File | Lines | Role | Phase |
|------|-------|------|-------|
| `dsh-boot.ts` | 260 | `runProfile()`: Phase 1 core plugins, creates `DeferredPlan` | Phase 1 |
| `deferred.ts` | 298 | `selectDeferredPlugins`, `activateDeferredPlugins`, `waitForRuntimeServices`, `RUNTIME_SERVICE_NAMES` | Phase 1 & 2 |
| `pending-runtime.ts` | 40 | `createPendingRuntime()`: proxy for fullDefer mode | Phase 1 (created) / Phase 2 (attached) |

### **Layer: Runtime Core (CAN MERGE - Private Dep)**
| File | Lines | Role |
|------|-------|------|
| `runtime.ts` | 1184 | Runtime wrapper (DSH Agent → TUI API) |
| `native-commands.ts` | ~200 | Only imported by `runtime.ts:40`, called in `Runtime` constructor |

### **Layer: UI Orchestrator (RENAME ONLY)**
| File | Lines | Role |
|------|-------|------|
| `ui.ts` | 2113 | TUI orchestrator, layout, event loop |

---

## 🎯 Target Architecture (5 → 3 Boot Files + 1 Rename + 1 Unchanged)

| New/Modified File | Source Files | Action | Lines (est.) |
|-------------------|--------------|--------|--------------|
| `src/runtime/boot.ts` **(NEW)** | `dsh-boot.ts` + `deferred.ts` + `pending-runtime.ts` | **MERGE 3→1** | ~350 |
| `src/runtime/runtime.ts` | `runtime.ts` + `native-commands.ts` | **MERGE 2→1** (inline) | ~1300 |
| `src/interactive-mode/app.ts` | `ui.ts` | **RENAME** | 2113 |
| `src/cli.ts` | unchanged | **KEEP** | 311 |
| `src/plugin.ts` | unchanged | **KEEP** | 189 |
| `src/runtime/catalog.ts` | unchanged | **KEEP** | ~200 |

**Net change**: 108 → 106 files (-2)

---

## ✅ Phase 1: Create `src/runtime/boot.ts` (Merge 3 Files)

### **Content Structure**

```typescript
// src/runtime/boot.ts
// ============================================
// PHASE 1: DSH PROFILE BOOT (from dsh-boot.ts)
// ============================================
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import {
  PROFILES_DIR,
  PluginPackages,
  ProfileRuntimeResolution,
  boot,
  composeEntries,
  createRuntimeResolution,
  initProfile,
  installFailLoud,
  loadOverlayPatches,
  loadProfile,
  readProfilePatches,
  reportSkippedBundles,
  resolveProfileDir,
  type ProfileContext,
} from "@deepseek-ai/dsh-app-boot";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { installProxyFromEnvironment } from "@deepseek-ai/dsh-http-proxy";
import {
  DSH_LAUNCH_ENVIRONMENT_KEY,
  type LaunchEnvironmentSnapshot,
} from "@deepseek-ai/dsh-launch-environment";
import { provideCmdline } from "@deepseek-ai/dsh-cmdline";
import type { PatchOptions } from "@deepseek-ai/cordis-plugin-include";
import { withTelemetryExporterDisabled } from "./telemetry-patch.ts";

// ============================================
// DEFERRED PLUGIN LOGIC (from deferred.ts)
// ============================================
import type { Context as CordisContext, Plugin } from "@deepseek-ai/cordis";
import { interpolate } from "@deepseek-ai/cordis-plugin-loader";
import { isAbsolute, resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

// ---- DEFERRED ENTRY IDs (50+ tools) ----
export const DEFERRED_ENTRY_IDS: readonly string[] = [ /* ... copy from deferred.ts */ ];

// ---- Types ----
export interface DeferredPlugin {
  id: string;
  name: string;
  config?: unknown;
  inject?: unknown;
}
export interface DeferredPlan {
  rows: DeferredPlugin[];
  full: boolean;
}
interface EntryState { /* ... copy from deferred.ts */ }

// ---- Selection functions ----
export function selectDeferredPlugins(entries: readonly EntryState[]): DeferredPlugin[] { /* ... */ }
export function selectAllDeferredPlugins(entries: readonly EntryState[], baseDir?: string): DeferredPlugin[] { /* ... */ }
export function canDeferEveryRow(entries: readonly EntryState[]): boolean { /* ... */ }
export function applyDeferredPatches(rows: readonly DeferredPlugin[], patches: readonly { id?: string; config?: unknown }[]): DeferredPlugin[] { /* ... */ }
function withRowInject(module: Plugin, inject: unknown): Plugin { /* ... */ }

// ---- Runtime services ----
export const RUNTIME_SERVICE_NAMES = [
  "agents", "workingDirectory", "commands", "attachments",
  "sessionProjections", "llm", "authorization", "credentials",
  "userQuestions", "sessionTitle", "workspaceRegistry",
  "jobs", "fileReferences", "skills",
] as const;

export async function waitForRuntimeServices(ctx: CordisContext, timeoutMs = 15_000): Promise<void> { /* ... */ }

// ---- Activation ----
const ACTIVATION_TIMEOUT_MS = 5_000;
async function withinTimeout<T>(promise: PromiseLike<T>, id: string): Promise<T> { /* ... */ }
export async function activateDeferredPlugins(
  ctx: CordisContext,
  plugins: readonly DeferredPlugin[],
): Promise<void> { /* ... */ }

// ============================================
// PENDING RUNTIME (from pending-runtime.ts)
// ============================================
import type { Runtime } from "./runtime.ts";

export interface PendingRuntime {
  runtime: Runtime;
  attach(runtime: Runtime): void;
}
export function createPendingRuntime(): PendingRuntime { /* ... */ }

// ============================================
// BOOT PHASE 1: runProfile → returns ctx + shutdown + deferredPlan
// ============================================
export interface BootPhase1Options {
  environment: LaunchEnvironmentSnapshot;
  profile: string;
  patchFiles: readonly string[];
  args: readonly string[];
}

export interface BootPhase1Result {
  ctx: Context;
  shutdown: {
    shutdown(code: number): Promise<void>;
    interrupt(code: number): void;
  };
  deferredPlan: DeferredPlan;
  fullDefer: boolean;
}

export async function bootPhase1(options: BootPhase1Options): Promise<BootPhase1Result> {
  // 1. installProxyFromEnvironment
  // 2. composeProfile
  // 3. createAppReady
  // 4. createProcessShutdown
  // 5. Calculate fullDefer
  // 6. Select deferred plugins
  // 7. Create plan = { rows: deferred, full: fullDefer }
  // 8. Create resolution (ProfileRuntimeResolution or createRuntimeResolution)
  // 9. Create bootPatches (withTelemetryExporterDisabled)
  // 10. boot() with hostCtx providing:
  //     - profileContext
  //     - DSH_LAUNCH_ENVIRONMENT_KEY
  //     - lazydshDeferred = plan
  //     - PluginPackages
  //     - provideCmdline
  // 11. appReady.commit()
  // 12. return { ctx, shutdown, deferredPlan: plan, fullDefer }
}

// ============================================
// BOOT PHASE 2: afterFirstPaint hook logic
// ============================================
export interface BootPhase2Options {
  ctx: Context;
  config: {
    provider: string;
    model?: string;
    catalogDeferred?: boolean;
    customPatches?: boolean;
  };
  deferredPlan: DeferredPlan;
  fullDefer: boolean;
}

export async function bootPhase2(options: BootPhase2Options): Promise<void> {
  const { ctx, config, deferredPlan, fullDefer } = options;
  
  let rows = deferredPlan.rows;
  
  if (config.catalogDeferred) {
    const { catalog } = await import("./catalog.ts");
    if (config.model !== undefined) {
      catalog.validateRoute(config.provider, config.model, config.customPatches ? ["custom"] : []);
    }
    rows = applyDeferredPatches(rows, catalog.providerPatch());
  }
  
  const packages = ctx.get("pluginPackages") as { refresh(): Promise<void> } | undefined;
  if (packages === undefined) throw new Error("lazydsh: package resolution is unavailable");
  await packages.refresh();
  
  await activateDeferredPlugins(ctx, rows);
  await waitForRuntimeServices(ctx);
  
  // Note: pending.attach(realRuntime) is handled by caller (plugin.ts)
}
```

---

## ✅ Phase 2: Merge `native-commands.ts` into `src/runtime/runtime.ts`

### **Changes to `runtime.ts`**

```typescript
// src/runtime/runtime.ts
// ADD: inline native-commands.ts logic (remove import line 40)

export class Runtime {
  constructor(ctx: Context, options: RuntimeOptions = {}) {
    this.ctx = ctx;
    this.options = options;
    this.registerNativeCommands(ctx);  // inline function
    // ... rest unchanged
  }

  private registerNativeCommands(ctx: Context) {
    // COPY entire native-commands.ts logic here
    // Register all native DSH commands
  }
  // ... rest of class unchanged
}
```

**Delete**: `src/runtime/native-commands.ts`

---

## ✅ Phase 3: Rename `src/interactive-mode/ui.ts` → `src/interactive-mode/app.ts`

```bash
mv src/interactive-mode/ui.ts src/interactive-mode/app.ts
```

**Update all imports** in codebase:
- `./ui.ts` → `./app.ts`
- `../interactive-mode/ui.ts` → `../interactive-mode/app.ts`

---

## ✅ Phase 4: Update `src/plugin.ts` to Use `boot.ts`

### **Changes to `plugin.ts`**

```typescript
// src/plugin.ts
// REPLACE imports from dsh-boot.ts, deferred.ts, pending-runtime.ts
// WITH:
import {
  bootPhase1,
  bootPhase2,
  createPendingRuntime,
  waitForRuntimeServices,
  activateDeferredPlugins,
  type DeferredPlan,
} from "./runtime/boot.ts";
import { createRuntime } from "./runtime/runtime.ts";

// In apply():
const plan = ctx.get("lazydshDeferred") as DeferredPlan | undefined;
const fullDefer = plan?.full === true;
const pending = fullDefer ? createPendingRuntime() : undefined;
if (pending === undefined) await waitForRuntimeServices(ctx);
// ...
const afterFirstPaint = async () => {
  // ... use bootPhase2(), activateDeferredPlugins(), waitForRuntimeServices()
  pending.attach(await createRuntime(ctx, options, effort));
};
```

---

## ✅ Phase 5: Delete Old Files

```bash
rm src/runtime/dsh-boot.ts
rm src/runtime/deferred.ts
rm src/runtime/pending-runtime.ts
rm src/runtime/native-commands.ts
```

---

## ✅ Phase 6: Update All Imports

| Old Import | New Import |
|------------|------------|
| `./dsh-boot.ts` | `./boot.ts` |
| `./deferred.ts` | `./boot.ts` |
| `./pending-runtime.ts` | `./boot.ts` |
| `./native-commands.ts` | (removed, inlined) |
| `../interactive-mode/ui.ts` | `../interactive-mode/app.ts` |
| `./ui.ts` | `./app.ts` |

**Files to check/update**:
- `src/plugin.ts`
- `src/runtime/plugin-patch.ts` (if uses `DeferredPlan`)
- `src/interactive-mode/command-runner.ts` (if imports ui.ts)

---

## ✅ Verification Checklist

### 6.1 TypeScript Compilation
```bash
npm run check
```
- [ ] No type errors
- [ ] All imports resolve
- [ ] `RUNTIME_SERVICE_NAMES` exported from `boot.ts`

### 6.2 Unit Tests
```bash
npm run test
```
- [ ] All 112 tests pass
- [ ] `deferred.test.ts` passes (uses `selectDeferredPlugins`, `activateDeferredPlugins`)
- [ ] `runtime.test.ts` passes

### 6.3 Integration Tests
```bash
# CLI commands
npm run start -- --help
npm run start -- --version
npm run start -- --list
echo "test" | npm run start -- ask

# TUI launch (timeout after 5s to verify first paint)
timeout 5 npm run start 2>&1 | head -20
```

### 6.4 Performance Verification
```bash
PI_STARTUP_BENCHMARK=1 npm run start -- --version 2>&1 | grep -E "(startup|paint|ready)"
```
- [ ] Cold start ≤ 200ms (target < 500ms, currently ~122ms)
- [ ] Phase 1 ≤ 100ms
- [ ] First paint ≤ 150ms
- [ ] No "lazydsh is still starting" errors in footer

### 6.5 Functional Verification
- [ ] TUI launches: header, editor, footer visible
- [ ] `/model` selector works
- [ ] `/session` selector works
- [ ] `/bash ls` works (deferred plugin loaded)
- [ ] `/settings` works
- [ ] `/login deepseek-official` works
- [ ] `/logout deepseek-official` works
- [ ] Ctrl+C cancels turn
- [ ] `/quit` exits cleanly
- [ ] Resume session works

---

## 📊 File Count Summary

| Action | Count |
|--------|-------|
| **New files** | 1 (`src/runtime/boot.ts`) |
| **Modified files** | 3 (`runtime.ts`, `plugin.ts`, `app.ts` rename) |
| **Deleted files** | 3 (`dsh-boot.ts`, `deferred.ts`, `pending-runtime.ts`, `native-commands.ts`) |
| **Renamed files** | 1 (`ui.ts` → `app.ts`) |
| **Unchanged** | 4 (`cli.ts`, `plugin.ts` logic, `catalog.ts`) |
| **Net change** | **-2 files** (108 → 106) |

---

## ⚠️ Rollback Plan

```bash
git checkout HEAD -- src/cli.ts src/plugin.ts src/runtime/dsh-boot.ts src/runtime/deferred.ts src/runtime/pending-runtime.ts src/runtime/native-commands.ts src/runtime/runtime.ts src/interactive-mode/ui.ts
rm -f src/runtime/boot.ts
mv src/interactive-mode/app.ts src/interactive-mode/ui.ts
npm run check && npm run test
```

---

## 🎯 Success Criteria

- [ ] **All tests pass** (112/112)
- [ ] **Cold start ~122ms** (unchanged)
- [ ] **First paint works** (header, editor, footer visible)
- [ ] **Deferred plugins load** (bash, tool cards, selectors after paint)
- [ ] **No "lazydsh is still starting" errors**
- [ ] **Clean shutdown** (Ctrl+C, /quit, Ctrl+D)
- [ ] **TypeScript compiles** with no errors

---

## 📝 Key Principles (Do Not Violate)

1. **CLI ↔ Plugin boundary**: `cli.ts` runs before Cordis; `plugin.ts` runs inside Cordis. Never merge.
2. **Catalog independence**: Used by both CLI (--list) and UI. Keep separate.
3. **Defer timing**: Phase 2 MUST run AFTER first paint. `bootPhase2()` called from `afterFirstPaint` hook.
4. **Proxy pattern**: `fullDefer` creates `PendingRuntime` proxy, attaches real runtime after Phase 2.
5. **Service wait**: `waitForRuntimeServices()` polls 14 services before allowing session open.

---

**Estimated Effort**: ~3-4 hours
**Risk**: Low (same layer merges, no logic changes)
**Rollback**: Single git checkout command