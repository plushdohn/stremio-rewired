import { defineConfig } from "tsdown/config";

export default defineConfig({
  entry: ["./src/index.ts", "./src/launch.ts", "./src/bin.ts"],
  exports: true,
  dts: true,
});
