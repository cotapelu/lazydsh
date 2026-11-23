import { test } from "vite-plus/test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { providerPatch } from "../src/runtime/catalog.ts";
import { profilePatch } from "../src/runtime/plugin-patch.ts";

const exec = promisify(execFile);
const executable = process.execPath;
const moduleUrl = (path: string) => pathToFileURL(resolve(path)).href;

test("kilo auth", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lazydsh-kiloauth-"));
  const patch = join(directory, "patch.json");
  const driver = join(directory, "driver.mjs");
  await writeFile(
    patch,
    JSON.stringify([
      ...providerPatch(),
      ...profilePatch("lazydshTest"),
      { insert: [{ name: resolve("test/fixtures/native-runtime.ts") }] },
    ]),
  );
  await writeFile(
    driver,
    `
    import { ensureProfile, runProfile } from ${JSON.stringify(moduleUrl("src/runtime/dsh-boot.ts"))};
    import { loadLayeredEnv } from ${JSON.stringify(import.meta.resolve("@deepseek-ai/dsh-app-boot"))};
    const directory = ${JSON.stringify(directory)};
    globalThis.fetch = async () => { throw new Error("Network disabled in test"); };
    ensureProfile("lazydsh", ["@deepseek-ai/dsh-base"]);
    const {ctx, shutdown} = await runProfile({profile:"lazydsh",patchFiles:[${JSON.stringify(patch)}],args:[],environment:loadLayeredEnv("test")});
    const runtime = ctx.get("lazydshTest");
    await runtime.open({provider:"kilo",model:"qwen/qwen3.5-397b-a17b"}, { onAuth: async () => "test-kilo-key" });
    await runtime.authenticate(undefined, { provider: "kilo", onAuth: async () => "test-kilo-key" });
    console.log("source=", JSON.stringify(await runtime.credentialSource("kilo")));
    console.log("has=", await runtime.hasCredentials("kilo"));
    try { const r = await runtime.run("hi"); console.log("run=", JSON.stringify(r)); }
    catch(e){ console.log("runerr=", e && e.message); }
    await shutdown.shutdown(0);
    console.log("native-ok");
  `,
  );
  try {
    const result = await exec(executable, [driver], {
      cwd: process.cwd(),
      timeout: 90000,
      maxBuffer: 1024 * 1024,
      env: {
        PATH: process.env.PATH,
        HOME: directory,
        DSH_HOME: join(directory, "home"),
        TEST_WORKSPACE: directory,
        DSH_TELEMETRY_DISABLED: "1",
        NODE_OPTIONS: "--import=" + pathToFileURL(resolve("test/ts-resolve-preload.mjs")).href,
      },
    });
    console.log("STDOUT>>" + result.stdout + "<<");
    console.log(result.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
