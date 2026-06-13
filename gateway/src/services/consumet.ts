import { config } from "../config.js";
import { fetchJson } from "../fetch.js";

export interface ConsumetSearchResult {
  results: {
    id: string;
    title: string;
    image?: string;
    url?: string;
  }[];
}

export interface ConsumetInfo {
  id: string;
  title: string;
  image?: string;
  description?: string;
  episodes: { id: string; number: number; title?: string }[];
}

export interface ConsumetSources {
  headers?: { Referer?: string; "User-Agent"?: string };
  sources: { url: string; quality?: string; isM3U8?: boolean }[];
  subtitles?: { url: string; lang: string }[];
}

export async function consumetSearch(provider: string, q: string) {
  return fetchJson<ConsumetSearchResult>(
    `${config.consumetUrl}/anime/${provider}/${encodeURIComponent(q)}`
  );
}

export async function consumetInfo(provider: string, id: string) {
  return fetchJson<ConsumetInfo>(
    `${config.consumetUrl}/anime/${provider}/info?id=${encodeURIComponent(id)}`
  );
}

export async function consumetWatch(provider: string, episodeId: string) {
  if (provider === "animepahe") {
    return fetchJson<ConsumetSources>(
      `${config.consumetUrl}/anime/animepahe/watch?episodeId=${encodeURIComponent(episodeId)}`
    );
  }
  return fetchJson<ConsumetSources>(
    `${config.consumetUrl}/anime/${provider}/watch/${encodeURIComponent(episodeId)}`
  );
}
