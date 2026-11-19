// Registers the .js -> .ts resolve hook (used via `node --import`).
import { register } from "node:module";

register("./ts-resolve-hook.mjs", import.meta.url);
