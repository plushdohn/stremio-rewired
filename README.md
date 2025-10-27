# stremio-rewired

> [!WARNING]  
> This project is a work-in-progress and for now it's only meant for personal use (my own Stremio addons).

This project is a remake of the [stremio-addon-sdk](https://github.com/Stremio/stremio-addon-sdk) using modern Typescript features. The features provided over the original SDK are:

- **Fetch-based handler**: Allows addons to be served in serverless environments (Vercel, Netlify, Cloudflare Workers) and to serve them alongside existing fetch-compatible backend frameworks (Hono, Nitro, Elysia).
- **Improved DX and type-safety**: This SDK makes use of Typescript types were possible to further improve DX and ensure addons conform to the Stremio addon protocol.
- **ESM-first**: The SDK is written in Typescript using modern ES syntax, making it more future-proof and likely to work with modern setups.

## Missing features

This SDK is still a WIP, and as such many features from the official SDK are missing, mainly:

- **Incomplete protocol and manfiest support**: This SDK only implements a subset of the protocol and the manifest fields. I will implement more as I need them for my addons or if requested.
- **Missing subtitles support**: Subtitles are not implemented yet

## Examples

You can see an example addon implemented using this SDK in the `examples` folder. It's an actual, working published addon that I use.
