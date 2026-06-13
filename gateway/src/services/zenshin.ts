import { config } from "../config.js";
import { fetchJson } from "../fetch.js";
import * as anilist from "./anilist.js";

const CACHE_MS = 24 * 60 * 60 * 1000; // DB updates ~every 2 days — cache aggressively

interface ZenshinEpisode {
  episode?: string;
  type?: string;
  length?: string;
  airdate?: string;
  airDate?: string;
  title?: { en?: string; ja?: string };
  nameTvdb?: string | null;
  overview?: string | null;
  image?: string | null;
  runtime?: number | null;
  absoluteEpisodeNumber?: number | null;
  episodeNumber?: number | null;
}

export interface ZenshinMappings {
  mainTitle?: string;
  title?: Record<string, string | null>;
  date?: { startDate?: string | null; endDate?: string | null };
  episodes?: Record<string, ZenshinEpisode>;
  mappings?: {
    mal_id?: number;
    anilist_id?: number;
    thetvdb_id?: number;
    anidb_id?: number;
    kitsu_id?: number;
    [key: string]: string | number | null | undefined;
  };
}

export interface EnrichedEpisode {
  episodeId: string;
  number: number;
  title: string;
  isFiller: boolean;
  airDate?: string;
  duration?: number;
  description?: string;
  image?: string;
  episodeType?: string;
  streamable?: boolean;
}

const cache = new Map<string, { at: number; data: ZenshinMappings | null }>();

function cacheKey(malId?: string, anilistId?: string) {
  if (malId) return `mal:${malId}`;
  if (anilistId) return `anilist:${anilistId}`;
  return "";
}

function parseRuntime(ep: ZenshinEpisode): number | undefined {
  if (ep.runtime && ep.runtime > 0) return ep.runtime * 60;
  const length = ep.length ?? "";
  const match = length.match(/(\d+)\s*m/i);
  if (match) return Number(match[1]) * 60;
  return undefined;
}

function episodeTitle(ep: ZenshinEpisode): string {
  return (
    ep.title?.en ??
    ep.nameTvdb ??
    (ep.title?.ja ? ep.title.ja : undefined) ??
    (ep.episode ? `Episode ${ep.episode}` : "Episode")
  );
}

function isRegularEpisode(ep: ZenshinEpisode): boolean {
  const type = (ep.type ?? "").toLowerCase();
  if (!type) return /^\d+$/.test(String(ep.episode ?? ""));
  return type.includes("regular");
}

export function zenshinRegularEpisodes(data: ZenshinMappings) {
  const episodes = data.episodes ?? {};
  return Object.values(episodes)
    .filter(isRegularEpisode)
    .map((ep) => {
      const num = ep.absoluteEpisodeNumber ?? ep.episodeNumber ?? Number(ep.episode);
      if (!Number.isFinite(num)) return null;
      return {
        number: num,
        title: episodeTitle(ep),
        airDate: ep.airDate ?? ep.airdate ?? undefined,
        duration: parseRuntime(ep),
        description: ep.overview ?? undefined,
        image: ep.image ?? undefined,
        episodeType: ep.type ?? "Regular Episode",
      };
    })
    .filter((ep): ep is NonNullable<typeof ep> => ep != null)
    .sort((a, b) => a.number - b.number);
}

export function mergeZenshinIntoEpisodes<T extends EnrichedEpisode>(
  streamEpisodes: T[],
  zenshin: ZenshinMappings | null
): T[] {
  if (!zenshin) {
    return streamEpisodes.map((ep) => ({ ...ep, streamable: ep.streamable ?? true }));
  }

  const catalog = new Map(
    zenshinRegularEpisodes(zenshin).map((ep) => [ep.number, ep])
  );

  const merged = streamEpisodes.map((ep) => {
    const meta = catalog.get(ep.number);
    if (!meta) return { ...ep, streamable: ep.streamable ?? true };

    const genericTitle = /^episode\s+\d+$/i.test(ep.title);
    return {
      ...ep,
      streamable: ep.streamable ?? true,
      title: genericTitle || ep.title === `Episode ${ep.number}` ? meta.title : ep.title || meta.title,
      airDate: ep.airDate ?? meta.airDate,
      duration: ep.duration ?? meta.duration,
      description: ep.description ?? meta.description,
      image: ep.image ?? meta.image ?? undefined,
      episodeType: meta.episodeType,
    };
  });

  const streamNumbers = new Set(merged.map((ep) => ep.number));
  const catalogOnly = zenshinRegularEpisodes(zenshin)
    .filter((ep) => !streamNumbers.has(ep.number))
    .map((ep) => ({
      episodeId: `catalog-${ep.number}`,
      number: ep.number,
      title: ep.title,
      isFiller: false,
      airDate: ep.airDate,
      duration: ep.duration,
      description: ep.description,
      image: ep.image,
      episodeType: ep.episodeType,
      streamable: false,
    }));

  return [...merged, ...catalogOnly].sort((a, b) => a.number - b.number) as T[];
}

function dedupeEpisodesByNumber<T extends EnrichedEpisode>(episodes: T[]): T[] {
  const byNumber = new Map<number, T>();
  for (const ep of episodes) {
    const existing = byNumber.get(ep.number);
    if (!existing) {
      byNumber.set(ep.number, ep);
      continue;
    }
    const existingStreamable = existing.streamable !== false;
    const nextStreamable = ep.streamable !== false;
    if (nextStreamable && !existingStreamable) {
      byNumber.set(ep.number, ep);
      continue;
    }
    if (nextStreamable === existingStreamable && !existing.description && ep.description) {
      byNumber.set(ep.number, { ...existing, ...ep, episodeId: existing.episodeId });
    }
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

function mergeAnilistDescriptions<T extends EnrichedEpisode>(
  episodes: T[],
  anilistEps: { number: number; title: string; description?: string }[]
) {
  if (anilistEps.length === 0) return episodes;

  const byNumber = new Map(anilistEps.map((ep) => [ep.number, ep]));
  return episodes.map((ep) => {
    const meta = byNumber.get(ep.number);
    if (!meta) return ep;

    const genericTitle = /^episode\s+\d+$/i.test(ep.title);
    return {
      ...ep,
      title:
        genericTitle || ep.title === `Episode ${ep.number}`
          ? meta.title || ep.title
          : ep.title,
      description: ep.description ?? meta.description,
    };
  });
}

async function fetchFromZenshin(malId?: string, anilistId?: string): Promise<ZenshinMappings | null> {
  const params = malId
    ? `mal_id=${encodeURIComponent(malId)}`
    : anilistId
      ? `anilist_id=${encodeURIComponent(anilistId)}`
      : null;
  if (!params) return null;

  const bases = [config.zenshinUrl, config.zenshinUrlFallback].filter(Boolean);
  let lastError: unknown;

  for (const base of bases) {
    try {
      const url = `${base.replace(/\/$/, "")}/mappings?${params}`;
      return await fetchJson<ZenshinMappings>(url);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError ?? new Error("Zenshin request failed");
}

export async function zenshinMappings(options: {
  malId?: string;
  anilistId?: string;
}): Promise<ZenshinMappings | null> {
  const key = cacheKey(options.malId, options.anilistId);
  if (!key) return null;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.data;
  }

  try {
    const data = await fetchFromZenshin(options.malId, options.anilistId);
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    if (cached) return cached.data;
    cache.set(key, { at: Date.now(), data: null });
    return null;
  }
}

export async function zenshinEnrichEpisodesResponse<
  T extends { episodes: EnrichedEpisode[]; totalEpisodes: number }
>(response: T, options: { malId?: string; anilistId?: string }): Promise<T & { zenshin?: { planned: number; streamable?: number; mappings?: ZenshinMappings["mappings"] } }> {
  const zenshin = await zenshinMappings(options);
  const regular = zenshin ? zenshinRegularEpisodes(zenshin) : [];

  let episodes = dedupeEpisodesByNumber(mergeZenshinIntoEpisodes(response.episodes, zenshin));

  try {
    const anilistKey =
      options.anilistId ??
      (options.malId ? String((await anilist.anilistIdFromMal(options.malId)) ?? "") : "");
    const anilistEps = anilistKey
      ? await anilist.anilistStreamingEpisodes(anilistKey)
      : options.malId
        ? await anilist.anilistStreamingEpisodesByMal(options.malId)
        : [];
    episodes = dedupeEpisodesByNumber(mergeAnilistDescriptions(episodes, anilistEps));
  } catch {
    /* optional enrichment */
  }

  const streamable = episodes.filter((ep) => ep.streamable !== false).length;
  const officialTotal = regular.length > 0 ? regular.length : response.totalEpisodes;
  const catalogTotal = Math.max(officialTotal, episodes.length);

  return {
    ...response,
    episodes,
    totalEpisodes: streamable,
    zenshin: zenshin
      ? {
          planned: catalogTotal,
          streamable,
          mappings: zenshin.mappings,
        }
      : undefined,
  };
}
