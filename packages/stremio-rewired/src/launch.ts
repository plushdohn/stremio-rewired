import open from "open";

export async function launch(port: number) {
  const addonUrl = `http://localhost:${port}/manifest.json`;

  const url = new URL("https://staging.strem.io");

  url.hash = `?addonOpen=${encodeURIComponent(addonUrl)}`;

  await open(url.toString());
}
