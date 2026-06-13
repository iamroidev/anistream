import { config } from "../config.js";
import { fetchJson } from "../fetch.js";

export async function animetsuSearch(q: string) {
  return fetchJson<unknown>(
    `${config.animetsuUrl}/api/search?q=${encodeURIComponent(q)}`
  );
}

export async function animetsuAnime(id: string) {
  return fetchJson<unknown>(`${config.animetsuUrl}/api/anime/${id}`);
}

export async function animetsuEpisodes(id: string) {
  return fetchJson<unknown>(`${config.animetsuUrl}/api/anime/${id}/episodes`);
}

export async function animetsuWatch(
  id: string,
  ep: string,
  sourceType = "sub"
) {
  const params = new URLSearchParams({
    server: "auto",
    source_type: sourceType,
    fallback: "true",
  });
  return fetchJson<unknown>(
    `${config.animetsuUrl}/api/anime/${id}/watch/${ep}?${params}`
  );
}

export async function animetsuDownloads(
  id: string,
  ep: string,
  options: { quality?: string; source?: string; group?: string; type?: string } = {}
) {
  const params = new URLSearchParams();
  if (options.quality) params.set("quality", options.quality);
  if (options.source) params.set("source", options.source);
  if (options.group) params.set("group", options.group);
  if (options.type) params.set("type", options.type);
  const qs = params.toString();
  return fetchJson<unknown>(
    `${config.animetsuUrl}/api/anime/${id}/downloads/${ep}${qs ? `?${qs}` : ""}`
  );
}

export async function animetsuHealth() {
  try {
    const res = await fetch(`${config.animetsuUrl}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
