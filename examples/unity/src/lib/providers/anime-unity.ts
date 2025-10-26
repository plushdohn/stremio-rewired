import z from "zod";
import { CatalogItem } from "stremio-rewired";

import { Provider } from "./interface";

interface AnimeUnityVideo {
  id: number;
  title?: string;
  imageurl?: string;
  title_eng: string;
  title_it?: string;
  slug: string;
  episodes_count: number;
  date: string;
  imageurl_cover?: string;
  plot?: string;
}

interface AnimeUnityEpisode {
  id: number;
  number: string;
  file_name: string;
  link: string;
}

export class AnimeUnityProvider implements Provider {
  async search(title: string) {
    const homeResponse = await fetch("https://www.animeunity.so");

    const xsrfToken = this.getXsrfToken(homeResponse);
    const sessionCookie = this.getSessionCookie(homeResponse);
    const csrfToken = await this.getCrsfToken(homeResponse);

    const cookieToSend = `XSRF-TOKEN=${xsrfToken}; animeunity_session=${sessionCookie};`;

    const response = await fetch("https://www.animeunity.so/livesearch", {
      method: "POST",
      body: JSON.stringify({
        title,
      }),
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
        "x-xsrf-token": xsrfToken,
        Cookie: cookieToSend,
      },
    });

    const json = await response.json().catch(() => {
      console.error("Search returned invalid JSON");
      return null;
    });

    if (!json) {
      return [];
    }

    const schema = z.object({
      records: z.array(
        z.object({
          title_eng: z.string(),
          id: z.number(),
          imageurl: z.string(),
          slug: z.string(),
        })
      ),
    });

    try {
      const data = schema.parse(json);

      return data.records.map((record) => ({
        title: record.title_eng,
        id: `au${record.id}-${record.slug}`,
        imageUrl: record.imageurl,
      }));
    } catch (error) {
      console.error("Search returned invalid data:", error);
      return [];
    }
  }

  async getStreams(
    id: string
  ): Promise<Array<{ id: string; title: string; url: string }>> {
    const [animeId, episodeId] = id.split("--");

    const response = await fetch(
      `https://www.animeunity.so/anime/${animeId}${
        episodeId ? `/${episodeId}` : ""
      }`
    );

    const html = await response.text();

    const embedUrl = extractVixcloudUrl(html);

    if (!embedUrl) {
      throw new Error("Streams not found");
    }

    const vixResponse = await fetch(embedUrl);

    const vixHtml = await vixResponse.text();

    const mp4Url = getMp4UrlFromVixResponse(vixHtml);

    return [
      {
        id: `au${animeId}${episodeId ? `--${episodeId}` : ""}`,
        title: "Stream",
        url: mp4Url,
      },
    ];
  }

  async getMeta(id: string): Promise<CatalogItem> {
    const response = await fetch(`https://www.animeunity.so/anime/${id}`);

    const html = await response.text();

    const regex =
      /<video-player[^>]*anime="([^"]+)"[^>]*episodes="([^"]+)"[^>]|<video-player[^>]*episodes="([^"]+)"[^>]*anime="([^"]+)"/gi;

    const matches = html.matchAll(regex);

    let rawDetails: string;
    let rawEpisodes: string;

    for (const match of matches) {
      if (match[1] && match[2]) {
        rawDetails = match[1];
        rawEpisodes = match[2];
      } else if (match[3] && match[4]) {
        rawDetails = match[4];
        rawEpisodes = match[3];
      }
    }

    if (!rawDetails || !rawEpisodes) {
      throw new Error("Meta not found");
    }

    const cleanedAnimeDetails = rawDetails
      .replaceAll("\\&quot;", '\\"')
      .replaceAll("&quot;", '"');

    const cleanedEpisodes = rawEpisodes
      .replaceAll("\\&quot;", '\\"')
      .replaceAll("&quot;", '"');

    const details: AnimeUnityVideo = JSON.parse(cleanedAnimeDetails);

    const episodes: AnimeUnityEpisode[] = JSON.parse(cleanedEpisodes);

    return {
      id: `au${id}`,
      name: details.title_it || details.title_eng,
      type: "series",
      poster: details.imageurl,
      background: details.imageurl_cover,
      description: details.plot,
      videos: episodes.map((episode) => ({
        id: `au${id}--${episode.id}`,
        title: `Episodio ${episode.number}`,
        released: new Date(Number.parseInt(details.date), 0).toISOString(),
        episode: Number.parseInt(episode.number),
        season: 1,
      })),
    };
  }

  private async getCrsfToken(response: Response) {
    const landingPageHtml = await response.text();

    const csrfToken = landingPageHtml.match(
      /<meta name="csrf-token" content="([^"]+)"/
    )?.[1];

    if (!csrfToken) {
      throw new Error("CSRF token not found");
    }

    return csrfToken;
  }

  private getXsrfToken(response: Response) {
    const cookies = response.headers.get("Set-Cookie");

    const xsrfToken = cookies.match(/XSRF-TOKEN=([^;]+)/)?.[1];

    if (!xsrfToken) {
      throw new Error("XSRF token not found");
    }

    return decodeURIComponent(xsrfToken);
  }

  private getSessionCookie(response: Response) {
    const cookies = response.headers.get("Set-Cookie");

    const sessionCookie = cookies.match(/animeunity_session=([^;]+)/)?.[1];

    if (!sessionCookie) {
      throw new Error("Session cookie not found");
    }

    return decodeURIComponent(sessionCookie);
  }
}

async function getProxy() {
  const response = await fetch(
    "https://api.proxyscrape.com/v4/free-proxy-list/get?request=displayproxies&protocol=socks5&timeout=10000&country=all&ssl=yes&anonymity=yes&skip=0&limit=10"
  );

  const text = await response.text();

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const proxy = lines[Math.floor(Math.random() * lines.length)];

  return proxy;
}

function extractVixcloudUrl(htmlText: string) {
  const regex = /https:\/\/vixcloud\.co\/embed\/[^\s"'<>]+/g;
  const matches = htmlText.match(regex);

  const url = matches?.[0];

  if (!url) {
    return null;
  }

  return url.replaceAll("&amp;", "&");
}

function getMp4UrlFromVixResponse(html: string) {
  const regex = /window\.downloadUrl\s*=\s*'([^']+)'/;

  const match = html.match(regex);

  const url = match?.[1];

  if (!url) {
    throw new Error("Mp4 URL not found");
  }

  return url;
}
