import { ANIME } from "@consumet/extensions";
import { withTimeout } from "./timeout.js";
import {
  activeStreamProviders,
  allStreamProviderIds,
  animepaheDomainCandidates,
  type ActiveStreamProvider,
  type StreamProviderId,
  PROVIDER_REGISTRY,
} from "./provider-config.js";

const PROVIDER_TIMEOUT_MS = 8_000;

export type StreamProvider = ActiveStreamProvider;

/** @deprecated use ACTIVE_STREAM_PROVIDERS from provider-config */
export const STREAM_PROVIDERS = activeStreamProviders();

type AnimeProvider = {
  baseUrl?: string;
  search: (q: string) => Promise<{ results: { id: string; title: string; image?: string; url?: string }[] }>;
  fetchAnimeInfo: (id: string) => Promise<{
    id: string;
    title?: string;
    image?: string;
    description?: string;
    episodes?: { id?: string; number?: number; title?: string }[];
  }>;
  fetchEpisodeSources: (episodeId: string) => Promise<{
    headers?: { Referer?: string; "User-Agent"?: string };
    sources: { url: string; quality?: string; isM3U8?: boolean }[];
    subtitles?: { url: string; lang: string }[];
  }>;
};

function patchBaseUrl(instance: AnimeProvider, baseUrl?: string) {
  if (baseUrl) instance.baseUrl = baseUrl.replace(/\/$/, "");
}

function createProvider(id: StreamProviderId): AnimeProvider {
  switch (id) {
    case "animepahe": {
      const p = new ANIME.AnimePahe() as unknown as AnimeProvider;
      patchBaseUrl(p, PROVIDER_REGISTRY.animepahe.baseUrl);
      return p;
    }
    case "hianime":
      return new ANIME.Hianime() as unknown as AnimeProvider;
    case "animekai": {
      const p = new ANIME.AnimeKai() as unknown as AnimeProvider;
      patchBaseUrl(p, PROVIDER_REGISTRY.animekai.baseUrl);
      return p;
    }
    case "kickassanime":
      return new ANIME.KickAssAnime() as unknown as AnimeProvider;
    default:
      throw new Error(`Unknown provider: ${id}`);
  }
}

const instances: Partial<Record<StreamProviderId, AnimeProvider>> = {};

function getOrCreate(id: StreamProviderId): AnimeProvider | null {
  if (!PROVIDER_REGISTRY[id].enabled && !instances[id]) return null;
  if (!instances[id]) instances[id] = createProvider(id);
  return instances[id] ?? null;
}

export function getStreamProvider(name: string): AnimeProvider | null {
  if (!allStreamProviderIds().includes(name as StreamProviderId)) return null;
  const id = name as StreamProviderId;
  if (!PROVIDER_REGISTRY[id].enabled) return null;
  return getOrCreate(id);
}

/** AnimePahe-only: try configured domain list (Cloudflare may still block). */
export async function animepaheSearch(q: string) {
  const id = "animepahe" as const;
  if (!PROVIDER_REGISTRY.animepahe.enabled) return null;

  let lastError: unknown;
  for (const baseUrl of animepaheDomainCandidates()) {
    const p = getOrCreate(id);
    if (!p) return null;
    patchBaseUrl(p, baseUrl);
    try {
      const results = await withTimeout(p.search(q), PROVIDER_TIMEOUT_MS, `animepahe@${baseUrl}`);
      if (results.results?.length) return { baseUrl, results: results.results };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error("AnimePahe search failed on all configured domains");
}

export async function tryEachProvider<T>(
  providers: readonly StreamProvider[],
  fn: (provider: StreamProvider) => Promise<T | null | undefined>
): Promise<{ provider: StreamProvider; value: T } | null> {
  for (const provider of providers) {
    try {
      const value = await withTimeout(fn(provider), PROVIDER_TIMEOUT_MS, provider);
      if (value != null) return { provider, value };
    } catch {
      continue;
    }
  }
  return null;
}

export function providerOrder(preferred?: string): StreamProvider[] {
  const active = activeStreamProviders();
  if (!preferred || !active.includes(preferred as StreamProvider)) return [...active];
  const p = preferred as StreamProvider;
  return [p, ...active.filter((x) => x !== p)];
}
