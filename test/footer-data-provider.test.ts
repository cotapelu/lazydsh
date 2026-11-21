import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import {
  createFooterDataProvider,
  formatCwdForFooter,
  formatTokens,
} from "../src/interactive-mode/footer-data-provider.ts";
import { FooterComponent } from "../src/interactive-mode/footer.ts";

const plain = (component: FooterComponent, width = 100) =>
  component.render(width).map(stripVTControlCharacters).join("\n");

/** Minimal session adapter: the footer only reads these accessors. */
function footerSession() {
  return {
    sessionManager: {
      getCwd: () => "/work",
      getSessionId: () => "s-1",
      getLeafId: () => "3",
      getEntryCount: () => 1,
      getSessionName: () => "feature work",
      getEntries: () => [],
    },
    getContextUsage: () => ({ percent: 42, contextWindow: 200000 }),
  };
}

test("extension statuses set, sanitize, remove, and clear", () => {
  const provider = createFooterDataProvider("/work");
  provider.setExtensionStatus("alpha", "ok");
  provider.setExtensionStatus("beta", "multi\nline\ttext");
  assert.deepEqual([...provider.getExtensionStatuses().entries()].sort(), [
    ["alpha", "ok"],
    ["beta", "multi line text"],
  ]);
  provider.removeExtensionStatus("alpha");
  assert.deepEqual([...provider.getExtensionStatuses().keys()], ["beta"]);
  provider.setExtensionStatus("alpha", "back");
  provider.clearExtensionStatuses();
  assert.equal(provider.getExtensionStatuses().size, 0);
});

test("the footer renders the extension status row, sorted and empty-filtered", () => {
  const provider = createFooterDataProvider("/work");
  provider.setExtensionStatus("zeta", "z-task done");
  provider.setExtensionStatus("alpha", "");
  const footer = new FooterComponent({ session: footerSession(), footerData: provider });
  assert.match(plain(footer), /z-task done/);
  // Empty statuses are filtered out rather than leaving a dangling row, and
  // clearing the provider removes the line entirely.
  provider.clearExtensionStatuses();
  assert.doesNotMatch(plain(footer), /z-task done/);
});

test("the footer shows cwd, session name, and provider count context", () => {
  const provider = createFooterDataProvider("/work");
  const footer = new FooterComponent({ session: footerSession(), footerData: provider });
  assert.match(plain(footer), /feature work/);
  assert.equal(provider.getAvailableProviderCount(), 0);
  provider.setAvailableProviderCount(3);
  assert.equal(provider.getAvailableProviderCount(), 3);
});

test("token and cwd formatting stay compact", () => {
  assert.equal(formatTokens(42), "42");
  assert.equal(formatTokens(1500), "1.5k");
  assert.equal(formatTokens(15000), "15k");
  assert.equal(formatTokens(1500000), "1.5M");
  assert.equal(formatCwdForFooter("/home/me/work", "/home/me"), "~/work");
  assert.equal(formatCwdForFooter("/elsewhere", "/home/me"), "/elsewhere");
});
