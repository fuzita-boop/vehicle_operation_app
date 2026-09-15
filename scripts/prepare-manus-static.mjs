import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const staticFiles = resolve(projectRoot, "dist", "public");
const serverSource = resolve(projectRoot, "scripts", "manus-static-server.mjs");
const serverOutput = resolve(projectRoot, "dist", "index.js");

await stat(staticFiles);
await mkdir(dirname(serverOutput), { recursive: true });
await copyFile(serverSource, serverOutput);
console.log("Prepared Manus static server entry point: dist/index.js");
