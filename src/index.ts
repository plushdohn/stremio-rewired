import { createConsola, type LogLevel } from "consola";

export { launch } from "./launch.js";

type Config = {
  manifest: Manifest;
  onStreamRequest?: (type: ContentType, id: string) => Promise<StreamResponse>;
  onCatalogRequest?: (
    type: ContentType,
    id: string,
    search?: string
  ) => Promise<CatalogResponse>;
  onMetaRequest?: (type: ContentType, id: string) => Promise<MetaResponse>;
  options?: {
    level?: LogLevel;
  };
};

type MetaResponse = {
  meta: {
    id: string;
    type: ContentType;
    name: string;
  };
};

type StreamResponse = {
  streams: Stream[];
};

type CatalogResponse = {
  metas: CatalogItem[];
};

type Stream = {
  title: string;
  url: string;
};

export type ContentType = "movie" | "series" | "channel" | "tv";

type CatalogDefinition = {
  id: string;
  type: ContentType;
  name: string;
  extra?: Array<{
    name: string;
    isRequired?: boolean;
  }>;
};

export type Video = {
  id: string;
  title: string;
  released: string;
  thumbnail?: string;
  episode?: number;
  season?: number;
};

export type CatalogItem = {
  id: string;
  type: ContentType;
  name: string;
  poster?: string;
  videos?: Array<Video>;
  background?: string;
  description?: string;
};

type Resource = "catalog" | "meta" | "stream" | "subtitles" | "addon_catalog";

type Manifest = {
  id: string;
  description: string;
  version: string;
  name: string;
  types: ContentType[];
  catalogs: (string | CatalogDefinition)[];
  resources: Resource[];
  idPrefixes?: string[];
};

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

    if (pathname === "/manifest.json") {
      return new Response(JSON.stringify(config.manifest), {
        headers: {
          "Content-Type": "application/json",
        },
      });
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

      if (!config.onStreamRequest) {
        logger.warn(
          "Your manifest says it provides streams (specified in 'manifest.types'), but you didn't provide a onStreamRequest handler. Either remove 'streams' from 'manifest.types' or provide a onStreamRequest handler."
        );

        return new Response("Not found", { status: 404 });
      }

      id = decodeURIComponent(id).replace(".json", "");

      logger.info(`Requesting stream for ${type} ${id}`);

      const streamResponse = await config.onStreamRequest(
        type as ContentType,
        id
      );

      return new Response(JSON.stringify(streamResponse), {
        headers: {
          "Content-Type": "application/json",
        },
      });
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

      if (
        !config.manifest.catalogs.some((catalog) =>
          typeof catalog === "string" ? catalog === id : catalog.id === id
        )
      ) {
        return new Response("Not found", { status: 404 });
      }

      if (!config.onCatalogRequest) {
        logger.warn(
          "Your manifest says it provides catalogs (specified in 'manifest.catalogs'), but you didn't provide a onCatalogRequest handler. Either remove 'catalogs' from 'manifest.catalogs' or provide a onCatalogRequest handler."
        );

        return new Response("Not found", { status: 404 });
      }

      id = decodeURIComponent(id).replace(".json", "");

      logger.info(
        `Requesting catalog for type: ${type} id: ${id} extra: ${extra}`
      );

      const search = extra ? extractSearchFromExtra(extra) : undefined;

      const catalogResponse = await config.onCatalogRequest(
        type as ContentType,
        id,
        search
      );

      return new Response(JSON.stringify(catalogResponse), {
        headers: {
          "Content-Type": "application/json",
        },
      });
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

      if (!config.onMetaRequest) {
        return new Response("Not found", { status: 404 });
      }

      id = decodeURIComponent(id).replace(".json", "");

      logger.info(`Requesting meta for ${type} ${id}`);

      const metaResponse = await config.onMetaRequest(type as ContentType, id);

      return new Response(JSON.stringify(metaResponse), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    return null;
  };
}

function extractSearchFromExtra(extra: string): string | undefined {
  const search = extra?.split("=")[1];

  if (!search) {
    return undefined;
  }

  return decodeURIComponent(search.replace(".json", ""));
}
