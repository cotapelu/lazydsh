import {
  ensureProfile,
  runProfile,
} from "file:///home/quangtynu/Qcoder/lazydsh/src/runtime/dsh-boot.ts";
import { loadLayeredEnv } from "file:///home/quangtynu/Qcoder/lazydsh/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js";
const directory = "/home/quangtynu/Qcoder/lazydsh/lazydsh-ofm-WxyLH6";
globalThis.fetch = async () => {
  throw new Error("Network disabled in test");
};
ensureProfile("lazydsh", ["@deepseek-ai/dsh-base"]);
const { ctx, shutdown } = await runProfile({
  profile: "lazydsh",
  patchFiles: ["/home/quangtynu/Qcoder/lazydsh/lazydsh-ofm-WxyLH6/patch.json"],
  args: [],
  environment: loadLayeredEnv("test"),
});
const runtime = ctx.get("lazydshTest");
await runtime.open({ provider: "ofm-kilo", model: "reflection/beam-free" }, {});
await runtime.authenticate(undefined, { provider: "ofm-kilo", onAuth: async () => "x" });
console.log("source=", JSON.stringify(await runtime.credentialSource("ofm-kilo")));
try {
  const r = await runtime.run("hi");
  console.log("run=", JSON.stringify(r));
} catch (e) {
  console.log("runerr=", e && e.message);
}
await shutdown.shutdown(0);
console.log("native-ok");
