import { OpenCode } from "@opencode/client/promise";
import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const { stdout } = await execAsync("opencode service start", { timeout: 30000 });
const url = /https?:\/\/[^\s]+/.exec(stdout)?.[0];
const password = JSON.parse(
  await readFile(
    join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "opencode", "service.json"),
    "utf8",
  ),
).password;
const sdk = OpenCode.make({
  baseUrl: url,
  headers: { Authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` },
});

const model = process.argv[2] || "seaglass-alpha-free";
console.log("service", url, "model", model);

const controller = new AbortController();
setTimeout(() => {
  console.log("HARD TIMEOUT");
  controller.abort();
  process.exit(3);
}, 90000);

const events = sdk.event.subscribe({ signal: controller.signal });
const session = await sdk.session.create({
  model: { id: model, providerID: "opencode" },
  agent: "build",
});
const sessionID = session.id;
console.log("session", sessionID);

sdk.session.prompt({ sessionID, text: "reply with just: PONG" }).then(
  () => console.log("prompt resolved"),
  (e) => console.log("prompt REJECTED", e?.message),
);

let count = 0;
for await (const ev of events) {
  const data = ev?.data;
  const mine = data?.sessionID === sessionID;
  console.log(count++, ev.type, mine ? "(mine)" : "(other " + data?.sessionID + ")");
  if (mine && (ev.type === "session.idle" || ev.type === "session.step.failed")) {
    console.log("TERMINAL", ev.type);
    break;
  }
}
console.log("loop ended, count=", count);
controller.abort();
process.exit(0);
