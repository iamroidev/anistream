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

const CACHE_MS = 5 * 60 * 1000;
const MIN_INTERVAL_MS = 400;
const MAX_RETRIES = 3;

const cache = new Map<string, { at: number; data: unknown }>();
let lastCallAt = 0;
let chain: Promise<unknown> = Promise.resolve();

function dedupeByMalId<T extends { mal_id: number }>(items: T[]): T[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.mal_id)) return false;
    seen.add(item.mal_id);
    return true;
  });
}

async function throttle() {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

async function jikanGet<T>(path: string): Promise<T> {
  const url = `${config.jikanUrl}${path}`;
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.data as T;
  }

  const run = async () => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      await throttle();
      try {
        const data = await fetchJson<T>(url);
        cache.set(url, { at: Date.now(), data });
        return data;
      } catch (e) {
        const msg = String(e);
        if (msg.includes("429") && attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
    throw new Error("Jikan request failed");
  };

  const result = chain.then(run, run);
  chain = result.catch(() => {});
  return result as Promise<T>;
}

export async function jikanSeasonNow() {
  const res = await jikanGet<{ data: JikanAnime[] }>("/seasons/now?limit=24");
  return { data: dedupeByMalId(res.data) };
}

export async function jikanTop() {
  const res = await jikanGet<{ data: JikanAnime[] }>("/top/anime?limit=24");
  return { data: dedupeByMalId(res.data) };
}

export async function jikanHome() {
  const season = await jikanSeasonNow();
  const top = await jikanTop();
  return { season: season.data, top: top.data };
}

export async function jikanSearch(q: string) {
  return jikanGet<{ data: JikanAnime[] }>(
    `/anime?q=${encodeURIComponent(q)}&limit=20`
  );
}

export async function jikanAnime(malId: string) {
  return jikanGet<{ data: JikanAnime & { trailer?: { embed_url?: string } } }>(
    `/anime/${malId}/full`
  );
}

export interface JikanRelationEntry {
  mal_id: number;
  name: string;
  type: string;
}

export async function jikanRelations(malId: string) {
  const res = await jikanGet<{
    data: { relation: string; entry: JikanRelationEntry[] }[];
  }>(`/anime/${malId}/relations`);
  const keep = new Set(["Sequel", "Prequel", "Side story", "Parent story", "Spin-off"]);
  const out: { relation: string; mal_id: number; name: string }[] = [];
  const seen = new Set<number>();

  for (const group of res.data) {
    if (!keep.has(group.relation)) continue;
    for (const entry of group.entry) {
      if (entry.type !== "anime" || seen.has(entry.mal_id)) continue;
      seen.add(entry.mal_id);
      out.push({ relation: group.relation, mal_id: entry.mal_id, name: entry.name });
    }
  }
  return out;
}
