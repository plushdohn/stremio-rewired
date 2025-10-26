import z from "zod";
import m3u8Parser from "m3u8-parser";

import { Provider } from "./interface";

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
    const response = await fetch(`https://www.animeunity.so/anime/${id}`);

    const html = await response.text();

    const embedUrl = extractVixcloudUrl(html);

    if (!embedUrl) {
      throw new Error("Streams not found");
    }

    const vixResponse = await fetch(embedUrl);

    const vixHtml = await vixResponse.text();

    const playlistUrl = constructPlaylistUrl(vixHtml);

    if (!playlistUrl) {
      throw new Error("Playlist URL not found");
    }

    const manifest = await fetch(playlistUrl);

    const manifestText = await manifest.text();

    const streams = getStreamsFromM3u(manifestText);

    return streams;
  }

  async getMeta(id: string) {
    const response = await fetch(`https://www.animeunity.so/anime/${id}`);

    const html = await response.text();

    // find <video-player anime="json-encoded-data" />
    const match = html.match(/<video-player anime="([^"]+)" \/>/);

    if (!match) {
      throw new Error("Meta not found");
    }

    const json: { title: string } = JSON.parse(match[1].replace("&quot;", '"'));

    return {
      id: `au${id}`,
      name: json.title,
      type: "series" as const,
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

function constructPlaylistUrl(html: string) {
  const masterPlaylist = getMasterPlaylist(html);

  const baseUrl = masterPlaylist.url;

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(masterPlaylist.params)) {
    if (value !== "") {
      params.append(key, value as string);
    }
  }

  params.append("h", "1");

  return `${baseUrl}?${params.toString()}`;
}

function getMasterPlaylist(html: string) {
  const marker = "window.masterPlaylist";
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) return null;

  // find '=' after the marker
  const eqIdx = html.indexOf("=", markerIdx + marker.length);
  if (eqIdx === -1) return null;

  // find first '{' after '='
  const firstBrace = html.indexOf("{", eqIdx);
  if (firstBrace === -1) return null;

  // scan to find the matching closing brace, handling strings & comments
  let i = firstBrace;
  let braceCount = 0;
  let inSingle = false,
    inDouble = false,
    inTemplate = false;
  const len = html.length;

  for (; i < len; i++) {
    const ch = html[i];
    const next = html[i + 1];

    // handle entering/exiting single/double/template strings (respecting escapes)
    if (ch === "'" && !inDouble && !inTemplate) {
      // count preceding backslashes
      let k = i - 1,
        bs = 0;
      while (k >= 0 && html[k] === "\\") {
        bs++;
        k--;
      }
      if (bs % 2 === 0) inSingle = !inSingle;
    } else if (ch === '"' && !inSingle && !inTemplate) {
      let k = i - 1,
        bs = 0;
      while (k >= 0 && html[k] === "\\") {
        bs++;
        k--;
      }
      if (bs % 2 === 0) inDouble = !inDouble;
    } else if (ch === "`" && !inSingle && !inDouble) {
      let k = i - 1,
        bs = 0;
      while (k >= 0 && html[k] === "\\") {
        bs++;
        k--;
      }
      if (bs % 2 === 0) inTemplate = !inTemplate;
    }

    // if inside a string/template, skip brace counting and comment detection
    if (inSingle || inDouble || inTemplate) continue;

    // skip comments
    if (ch === "/" && next === "/") {
      // single-line comment: skip until newline
      i += 2;
      while (i < len && html[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      // block comment: skip until */
      i += 2;
      while (i + 1 < len && !(html[i] === "*" && html[i + 1] === "/")) i++;
      i++; // land on the '/' of '*/' (for loop will increment)
      continue;
    }

    // count braces
    if (ch === "{") {
      braceCount++;
      // if this is the starting brace we already found, we also count it (normal)
    } else if (ch === "}") {
      braceCount--;
      if (braceCount === 0) {
        // found the matching closing brace
        let end = i + 1;
        // optionally consume whitespace and a trailing semicolon
        while (end < len && /\s/.test(html[end])) end++;
        if (html[end] === ";") end++;
        const objLiteral = html.slice(firstBrace, end); // includes braces (and semicolon if present)
        // parse into object (wrap with parentheses so object-literal is treated as an expression)
        try {
          const parsed = Function(
            '"use strict"; return (' + objLiteral + ")"
          )();
          return parsed;
        } catch (e) {
          throw new Error(`Parsing failed: ${String(e)}`);
        }
      }
    }
  }
}

function getStreamsFromM3u(contents: string) {
  const parser = new m3u8Parser.Parser();

  parser.push(contents);

  parser.end();

  const manifest = parser.manifest;

  if (!manifest.playlists?.length && !manifest.segments?.length) {
    throw new Error("Invalid playlist");
  }

  const videos =
    manifest.segments.length > 0
      ? manifest.segments.map((seg, i) => ({
          id: `au${i + 1}`,
          title: seg.title || `Video ${i + 1}`,
          url: `${seg.uri}#.m3u8`,
        }))
      : manifest.playlists
      ? manifest.playlists.map((pl, i) => ({
          id: `au${i + 1}`,
          title: (pl.attributes?.NAME as string) || `Stream ${i + 1}`,
          url: `${pl.uri}#.m3u8`,
        }))
      : [];

  return videos;
}
