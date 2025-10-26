import { logger } from "./log.js";

export { launch } from "./launch.js";

type Config = {
  manifest: Manifest;
  onStreamRequest?: (type: ContentType, id: string) => Promise<StreamResponse>;
  onCatalogRequest?: (
    type: ContentType,
    id: string,
    search?: string
  ) => Promise<CatalogResponse>;
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

type ContentType = "movie" | "series" | "channel" | "tv";

type CatalogDefinition = {
  id: string;
  type: ContentType;
  name: string;
  extra?: Array<{
    name: string;
    isRequired?: boolean;
  }>;
  idPrefixes?: string[];
};

type CatalogItem = {
  id: string;
  type: ContentType;
  name: string;
  poster?: string;
};

type Resource = "catalog" | "stream" | "media" | "subtitles" | "addon_catalog";

type Manifest = {
  id: string;
  description: string;
  version: string;
  name: string;
  types: ContentType[];
  catalogs: (string | CatalogDefinition)[];
  resources: Resource[];
};

export function createHandler(config: Config) {
  return async function handle(request: Request): Promise<Response> {
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
      const [_, type, id, extra] = pathname.split("/").slice(1);

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

    return new Response("Not found", { status: 404 });
  };
}

function extractSearchFromExtra(extra: string): string | undefined {
  const search = extra?.split("=")[1];

  if (!search) {
    return undefined;
  }

  return search.replace(".json", "");
}
