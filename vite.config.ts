import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/cli.ts", "src/plugin.ts", "src/runtime/dsh-boot.ts"],
    platform: "node",
    format: "esm",
    target: "node24",
    clean: true,
  },
  test: { include: ["test/**/*.test.ts"], testTimeout: 120_000 },
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
});
