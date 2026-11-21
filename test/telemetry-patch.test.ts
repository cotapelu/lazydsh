import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { withTelemetryExporterDisabled } from "../src/runtime/telemetry-patch.ts";

test("telemetry opt-out also disables the otherwise unused OTel exporter", () => {
  const patches = [{ id: "session-telemetry-otel", disabled: true }, { id: "llm" }];
  const patched = withTelemetryExporterDisabled(patches, "1");
  assert.deepEqual(patched, [...patches, { id: "otel", disabled: true }]);
  assert.deepEqual(patches, [{ id: "session-telemetry-otel", disabled: true }, { id: "llm" }]);
  assert.deepEqual(withTelemetryExporterDisabled(patches, undefined), patches);
  assert.deepEqual(withTelemetryExporterDisabled(patches, ""), patches);
});

test("telemetry patching leaves compositions without the stack or with a user override alone", () => {
  const withoutStack = [{ id: "llm" }];
  assert.equal(withTelemetryExporterDisabled(withoutStack, "1"), withoutStack);
  const overridden = [{ id: "session-telemetry-otel" }, { id: "otel", disabled: false }];
  assert.equal(withTelemetryExporterDisabled(overridden, "1"), overridden);
});
