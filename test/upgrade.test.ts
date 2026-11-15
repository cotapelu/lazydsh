import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { upgradeCommand, upgradePlan } from "../src/upgrade.ts";

test("upgrade prints the exact command it executes", () => {
  assert.equal(
    upgradeCommand({ manager: "npm", args: ["install", "--global", "lazydsh@latest"], cwd: "/" }),
    "npm install --global lazydsh@latest",
  );
  assert.equal(
    upgradeCommand({
      manager: "pnpm",
      args: ["add", "--save-dev", "./my package"],
      cwd: "/",
    }),
    "pnpm add --save-dev './my package'",
  );
});

test("Vite+ global upgrades target the registered installation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lazydsh-vp-upgrade-"));
  try {
    for (const layout of ["lib/node_modules", "node_modules"]) {
      const installed = join(
        directory,
        "custom-vp-data",
        "packages",
        "lazydsh",
        "install-id",
        layout,
        "lazydsh",
      );
      await mkdir(installed, { recursive: true });
      const plan = await upgradePlan(installed, async (command, args) => {
        assert.equal(command, "vp");
        assert.deepEqual(args, ["list", "--global", "lazydsh", "--json"]);
        return JSON.stringify([{ name: "lazydsh", installId: "install-id" }]);
      });
      assert.equal(plan.manager, "vp");
      assert.deepEqual(plan.args, ["update", "--global", "--latest", "lazydsh"]);
      assert.equal(plan.cwd, await realpath(join(directory, "custom-vp-data", "packages")));
      await assert.rejects(
        upgradePlan(installed, async () =>
          JSON.stringify([{ name: "lazydsh", installId: "other" }]),
        ),
        /verify the Vite\+ global installation/,
      );
      await assert.rejects(
        upgradePlan(installed, async () => {
          throw new Error("missing vp");
        }),
        /vp is available/,
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("upgrade identifies each original global package manager without changing installations", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lazydsh-upgrade-"));
  try {
    for (const manager of ["npm", "bun", "pnpm", "yarn"] as const) {
      const root = join(directory, manager);
      const installed = join(root, "node_modules", "lazydsh");
      await mkdir(installed, { recursive: true });
      const plan = await upgradePlan(installed, async (command) => {
        if (command !== manager) throw new Error("Not installed");
        return manager === "bun"
          ? `${root} node_modules (1 installed)`
          : manager === "yarn"
            ? root
            : join(root, "node_modules");
      });
      assert.equal(plan.manager, manager);
      assert.deepEqual(
        plan.args,
        manager === "bun"
          ? ["update", "--global", "--latest", "lazydsh"]
          : [manager === "npm" ? "install" : "add", "--global", "lazydsh@latest"],
      );
      assert.ok(plan.cwd.endsWith(manager));
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("local upgrades retain dependency scope and reject ambiguous managers and temporary installs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lazydsh-upgrade-local-"));
  try {
    const installed = join(directory, "node_modules", "lazydsh");
    await mkdir(installed, { recursive: true });
    const query = async () => {
      throw new Error("No global installation");
    };
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({ packageManager: "bun@1.3.13", devDependencies: { lazydsh: "0.1.0" } }),
    );
    const plan = await upgradePlan(installed, query);
    assert.equal(plan.manager, "bun");
    assert.deepEqual(plan.args, ["update", "--latest", "lazydsh"]);
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({ packageManager: "pnpm@10.0.0", devDependencies: { lazydsh: "0.1.0" } }),
    );
    const vpLocal = await upgradePlan(installed, query);
    assert.equal(vpLocal.manager, "pnpm");
    assert.deepEqual(vpLocal.args, ["add", "--save-dev", "lazydsh@latest"]);
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({ dependencies: { lazydsh: "0.1.0" } }),
    );
    await assert.rejects(upgradePlan(installed, query), /determine the original package manager/);
    await writeFile(join(directory, "package-lock.json"), "{}");
    assert.equal((await upgradePlan(installed, query)).manager, "npm");
    await writeFile(join(directory, "bun.lock"), "{}");
    await assert.rejects(upgradePlan(installed, query), /determine the original package manager/);
    await assert.rejects(upgradePlan(directory, query), /Source\/link/);
    const temporary = join(directory, "_npx", "123", "node_modules", "lazydsh");
    await mkdir(temporary, { recursive: true });
    await assert.rejects(upgradePlan(temporary, query), /Temporary installs/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
