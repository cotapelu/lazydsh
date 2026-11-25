
    import { ensureProfile, runProfile } from "file:///home/quangtynu/Qcoder/lazydsh/src/runtime/dsh-boot.ts";
    import { loadLayeredEnv } from "file:///home/quangtynu/Qcoder/lazydsh/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js";
    const directory = "/home/quangtynu/Qcoder/lazydsh/lazydsh-ofm-6d1Bgt";
    globalThis.fetch = async () => { throw new Error("Network disabled in test"); };
    ensureProfile("lazydsh", ["@deepseek-ai/dsh-base"]);
    const {ctx, shutdown} = await runProfile({profile:"lazydsh",patchFiles:["/home/quangtynu/Qcoder/lazydsh/lazydsh-ofm-6d1Bgt/patch.json"],args:[],environment:loadLayeredEnv("test")});
    const runtime = ctx.get("lazydshTest");
    await runtime.open({provider:"ofm-kilo",model:"reflection/beam-free"}, {});
    const e = await runtime.efforts();
    console.log("efforts=", JSON.stringify(e));
    await shutdown.shutdown(0);
    console.log("native-ok");
  