import { config } from "../config.js";
import { fetchJson } from "../fetch.js";

export interface AniwatchSearchResult {
  animes: {
    id: string;
    name: string;
    poster: string;
    type?: string;
    episodes?: { sub?: number; dub?: number };
  }[];
}

export interface AniwatchAnimeInfo {
  anime: {
    info: {
      id: string;
      name: string;
      poster: string;
      description: string;
      stats: { rating: string; quality: string; episodes: { sub: number; dub: number } };
      moreInfo: Record<string, string | string[]>;
    };
  };
}

export interface AniwatchEpisode {
  episodeId: string;
  number: number;
  title: string;
  isFiller: boolean;
}

export interface AniwatchEpisodes {
  episodes: AniwatchEpisode[];
  totalEpisodes: number;
}

export interface AniwatchServer {
  serverName: string;
  serverId: number;
}

export interface AniwatchSources {
  sources: { url: string; isM3U8: boolean; type?: string }[];
  tracks: { file: string; label: string; kind: string; default?: boolean }[];
  headers?: { Referer?: string; "User-Agent"?: string };
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
}

export async function aniwatchSearch(q: string) {
  return fetchJson<AniwatchSearchResult>(
    `${config.aniwatchUrl}/api/v2/hianime/search?q=${encodeURIComponent(q)}`
  );
}

export async function aniwatchInfo(id: string) {
  return fetchJson<AniwatchAnimeInfo>(`${config.aniwatchUrl}/api/v2/hianime/anime/${id}`);
}

export async function aniwatchEpisodes(id: string) {
  return fetchJson<AniwatchEpisodes>(
    `${config.aniwatchUrl}/api/v2/hianime/anime/${id}/episodes`
  );
}

export async function aniwatchServers(episodeId: string) {
  return fetchJson<{ sub: AniwatchServer[]; dub: AniwatchServer[]; raw: AniwatchServer[] }>(
    `${config.aniwatchUrl}/api/v2/hianime/episode/servers?animeEpisodeId=${episodeId}`
  );
}

export async function aniwatchSources(
  episodeId: string,
  server: string,
  category: string
) {
  const params = new URLSearchParams({
    animeEpisodeId: episodeId,
    server,
    category,
  });
  return fetchJson<AniwatchSources>(
    `${config.aniwatchUrl}/api/v2/hianime/episode/sources?${params}`
  );
}
