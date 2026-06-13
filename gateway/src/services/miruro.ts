import { config } from "../config.js";
import { fetchJson } from "../fetch.js";
import { proxyImageUrl } from "../proxy.js";
import { withTimeout } from "../timeout.js";

const TIMEOUT_MS = 20_000;
const PROVIDER_PREF = ["bee", "arc", "zoro", "jet", "ally", "hop", "kiwi", "pewe", "bonk", "moo", "telli"] as const;

interface MiruroTitle {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
}

interface MiruroSearchItem {
  id: number;
  idMal?: number | null;
  title?: MiruroTitle;
  coverImage?: { large?: string; extraLarge?: string; medium?: string };
  averageScore?: number | null;
  description?: string | null;
  episodes?: number | null;
  status?: string | null;
  genres?: string[];
}

interface MiruroEpisode {
  id: string;
  number: number;
  title?: string;
  filler?: boolean;
  isFiller?: boolean;
  airDate?: string;
  duration?: number;
  description?: string;
  image?: string;
}

function base() {
  return config.miruroUrl.replace(/\/$/, "");
}

async function miruroGet<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (config.miruroApiKey) headers["x-api-key"] = config.miruroApiKey;
  return withTimeout(fetchJson<T>(`${base()}${path}`, { headers }), TIMEOUT_MS, `miruro${path}`);
}

export function encodeMiruroEpisodeId(watchPath: string): string {
  return watchPath.replace(/\//g, "~");
}

export function decodeMiruroEpisodeId(encoded: string): string {
  return encoded.replace(/~/g, "/");
}

function posterFrom(item: { coverImage?: MiruroSearchItem["coverImage"] }): string {
  const img = item.coverImage;
  return proxyImageUrl(img?.extraLarge ?? img?.large ?? img?.medium ?? "");
}

function titleFrom(t?: MiruroTitle): string {
  return t?.english ?? t?.romaji ?? t?.native ?? "Unknown";
}

export async function miruroSearch(q: string) {
  const data = await miruroGet<{
    results?: MiruroSearchItem[];
  }>(`/search?query=${encodeURIComponent(q)}&per_page=10`);

  const items = (data.results ?? []).slice(0, 10);
  return Promise.all(
    items.map(async (r) => {
      let malId = r.idMal ?? undefined;
      if (!malId) {
        try {
          const info = await miruroInfo(String(r.id));
          malId = info.idMal ?? undefined;
        } catch {
          /* optional enrichment */
        }
      }
      return {
        id: String(r.id),
        name: titleFrom(r.title),
        poster: posterFrom(r),
        provider: "miruro" as const,
        malId,
      };
    })
  );
}

export async function miruroInfo(anilistId: string) {
  return miruroGet<MiruroSearchItem>(`/info/${anilistId}`);
}

export function toAnimeInfoResponse(info: MiruroSearchItem) {
  const planned = info.episodes ?? 0;
  return {
    anime: {
      info: {
        id: String(info.id),
        name: titleFrom(info.title),
        poster: posterFrom(info),
        description: info.description ?? "",
        stats: {
          rating: info.averageScore != null ? (info.averageScore / 10).toFixed(1) : "—",
          quality: "HD",
          episodes: { planned, sub: planned, dub: 0 },
        },
        moreInfo: {
          status: info.status ?? "",
          genres: info.genres ?? [],
          malId: info.idMal ? String(info.idMal) : "",
        },
        provider: "miruro",
      },
    },
  };
}

function providerRank(name: string): number {
  const idx = PROVIDER_PREF.indexOf(name as (typeof PROVIDER_PREF)[number]);
  return idx >= 0 ? idx : PROVIDER_PREF.length;
}

function pickEpisodeList(providers: Record<string, { episodes?: Record<string, MiruroEpisode[]> }>) {
  let bestSub: { streamProvider: string; episodes: MiruroEpisode[]; category: "sub" } | null = null;
  let bestDub: { streamProvider: string; episodes: MiruroEpisode[]; category: "dub" } | null = null;

  for (const [name, providerData] of Object.entries(providers)) {
    const sub = providerData?.episodes?.sub;
    if (sub?.length) {
      if (
        !bestSub ||
        sub.length > bestSub.episodes.length ||
        (sub.length === bestSub.episodes.length && providerRank(name) < providerRank(bestSub.streamProvider))
      ) {
        bestSub = { streamProvider: name, episodes: sub, category: "sub" };
      }
    }

    const dub = providerData?.episodes?.dub;
    if (dub?.length) {
      if (
        !bestDub ||
        dub.length > bestDub.episodes.length ||
        (dub.length === bestDub.episodes.length && providerRank(name) < providerRank(bestDub.streamProvider))
      ) {
        bestDub = { streamProvider: name, episodes: dub, category: "dub" };
      }
    }
  }

  return bestSub ?? bestDub;
}

function mapMiruroEpisode(ep: MiruroEpisode) {
  return {
    episodeId: encodeMiruroEpisodeId(ep.id),
    number: ep.number,
    title: ep.title ?? `Episode ${ep.number}`,
    isFiller: Boolean(ep.filler ?? ep.isFiller),
    airDate: ep.airDate ?? undefined,
    duration: ep.duration ?? undefined,
    description: ep.description ?? undefined,
    image: ep.image ?? undefined,
  };
}

export async function miruroEpisodes(anilistId: string) {
  const data = await miruroGet<{
    providers?: Record<string, { episodes?: Record<string, MiruroEpisode[]> }>;
  }>(`/episodes/${anilistId}`);

  const picked = pickEpisodeList(data.providers ?? {});
  if (!picked) {
    return { episodes: [], totalEpisodes: 0, streamProvider: null, category: null };
  }

  const episodes = picked.episodes.map(mapMiruroEpisode);

  return {
    episodes,
    totalEpisodes: episodes.length,
    streamProvider: picked.streamProvider,
    category: picked.category,
  };
}

export async function miruroWatch(encodedEpisodeId: string) {
  const watchPath = decodeMiruroEpisodeId(encodedEpisodeId);
  const data = await miruroGet<{
    streams?: { url: string; type?: string; quality?: string }[];
    subtitles?: { file: string; label: string; kind?: string }[];
    intro?: { start: number; end: number };
    outro?: { start: number; end: number };
  }>(`/${watchPath}`);

  const streams = data.streams ?? [];
  if (!streams.length) throw new Error("No stream sources from Miruro");

  return formatMiruroWatch(data);
}

function formatMiruroWatch(data: {
  streams?: { url: string; type?: string; quality?: string }[];
  subtitles?: { file: string; label: string; kind?: string }[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
}) {
  const streams = data.streams ?? [];
  return {
    headers: { Referer: "https://www.miruro.tv/" },
    sources: streams.map((s) => {
      const isHls = s.type === "hls" || s.url.includes(".m3u8");
      return {
        url: s.url,
        quality: s.quality,
        isM3U8: isHls,
        type: isHls ? undefined : ("embed" as const),
      };
    }),
    tracks: (data.subtitles ?? []).map((sub) => ({
      file: sub.file,
      label: sub.label,
      kind: sub.kind ?? "captions",
      default: sub.label.toLowerCase().includes("english"),
    })),
    intro: data.intro,
    outro: data.outro,
    subtitles: (data.subtitles ?? []).map((sub) => ({
      url: sub.file,
      lang: sub.label,
    })),
  };
}

/** If the primary provider has no soft subs, try other providers for the same episode. */
export async function miruroWatchPreferSubs(encodedEpisodeId: string) {
  const primary = await miruroWatch(encodedEpisodeId);
  if (primary.tracks.length > 0) return primary;

  const watchPath = decodeMiruroEpisodeId(encodedEpisodeId);
  const parts = watchPath.split("/");
  if (parts.length < 5 || parts[0] !== "watch") return primary;

  const category = parts[3];
  const slug = parts[4];
  const epNum = Number(slug.split("-").pop());
  const anilistId = parts[2];
  if (!anilistId || !Number.isFinite(epNum)) return primary;

  const epData = await miruroGet<{
    providers?: Record<string, { episodes?: Record<string, MiruroEpisode[]> }>;
  }>(`/episodes/${anilistId}`);

  for (const prov of PROVIDER_PREF) {
    if (prov === parts[1]) continue;
    const epList = epData.providers?.[prov]?.episodes?.[category];
    const match = epList?.find((ep) => ep.number === epNum);
    if (!match) continue;

    try {
      const alt = await miruroWatch(encodeMiruroEpisodeId(match.id));
      if (alt.tracks.length > 0) return alt;
    } catch {
      /* try next provider */
    }
  }

  return primary;
}

export async function miruroAvailable(): Promise<boolean> {
  try {
    await miruroGet<{ results?: unknown[] }>("/search?query=naruto&per_page=1");
    return true;
  } catch {
    return false;
  }
}
