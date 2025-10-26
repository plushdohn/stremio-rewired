import z from "zod";
import m3u8Parser from "m3u8-parser";
import { HTTPResponse } from "puppeteer-core";

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
        id: `animeunity:${record.id}-${record.slug}`,
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
    const proxy = await this.getProxy();

    const browser = await getPuppeteer(proxy);

    const page = await browser.pages().then((pages) => pages[0]);

    if (!page) {
      throw new Error("No page found");
    }

    async function runWaitingForRequest(
      matcher: string,
      callback: () => Promise<void>
    ) {
      return new Promise<{ id: string; title: string; url: string }[]>(
        async (resolve) => {
          page?.on("response", handleResponse);

          async function handleResponse(response: HTTPResponse) {
            const url = response.url();

            if (url.startsWith(matcher)) {
              page?.off("response", handleResponse);

              const m3u8contents = await response.text();

              const videos = this.getStreamsFromM3u(m3u8contents);

              resolve(videos);
            }
          }

          await callback();
        }
      );
    }

    const url = await runWaitingForRequest(
      "https://vixcloud.co/playlist/",
      async () => {
        await page.goto(`https://www.animeunity.so/anime/${id}`);
      }
    );

    await browser.close();

    return url;
  }

  private async getProxy() {
    const response = await fetch(
      "https://api.proxyscrape.com/v4/free-proxy-list/get?request=displayproxies&protocol=https&timeout=10000&country=all&ssl=all&anonymity=all&skip=0&limit=10"
    );

    const text = await response.text();

    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return lines[Math.floor(Math.random() * lines.length)];
  }

  private getStreamsFromM3u(contents: string) {
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
            id: `animeunity:${i + 1}`,
            title: seg.title || `Video ${i + 1}`,
            url: `${seg.uri}#.m3u8`,
          }))
        : manifest.playlists
        ? manifest.playlists.map((pl, i) => ({
            id: `animeunity:${i + 1}`,
            title: (pl.attributes?.NAME as string) || `Stream ${i + 1}`,
            url: `${pl.uri}#.m3u8`,
          }))
        : [];

    return videos;
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

async function getPuppeteer(proxy: string) {
  if (process.env.VERCEL_ENV) {
    const chromium = (await import("@sparticuz/chromium")).default;

    const puppeteer = (await import("puppeteer-extra")).default;

    const StealthPlugin = (await import("puppeteer-extra-plugin-stealth"))
      .default;

    puppeteer.use(StealthPlugin());

    return puppeteer.launch({
      dumpio: true,
      args: [...chromium.args, `--proxy-server=${proxy}`],
      executablePath: await chromium.executablePath(),
    });
  }

  const puppeteer = await import("puppeteer");

  return puppeteer.launch({
    devtools: false,
    args: [`--proxy-server=${proxy}`],
  });
}
