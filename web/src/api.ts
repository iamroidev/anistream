const API = import.meta.env.VITE_API_URL ?? "";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json();
}

export interface JikanAnime {
  mal_id: number;
  title: string;
  title_english: string | null;
  images: { jpg: { large_image_url: string } };
  score: number | null;
  synopsis: string | null;
  episodes: number | null;
  genres?: { name: string }[];
  status?: string;
  year?: number;
  studios?: { name: string }[];
}

export interface StreamAnime {
  id: string;
  name: string;
  poster: string;
  type?: string;
  provider?: string;
  episodes?: { sub?: number; dub?: number };
}

export interface Episode {
  episodeId: string;
  number: number;
  title: string;
  isFiller: boolean;
}

export const api = {
  seasonNow: () => get<{ data: JikanAnime[] }>("/api/browse/season"),
  topAnime: () => get<{ data: JikanAnime[] }>("/api/browse/top"),
  metadataSearch: (q: string) =>
    get<{ data: JikanAnime[] }>(`/api/metadata/search?q=${encodeURIComponent(q)}`),
  metadataById: (malId: number) =>
    get<{ data: JikanAnime }>(`/api/metadata/${malId}`),
  streamSearch: (q: string) =>
    get<{ animes: StreamAnime[] }>(`/api/anime/search?q=${encodeURIComponent(q)}`),
  animeInfo: (id: string, provider?: string) => {
    const qs = provider ? `?provider=${provider}` : "";
    return get<{ anime: { info: Record<string, unknown> } }>(`/api/anime/${id}${qs}`);
  },
  episodes: (id: string, provider?: string) => {
    const qs = provider ? `?provider=${provider}` : "";
    return get<{ episodes: Episode[]; totalEpisodes: number }>(`/api/anime/${id}/episodes${qs}`);
  },
  watch: (episodeId: string, server = "hd-1", category = "sub", provider?: string) => {
    const params = new URLSearchParams({ server, category });
    if (provider) params.set("provider", provider);
    return get<{
      provider?: string;
      sources: { url: string; isM3U8: boolean }[];
      tracks: { file: string; label: string; kind: string; default?: boolean }[];
      intro?: { start: number; end: number };
      outro?: { start: number; end: number };
    }>(`/api/watch/${episodeId}?${params}`);
  },
  watchServers: (episodeId: string) =>
    get<{ sub: { serverName: string }[]; dub: { serverName: string }[] }>(
      `/api/watch/${episodeId}/servers`
    ),
  watchFallback: (episodeId: string, provider = "animepahe") =>
    get<{ sources: { url: string }[]; subtitles?: { url: string; lang: string }[] }>(
      `/api/watch/${episodeId}/fallback?provider=${provider}`
    ),
  downloadSearch: (q: string) => get<unknown>(`/api/downloads/search?q=${encodeURIComponent(q)}`),
  downloads: (id: string, ep: string, quality = "1080p") =>
    get<unknown>(
      `/api/downloads/${id}/${ep}?quality=${quality}&source=pahe&group=SubsPlease&type=sub`
    ),
};
