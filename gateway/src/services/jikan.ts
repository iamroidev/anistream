import { config } from "../config.js";
import { fetchJson } from "../fetch.js";

export interface JikanAnime {
  mal_id: number;
  title: string;
  title_english: string | null;
  images: { jpg: { large_image_url: string; image_url: string } };
  score: number | null;
  synopsis: string | null;
  episodes: number | null;
  status: string;
  genres: { name: string }[];
}

export async function jikanSeasonNow() {
  return fetchJson<{ data: JikanAnime[] }>(`${config.jikanUrl}/seasons/now?limit=24`);
}

export async function jikanTop() {
  return fetchJson<{ data: JikanAnime[] }>(`${config.jikanUrl}/top/anime?limit=24`);
}

export async function jikanSearch(q: string) {
  return fetchJson<{ data: JikanAnime[] }>(
    `${config.jikanUrl}/anime?q=${encodeURIComponent(q)}&limit=20`
  );
}

export async function jikanAnime(malId: string) {
  return fetchJson<{ data: JikanAnime & { trailer?: { embed_url?: string } } }>(
    `${config.jikanUrl}/anime/${malId}/full`
  );
}
