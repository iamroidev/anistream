import { ANIME } from "@consumet/extensions";

/** English-focused providers, tried in order when one fails */
export const STREAM_PROVIDERS = [
  "animepahe",
  "hianime",
  "animekai",
  "kickassanime",
] as const;

export type StreamProvider = (typeof STREAM_PROVIDERS)[number];

type AnimeProvider = {
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

const instances: Record<StreamProvider, AnimeProvider> = {
  animepahe: new ANIME.AnimePahe() as unknown as AnimeProvider,
  hianime: new ANIME.Hianime() as unknown as AnimeProvider,
  animekai: new ANIME.AnimeKai() as unknown as AnimeProvider,
  kickassanime: new ANIME.KickAssAnime() as unknown as AnimeProvider,
};

export function getStreamProvider(name: string): AnimeProvider | null {
  if (name in instances) return instances[name as StreamProvider];
  return null;
}

export async function tryEachProvider<T>(
  providers: readonly StreamProvider[],
  fn: (provider: StreamProvider) => Promise<T | null | undefined>
): Promise<{ provider: StreamProvider; value: T } | null> {
  for (const provider of providers) {
    try {
      const value = await fn(provider);
      if (value != null) return { provider, value };
    } catch {
      continue;
    }
  }
  return null;
}

export function providerOrder(preferred?: string): StreamProvider[] {
  if (!preferred || !STREAM_PROVIDERS.includes(preferred as StreamProvider)) {
    return [...STREAM_PROVIDERS];
  }
  const p = preferred as StreamProvider;
  return [p, ...STREAM_PROVIDERS.filter((x) => x !== p)];
}
