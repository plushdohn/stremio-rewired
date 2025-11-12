import type { LogLevel } from "consola";

export type ContentType = "movie" | "series" | "channel" | "tv";

export type Resource =
  | "catalog"
  | "meta"
  | "stream"
  | "subtitles"
  | "addon_catalog";

export type MetaLink = {
  name: string;
  category: string;
  url: string;
};

export type Subtitle = {
  id: string;
  url: string;
  lang: string;
};

export type StreamBehaviorHints = {
  countryWhitelist?: string[];
  notWebReady?: boolean;
  bingeGroup?: string;
  proxyHeaders?: {
    request?: Record<string, string>;
    response?: Record<string, string>;
  };
  videoHash?: string;
  videoSize?: number;
  filename?: string;
};

export type Stream = {
  url?: string;
  ytId?: string;
  infoHash?: string;
  fileIdx?: number;
  externalUrl?: string;
  name?: string;
  title?: string;
  description?: string;
  subtitles?: Subtitle[];
  sources?: string[];
  behaviorHints?: StreamBehaviorHints;
};

export type Video = {
  id: string;
  title: string;
  released: string;
  thumbnail?: string;
  episode?: number;
  season?: number;
  overview?: string;
  streams?: Stream[];
  available?: boolean;
  trailers?: Stream[];
};

export type CatalogExtraProperty = {
  name: string;
  isRequired?: boolean;
  options?: string[];
  optionsLimit?: number;
};

export type CatalogDefinition = {
  id: string;
  type: ContentType;
  name: string;
  extra?: CatalogExtraProperty[];
};

export type AddonCatalogDefinition = {
  type: ContentType;
  id: string;
  name: string;
};

export type ResourceDefinition = {
  name: string;
  types?: ContentType[];
  idPrefixes?: string[];
};

export type ManifestBehaviorHints = {
  adult?: boolean;
  p2p?: boolean;
  configurable?: boolean;
  configurationRequired?: boolean;
};

export type ConfigField = {
  key: string;
  type: "text" | "number" | "password" | "checkbox" | "select";
  default?: string;
  title?: string;
  options?: string[];
  required?: boolean;
};

export type Manifest<T = {}> = {
  id: string;
  description: string;
  version: string;
  name: string;
  types: ContentType[];
  catalogs: (string | CatalogDefinition)[];
  resources: (string | ResourceDefinition)[];
  idPrefixes?: string[];
  behaviorHints?: ManifestBehaviorHints;
  config?: ConfigField[];
  background?: string;
  logo?: string;
  contactEmail?: string;
  addonCatalogs?: AddonCatalogDefinition[];
} & T;

export type CatalogItem = {
  id: string;
  type: ContentType;
  name: string;
  poster?: string;
  posterShape?: "square" | "poster" | "landscape";
  videos?: Video[];
  background?: string;
  description?: string;
  genres?: string[];
  releaseInfo?: string;
  director?: string[];
  cast?: string[];
  imdbRating?: string;
  links?: MetaLink[];
  trailers?: Array<{ source: string; type: "Trailer" | "Clip" }>;
};

export type Meta = {
  id: string;
  type: ContentType;
  name: string;
  poster?: string;
  posterShape?: "square" | "poster" | "landscape";
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  released?: string;
  runtime?: string;
  language?: string;
  country?: string;
  awards?: string;
  website?: string;
  genres?: string[];
  director?: string[];
  cast?: string[];
  imdbRating?: string;
  trailers?: Array<{ source: string; type: "Trailer" | "Clip" }>;
  links?: MetaLink[];
  videos?: Video[];
  behaviorHints?: {
    defaultVideoId?: string;
  };
};

export type ConfigValues = Record<string, string | number | boolean>;

export type CatalogExtraArgs = {
  search?: string;
  genre?: string;
  skip?: number;
  [key: string]: string | number | undefined;
};

export type SubtitlesExtraArgs = {
  videoId?: string;
  videoSize?: number;
};

export type CacheHeaders = {
  cacheMaxAge?: number;
  staleRevalidate?: number;
  staleError?: number;
};

export type StreamResponse = {
  streams: Stream[];
} & CacheHeaders;

export type CatalogResponse = {
  metas: CatalogItem[];
} & CacheHeaders;

export type MetaResponse = {
  meta: Meta;
} & CacheHeaders;

export type SubtitlesResponse = {
  subtitles: Subtitle[];
} & CacheHeaders;

export type AddonCatalogItem = {
  transportName: string;
  transportUrl: string;
  manifest: Manifest;
};

export type AddonCatalogResponse = {
  addons: AddonCatalogItem[];
} & CacheHeaders;

export type Config<T = {}> = {
  manifest: Manifest<T>;
  onStreamRequest?: (
    type: ContentType,
    id: string,
    config?: ConfigValues
  ) => Promise<StreamResponse>;
  onCatalogRequest?: (
    type: ContentType,
    id: string,
    extraArgs?: CatalogExtraArgs,
    config?: ConfigValues
  ) => Promise<CatalogResponse>;
  onMetaRequest?: (
    type: ContentType,
    id: string,
    config?: ConfigValues
  ) => Promise<MetaResponse | null>;
  onSubtitlesRequest?: (
    type: ContentType,
    id: string,
    extraArgs?: SubtitlesExtraArgs,
    config?: ConfigValues
  ) => Promise<SubtitlesResponse>;
  onAddonCatalogRequest?: (
    type: ContentType,
    id: string,
    config?: ConfigValues
  ) => Promise<AddonCatalogResponse>;
  options?: {
    level?: LogLevel;
  };
};
