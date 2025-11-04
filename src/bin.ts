#!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import { launch } from "./launch.js";

const main = defineCommand({
  meta: {
    name: "stremio-rewired CLI",
    description: "A tool to help you develop Stremio addons",
  },
  args: {
    command: {
      type: "positional",
      description: "The command to run",
      required: true,
    },
    port: {
      type: "string",
      description: "The port the addon is served on",
      alias: "p",
      default: "3000",
    },
  },
  async run({ args }) {
    switch (args.command) {
      case "launch":
        try {
          var port = Number.parseInt(args.port);
        } catch {
          throw new Error(`Invalid port: ${args.port}`);
        }

        await launch(port);

        break;
      default:
        throw new Error(`Unknown command: ${args.command}`);
    }
  },
});

runMain(main);
