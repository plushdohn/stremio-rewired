import { createConsola } from "consola";
import type {
  Config,
  ContentType,
  CatalogExtraArgs,
  SubtitlesExtraArgs,
  ConfigValues,
  CacheHeaders,
} from "./types.js";

export type {
  ContentType,
  Video,
  CatalogItem,
  Stream,
  Meta,
  Manifest,
  Subtitle,
  AddonCatalogItem,
  Config,
  StreamResponse,
  CatalogResponse,
  MetaResponse,
  SubtitlesResponse,
  AddonCatalogResponse,
} from "./types.js";

function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function createJsonResponse(
  data: unknown,
  cacheHeaders?: CacheHeaders
): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getCorsHeaders(),
  };

  if (cacheHeaders) {
    if (cacheHeaders.cacheMaxAge !== undefined) {
      headers["Cache-Control"] = `max-age=${cacheHeaders.cacheMaxAge}`;
    }
    if (cacheHeaders.staleRevalidate !== undefined) {
      const existing = headers["Cache-Control"] || "";
      headers["Cache-Control"] = existing
        ? `${existing}, stale-while-revalidate=${cacheHeaders.staleRevalidate}`
        : `stale-while-revalidate=${cacheHeaders.staleRevalidate}`;
    }
    if (cacheHeaders.staleError !== undefined) {
      const existing = headers["Cache-Control"] || "";
      headers["Cache-Control"] = existing
        ? `${existing}, stale-if-error=${cacheHeaders.staleError}`
        : `stale-if-error=${cacheHeaders.staleError}`;
    }
  }

  return new Response(JSON.stringify(data), { headers });
}

function parseQueryString(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = queryString.split("&");
  for (const pair of pairs) {
    const [key, value] = pair.split("=");
    if (key && value) {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  }
  return params;
}

function parseConfig(request: Request): ConfigValues | undefined {
  const url = new URL(request.url);
  const configParam = url.searchParams.get("config");
  if (configParam) {
    try {
      return JSON.parse(decodeURIComponent(configParam)) as ConfigValues;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function hasResource(
  manifest: Config["manifest"],
  resourceName: string
): boolean {
  return manifest.resources.some((resource) => {
    if (typeof resource === "string") {
      return resource === resourceName;
    }
    return resource.name === resourceName;
  });
}

export function createHandler(config: Config) {
  const logger = createConsola({
    defaults: {
      tag: "stremio-rewired",
    },
    level: config.options?.level || 0,
  });

  return async function handle(request: Request): Promise<Response | null> {
    const pathname = new URL(request.url).pathname;

    logger.info(`Pathname: ${pathname}`);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(),
      });
    }

    if (pathname === "/manifest.json") {
      return createJsonResponse(config.manifest);
    }

    if (pathname.match(/^\/stream\/(movie|series|channel|tv)\/.+\.json$/)) {
      logger.info(`Handling stream request for ${pathname}`);

      let [_, type, id] = pathname.split("/").slice(1);

      if (!type || !id) {
        return new Response("Bad request", { status: 400 });
      }

      if (!config.manifest.types.includes(type as ContentType)) {
        return new Response("Not found", { status: 404 });
      }

      if (!hasResource(config.manifest, "stream")) {
        return new Response("Not found", { status: 404 });
      }

      if (!config.onStreamRequest) {
        logger.warn(
          "Your manifest says it provides streams (specified in 'manifest.resources'), but you didn't provide a onStreamRequest handler. Either remove 'stream' from 'manifest.resources' or provide a onStreamRequest handler."
        );

        return new Response("Not found", { status: 404 });
      }

      id = decodeURIComponent(id).replace(".json", "");

      logger.info(`Requesting stream for ${type} ${id}`);

      const userConfig = parseConfig(request);
      const streamResponse = await config.onStreamRequest(
        type as ContentType,
        id,
        userConfig
      );

      return createJsonResponse(streamResponse, streamResponse);
    }

    if (pathname.match(/^\/catalog\/(movie|series|channel|tv)\/.+\.json$/)) {
      logger.info(`Handling catalog request for ${pathname}`);

      let [_, type, id, extra] = pathname.split("/").slice(1);

      if (!type || !id) {
        return new Response("Bad request", { status: 400 });
      }

      if (!config.manifest.types.includes(type as ContentType)) {
        return new Response("Not found", { status: 404 });
      }

      if (!hasResource(config.manifest, "catalog")) {
        return new Response("Not found", { status: 404 });
      }

      id = decodeURIComponent(id).replace(".json", "");

      if (
        !config.manifest.catalogs.some((catalog) =>
          typeof catalog === "string" ? catalog === id : catalog.id === id
        )
      ) {
        return new Response("Not found", { status: 404 });
      }

      if (!config.onCatalogRequest) {
        logger.warn(
          "Your manifest says it provides catalogs (specified in 'manifest.catalogs'), but you didn't provide a onCatalogRequest handler. Either remove 'catalog' from 'manifest.resources' or provide a onCatalogRequest handler."
        );

        return new Response("Not found", { status: 404 });
      }

      logger.info(
        `Requesting catalog for type: ${type} id: ${id} extra: ${extra}`
      );

      let extraArgs: CatalogExtraArgs | undefined;
      if (extra) {
        extraArgs = parseCatalogExtraArgs(extra);
      }

      const userConfig = parseConfig(request);
      const catalogResponse = await config.onCatalogRequest(
        type as ContentType,
        id,
        extraArgs,
        userConfig
      );

      return createJsonResponse(catalogResponse, catalogResponse);
    }

    if (pathname.match(/^\/meta\/(movie|series|channel|tv)\/.+\.json$/)) {
      logger.info(`Handling meta request for ${pathname}`);

      let [_, type, id] = pathname.split("/").slice(1);

      if (!type || !id) {
        return new Response("Bad request", { status: 400 });
      }

      if (!config.manifest.types.includes(type as ContentType)) {
        return new Response("Not found", { status: 404 });
      }

      if (!hasResource(config.manifest, "meta")) {
        return new Response("Not found", { status: 404 });
      }

      if (!config.onMetaRequest) {
        return new Response("Not found", { status: 404 });
      }

      id = decodeURIComponent(id).replace(".json", "");

      logger.info(`Requesting meta for ${type} ${id}`);

      const userConfig = parseConfig(request);
      const metaResponse = await config.onMetaRequest(
        type as ContentType,
        id,
        userConfig
      );

      return createJsonResponse(metaResponse, metaResponse);
    }

    if (pathname.match(/^\/subtitles\/(movie|series|channel|tv)\/.+\.json$/)) {
      logger.info(`Handling subtitles request for ${pathname}`);

      let [_, type, id] = pathname.split("/").slice(1);

      if (!type || !id) {
        return new Response("Bad request", { status: 400 });
      }

      if (!config.manifest.types.includes(type as ContentType)) {
        return new Response("Not found", { status: 404 });
      }

      if (!hasResource(config.manifest, "subtitles")) {
        return new Response("Not found", { status: 404 });
      }

      if (!config.onSubtitlesRequest) {
        return new Response("Not found", { status: 404 });
      }

      id = decodeURIComponent(id).replace(".json", "");

      const url = new URL(request.url);
      const extraArgs: SubtitlesExtraArgs = {};
      const videoId = url.searchParams.get("videoId");
      const videoSize = url.searchParams.get("videoSize");
      if (videoId) extraArgs.videoId = videoId;
      if (videoSize) {
        const parsedSize = parseInt(videoSize, 10);
        if (!isNaN(parsedSize)) {
          extraArgs.videoSize = parsedSize;
        }
      }

      logger.info(`Requesting subtitles for ${type} ${id}`);

      const userConfig = parseConfig(request);
      const subtitlesResponse = await config.onSubtitlesRequest(
        type as ContentType,
        id,
        Object.keys(extraArgs).length > 0 ? extraArgs : undefined,
        userConfig
      );

      return createJsonResponse(subtitlesResponse, subtitlesResponse);
    }

    if (
      pathname.match(/^\/addon_catalog\/(movie|series|channel|tv)\/.+\.json$/)
    ) {
      logger.info(`Handling addon catalog request for ${pathname}`);

      let [_, type, id] = pathname.split("/").slice(1);

      if (!type || !id) {
        return new Response("Bad request", { status: 400 });
      }

      if (!config.manifest.types.includes(type as ContentType)) {
        return new Response("Not found", { status: 404 });
      }

      if (!hasResource(config.manifest, "addon_catalog")) {
        return new Response("Not found", { status: 404 });
      }

      id = decodeURIComponent(id).replace(".json", "");

      if (
        !config.manifest.addonCatalogs?.some(
          (catalog) => catalog.id === id && catalog.type === type
        )
      ) {
        return new Response("Not found", { status: 404 });
      }

      if (!config.onAddonCatalogRequest) {
        return new Response("Not found", { status: 404 });
      }

      logger.info(`Requesting addon catalog for type: ${type} id: ${id}`);

      const userConfig = parseConfig(request);
      const addonCatalogResponse = await config.onAddonCatalogRequest(
        type as ContentType,
        id,
        userConfig
      );

      return createJsonResponse(addonCatalogResponse, addonCatalogResponse);
    }

    return null;
  };
}

function parseCatalogExtraArgs(extra: string): CatalogExtraArgs {
  const args: CatalogExtraArgs = {};
  const queryString = extra.replace(".json", "");
  const params = parseQueryString(queryString);

  if (params.search) {
    args.search = params.search;
  }
  if (params.genre) {
    args.genre = params.genre;
  }
  if (params.skip) {
    const skip = parseInt(params.skip, 10);
    if (!isNaN(skip)) {
      args.skip = skip;
    }
  }

  for (const [key, value] of Object.entries(params)) {
    if (!["search", "genre", "skip"].includes(key)) {
      args[key] = value;
    }
  }

  return args;
}
