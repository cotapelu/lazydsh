// Adapted from @deepseek-ai/dsh 0.2.2-rc.2 (MIT, Copyright (c) 2026 DeepSeek).
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import {
  PluginPackages,
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
import { withTelemetryExporterDisabled } from "./telemetry-patch.ts";
import { selectDeferredPlugins } from "./deferred.ts";

const NAME = "lazydsh";
const PROCESS_SHUTDOWN_TIMEOUT_MS = 5_000;

export const INSTALL_ANCHOR = fileURLToPath(new URL("../package.json", import.meta.url));

const PROFILE_ROOT_FILENAME = "cordis.yml";

export interface RunProfileOptions {
  environment: LaunchEnvironmentSnapshot;
  profile: string;
  patchFiles: readonly string[];
  args: readonly string[];
}

export function ensureProfile(
  name: string,
  bundles: readonly string[],
  home = resolveDshHome(),
): string {
  const dir = resolveProfileDir(name, home);
  if (!existsSync(join(dir, "package.json"))) initProfile(dir, [...bundles]);
  return dir;
}

function createProcessShutdown(dispose: () => Promise<void>) {
  let pending: Promise<void> | undefined;
  const start = (code: number, interrupt: boolean) => {
    const timeout = setTimeout(() => process.exit(code), PROCESS_SHUTDOWN_TIMEOUT_MS);
    pending = Promise.resolve()
      .then(dispose)
      .then(
        () => {
          clearTimeout(timeout);
          if (interrupt) process.exit(code);
          process.exitCode = code;
        },
        () => process.exit(code),
      );
    return pending;
  };
  return {
    shutdown(code: number) {
      return pending ?? start(code, false);
    },
    interrupt(code: number) {
      if (pending) process.exit(code);
      void start(code, true);
    },
  };
}

function createAppReady() {
  let ready = false;
  const listeners = new Set<() => void>();
  return {
    service: {
      onReady(listener: () => void) {
        if (ready) {
          listener();
          return () => {};
        }
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    commit() {
      if (ready) return;
      ready = true;
      const pending = [...listeners];
      for (const listener of pending) listener();
      listeners.clear();
    },
  };
}

async function composeProfile(name: string, patchFiles: readonly string[]) {
  const profile = loadProfile(NAME, name, INSTALL_ANCHOR, undefined, { userLayer: true });
  reportSkippedBundles(NAME, profile);
  writeFileSync(join(profile.dir, PROFILE_ROOT_FILENAME), "[]\n");
  return {
    profile,
    resolution: await createRuntimeResolution({ installAnchor: INSTALL_ANCHOR, profile }),
    overlays: patchFiles.flatMap((file) => loadOverlayPatches(NAME, resolve(file))),
  };
}

function userAgentProfile(name: string): string {
  return encodeURIComponent(name).replace(
    /[()]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export async function runProfile(options: RunProfileOptions) {
  process.env.DSH_USER_AGENT_SUFFIX = `dsh-profile/${userAgentProfile(options.profile)}`;
  const disposeProxy = await installProxyFromEnvironment(options.environment, (message) => {
    process.stderr.write(`${NAME}: ${message}\n`);
  });
  let app: Context | undefined;
  let disposal: Promise<void> | undefined;
  const dispose = () =>
    (disposal ??= (async () => {
      const failures: unknown[] = [];
      for (const release of [() => app?.fiber.dispose(), disposeProxy]) {
        try {
          await release();
        } catch (error) {
          failures.push(error);
        }
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1)
        throw new AggregateError(failures, `${NAME}: profile cleanup failed`);
    })());
  try {
    const composed = await composeProfile(options.profile, options.patchFiles);
    const appReady = createAppReady();
    const shutdown = createProcessShutdown(dispose);
    let interrupted = false;
    const interrupt = (code: number) => {
      interrupted = true;
      shutdown.interrupt(code);
    };
    process.on("SIGTERM", () => {
      interrupt(0);
    });
    process.on("SIGINT", () => {
      interrupt(130);
    });
    installFailLoud(NAME, process, async () => {
      await app?.fiber.dispose();
    });
    const rootConfig = join(composed.profile.dir, PROFILE_ROOT_FILENAME);
    const profileContext: ProfileContext = {
      name: options.profile,
      dir: composed.profile.dir,
      patchPath: composed.profile.patchPath,
      installAnchor: INSTALL_ANCHOR,
      startedBundles: composed.profile.layers.map((layer) => layer.packageName),
      cwd: process.cwd(),
      home: resolveDshHome(),
      overlays: composed.overlays,
      telemetryDisabledEnv: process.env.DSH_TELEMETRY_DISABLED,
    };
    const patches = withTelemetryExporterDisabled(
      readProfilePatches(NAME, profileContext, composed.profile),
      process.env.DSH_TELEMETRY_DISABLED,
    );
    const entries = composeEntries([patches]);
    const appEntry = entries.find((entry) => entry.id === "lazydsh");
    const deferred = appEntry?.config?.command === undefined ? selectDeferredPlugins(entries) : [];
    if (appEntry !== undefined && deferred.length > 0) {
      patches.push({ id: "lazydsh", config: { ...appEntry.config, deferred } });
      patches.push(...deferred.map((plugin) => ({ id: plugin.id, disabled: true })));
    }
    const ctx = await boot(NAME, rootConfig, patches, async (hostCtx) => {
      app = hostCtx;
      hostCtx.provide("profileContext", profileContext);
      hostCtx.provide(DSH_LAUNCH_ENVIRONMENT_KEY, options.environment);
      await hostCtx.plugin(PluginPackages, { resolution: composed.resolution });
      provideCmdline(hostCtx, {
        args: options.args,
        exit: (code) => void shutdown.shutdown(code),
        ready: appReady.service,
      });
    });
    app = ctx;
    if (!interrupted && ctx.fiber.state === 2 && ctx.get("loader") !== undefined) appReady.commit();
    return { ctx, shutdown };
  } catch (error) {
    try {
      await dispose();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        `${NAME}: profile startup and cleanup failed`,
      );
    }
    throw error;
  }
}
