import {
  getStreamProvider,
  providerOrder,
  tryEachProvider,
  type StreamProvider,
} from "../providers.js";

export async function consumetSearch(provider: string, q: string) {
  const p = getStreamProvider(provider);
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  const results = await p.search(q);
  return {
    results: results.results.map((r) => ({
      id: r.id,
      title: r.title,
      image: r.image,
      url: r.url,
    })),
  };
}

export async function consumetSearchAny(q: string, preferred?: string) {
  const hit = await tryEachProvider(providerOrder(preferred), async (provider) => {
    const data = await consumetSearch(provider, q);
    return data.results.length > 0 ? { provider, results: data.results } : null;
  });
  return hit;
}

export async function consumetInfo(provider: string, id: string) {
  const p = getStreamProvider(provider);
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  const info = await p.fetchAnimeInfo(id);
  return {
    id: info.id,
    title: info.title ?? "",
    image: info.image,
    description: info.description,
    episodes: (info.episodes ?? []).map((ep) => ({
      id: ep.id ?? "",
      number: ep.number ?? 0,
      title: ep.title,
    })),
  };
}

export async function consumetInfoAny(id: string, preferred?: string) {
  const hit = await tryEachProvider(providerOrder(preferred), async (provider) => {
    const info = await consumetInfo(provider, id);
    if (info.episodes.length > 0 || info.title) return { provider, info };
    return null;
  });
  return hit;
}

export async function consumetWatch(provider: string, episodeId: string) {
  const p = getStreamProvider(provider);
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  const data = await p.fetchEpisodeSources(episodeId);
  if (!data.sources?.length) throw new Error("No sources");
  return {
    headers: data.headers as { Referer?: string; "User-Agent"?: string },
    sources: data.sources.map((s) => ({
      url: s.url,
      quality: s.quality,
      isM3U8: s.isM3U8 ?? s.url.includes(".m3u8"),
    })),
    subtitles: (data.subtitles ?? []).map((sub) => ({
      url: sub.url,
      lang: sub.lang,
    })),
  };
}

export async function consumetWatchAny(episodeId: string, preferred?: string) {
  return tryEachProvider(providerOrder(preferred), async (provider) => {
    try {
      const sources = await consumetWatch(provider, episodeId);
      return { provider, sources };
    } catch {
      return null;
    }
  });
}

export function toAnimeInfoResponse(
  info: Awaited<ReturnType<typeof consumetInfo>>,
  provider: StreamProvider
) {
  return {
    anime: {
      info: {
        id: info.id,
        name: info.title,
        poster: info.image ?? "",
        description: info.description ?? "",
        stats: {
          rating: "—",
          quality: "HD",
          episodes: { sub: info.episodes.length, dub: 0 },
        },
        moreInfo: {},
        provider,
      },
    },
  };
}

export function toEpisodesResponse(info: Awaited<ReturnType<typeof consumetInfo>>) {
  return {
    episodes: info.episodes.map((ep) => ({
      episodeId: ep.id,
      number: ep.number,
      title: ep.title ?? `Episode ${ep.number}`,
      isFiller: false,
    })),
    totalEpisodes: info.episodes.length,
  };
}
