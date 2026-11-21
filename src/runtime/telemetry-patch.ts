import type { PatchOptions } from "@deepseek-ai/cordis-plugin-include";

/**
 * DSH's telemetry opt-out disables the OTel consumer but leaves the exporter
 * row mounted. Nothing else consumes that exporter, and loading it pulls in
 * `got` plus the OpenTelemetry SDK, so honor the same opt-out for both rows.
 *
 * The consumer row is the signal that the composition actually carries the
 * telemetry stack; profiles without it are left untouched. An entry the user
 * already patched is never overridden.
 */
export function withTelemetryExporterDisabled(
  patches: PatchOptions[],
  disabledEnv: string | undefined,
): PatchOptions[] {
  if ((disabledEnv ?? "") === "") return patches;
  if (!patches.some((patch) => patch.id === "session-telemetry-otel")) return patches;
  if (patches.some((patch) => patch.id === "otel")) return patches;
  return [...patches, { id: "otel", disabled: true }];
}
