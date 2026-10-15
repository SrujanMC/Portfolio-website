import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(projectRoot, "node_modules/three/build/three.min.js");
const destination = resolve(
  projectRoot,
  "public/inner-green-assets/three.min.js",
);

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
