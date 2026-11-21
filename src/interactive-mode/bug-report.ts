import type { Runtime } from "../runtime/runtime.ts";
import type { RuntimeOptions } from "../interfaces.ts";
import { packageVersion } from "../utils/version.ts";

/** /bug: report a bug with crash details. */
export async function reportBug(
  runtime: Runtime,
  options: RuntimeOptions & { cwd: string },
  description: string,
): Promise<string> {
  const lines: string[] = [
    `## lazydsh Bug Report`,
    ``,
    `**Version:** ${packageVersion()}`,
    `**Node:** ${process.version}`,
    `**Platform:** ${process.platform} ${process.arch}`,
    `**Date:** ${new Date().toISOString()}`,
    ``,
    `### Description`,
    description || "(no description provided)",
    ``,
    `### Runtime Info`,
    ``,
  ];
  if (runtime.session) {
    const sel = runtime.selection();
    lines.push(
      `- Session: ${runtime.session.id}`,
      `- Model: ${sel?.provider ?? "unknown"} / ${sel?.model ?? "unknown"}`,
      `- Effort: ${sel?.effort ?? "default"}`,
      `- CWD: ${options.cwd}`,
    );
  } else {
    lines.push(`- No active session`);
  }
  lines.push(
    ``,
    `### Environment`,
    `- DSH_HOME: ${process.env.DSH_HOME ?? "(default)"}`,
    `- LAZYDSH_HOME: ${process.env.LAZYDSH_HOME ?? "(default)"}`,
    `- TERM: ${process.env.TERM ?? "unknown"}`,
    `- COLORTERM: ${process.env.COLORTERM ?? "unknown"}`,
    ``,
    `---`,
    `*This issue was filed automatically via \`/bug\` in lazydsh.*`,
  );
  const body = lines.join("\n");
  const url = `https://github.com/nuskey8/lazydsh/issues/new?template=bug_report.yml&title=${encodeURIComponent(
    `[Bug] ${description?.slice(0, 50) || "Bug report"}`,
  )}&body=${encodeURIComponent(body)}`;
  const { default: open } = await import("open");
  await open(url);
  return url;
}
