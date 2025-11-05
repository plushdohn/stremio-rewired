# stremio-rewired

> [!WARNING]  
> This project is a work-in-progress and for now it's only meant for personal use (my own Stremio addons).

This project is a remake of the [stremio-addon-sdk](https://github.com/Stremio/stremio-addon-sdk) using modern Typescript features. The features provided over the original SDK are:

- **Fetch-based handler**: Allows addons to be served in serverless environments (Vercel, Netlify, Cloudflare Workers) and to serve them alongside existing fetch-compatible backend frameworks (Hono, Nitro, Elysia).
- **Improved DX and type-safety**: This SDK makes use of Typescript types were possible to further improve DX and ensure addons conform to the Stremio addon protocol.
- **ESM-first**: The SDK is written in Typescript using modern ES syntax, making it more future-proof and likely to work with modern setups.

### Known issues

This SDK is still a WIP, and as such it may include bugs, especially in features that I don't personally use often. If you encounter bugs feel free to open an issue.

## Usage

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

## Launching your extension locally

Similar to the official SDK, this package also allows you to open a web version of Stremio with your addon pre-installed.

You can either do it via CLI with:

```bash
npx stremio-rewired launch
```

Which by default will expect the addon to be on the port 3000, you can specify the port like so;

```bash
npx stremio-rewired launch -p 1337
```

The typical workflow locally is to launch the extension along with your dev server in your `package.json`. So you'd have something like this:

```json
{
  "scripts": {
    "dev": "your-dev-script",
    "dev:addon": "stremio-rewired && npm run dev"
  }
}
```

### Launching programmatically

You can import the `launch` function and run it anywhere you want. This will open your default browser on Stremio with your addon installed.

```ts
import { launch } from "stremio-rewired/launch";

if (process.env.NODE_ENV === "development") {
  // Launch takes in a port, which should
  // be the same as your dev server port.
  launch(3000);
}
```
