import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  resumeDirectoryOptions,
  resumeDirectoryTarget,
  sameDirectory,
} from "../src/resume-directory.ts";

test("resume directory choices expose the session and current directories", () => {
  const options = resumeDirectoryOptions("/work/session", "/work/current");
  assert.deepEqual(
    options.map((option) => option.value),
    ["session", "current"],
  );
  assert.deepEqual(
    options.map((option) => option.label),
    ["Session directory", "Current directory"],
  );
  assert.deepEqual(
    options.map((option) => option.description),
    ["/work/session", "/work/current"],
  );
  assert.equal(resumeDirectoryTarget("session", "/work/current"), undefined);
  assert.equal(resumeDirectoryTarget("current", "/work/current"), "/work/current");
});

test("sameDirectory resolves relative and symlinked paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "lazydsh-resume-directory-"));
  try {
    const directory = join(root, "project");
    await mkdir(directory);
    const link = join(root, "link");
    await symlink(directory, link);
    assert.equal(await sameDirectory(directory, link), true);
    assert.equal(await sameDirectory(join(directory, "..", "project"), directory), true);
    assert.equal(await sameDirectory(directory, join(root, "missing")), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
