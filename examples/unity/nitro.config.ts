import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  compatibilityDate: "2025-10-25",
  srcDir: "./src",
  routeRules: {
    "/**": {
      cors: true,
    },
  },
});
