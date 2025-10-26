import { defineConfig } from "tsdown/config";

export default defineConfig({
  entry: "./src/index.ts",
  exports: {
    devExports: true,
  },
  dts: true,
});
