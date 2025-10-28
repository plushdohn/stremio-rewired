# stremio-rewired

> [!WARNING]  
> This project is a work-in-progress and for now it's only meant for personal use (my own Stremio addons).

This project is a remake of the [stremio-addon-sdk](https://github.com/Stremio/stremio-addon-sdk) using modern Typescript features. The features provided over the original SDK are:

- **Fetch-based handler**: Allows addons to be served in serverless environments (Vercel, Netlify, Cloudflare Workers) and to serve them alongside existing fetch-compatible backend frameworks (Hono, Nitro, Elysia).
- **Improved DX and type-safety**: This SDK makes use of Typescript types were possible to further improve DX and ensure addons conform to the Stremio addon protocol.
- **ESM-first**: The SDK is written in Typescript using modern ES syntax, making it more future-proof and likely to work with modern setups.

## Missing features

This SDK is still a WIP, and as such many features from the official SDK are missing, mainly:

- **Incomplete protocol and manifest support**: This SDK only implements a subset of the protocol and the manifest fields. Some very important fields such as `behaviorHints` are not supported so beware. I will implement more as I need them for my addons or if requested.
- **Missing subtitles support**: Subtitles are not implemented yet

## Basic usage

The SDK exports a `createHandler` function thats returns a standard Fetch handler, here's an example using Cloudflare Workers:

```ts
import { createHandler } from "stremio-rewired";

export default {
  async fetch(request: Request) {
    const handle = createHandler({
      manifest: {
        id: "org.stremio.my-addon",
        version: "0.0.2",
        name: "My Addon",
        description: "This is a cool addon",
        // rest of manifest
      },
      onCatalogRequest(type, id) {
        // handle catalog request

        return {
          metas: [
            /* ... */
          ],
        };
      },
      onStreamRequest(type, id) {
        // handle stream request

        return {
          streams: [
            /* ... */
          ],
        };
      },
    });

    const response = await handle(request);

    if (!response) {
      return new Response("Not found", { status: 404 });
    }

    return response;
  },
};
```

For more details on what each handler should return see the official SDK's [protocol](https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/protocol.md) specification.

### Launching your extension locally

Similar to the official SDK, this package also allows you to open a web version of Stremio with your addon pre-installed.

You can import the `launch` and run it anywhere you want (likely at the start of your dev server)

```ts
import { launch } from "stremio-rewired";

if (process.env.NODE_ENV === "development") {
  // Launch takes in a port, which should
  // be the same as your dev server port.
  launch(3000);
}
```

## Examples

Addons that use this SDK:

- [Unity](https://github.com/plushdohn/stremio-addon-unity)
