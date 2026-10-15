import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const opaqueFrameCors = { origin: "null" };
const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  server: {
    cors: opaqueFrameCors,
  },
  preview: {
    cors: opaqueFrameCors,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(projectRoot, "index.html"),
        profileWorld: resolve(projectRoot, "profile-world.html"),
      },
    },
  },
});
