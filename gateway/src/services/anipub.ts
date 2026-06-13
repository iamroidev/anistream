import { config } from "../config.js";
import { fetchJson } from "../fetch.js";
import { proxyImageUrl } from "../proxy.js";
import { withTimeout } from "../timeout.js";

const TIMEOUT_MS = 12_000;

interface AnipubSearchHit {
  Name: string;
  Id: number;
  Image?: string;
  finder?: string;
}

interface AnipubInfo {
  _id: number;
  Name: string;
  ImagePath?: string;
  Cover?: string;
  DescripTion?: string;
  MALScore?: string;
  Status?: string;
  epCount?: number;
  Genres?: string[];
  MALID?: number;
}

interface AnipubDetails {
  local: {
    name?: string;
    link?: string;
    ep?: { link: string }[];
  };
}

function base() {
  return config.anipubUrl.replace(/\/$/, "");
}

function imageUrl(path?: string): string {
  if (!path) return "";
  const url = path.startsWith("http") ? path : `${base()}/${path.replace(/^\//, "")}`;
  return proxyImageUrl(url);
}

function stripSrc(link: string): string {
  return link.replace(/^src=/i, "").trim();
}

async function anipubGet<T>(path: string): Promise<T> {
  return withTimeout(fetchJson<T>(`${base()}${path}`), TIMEOUT_MS, `anipub${path}`);
}

export async function anipubSearch(q: string) {
  const raw = await anipubGet<AnipubSearchHit[] | AnipubSearchHit | null>(
    `/api/search/${encodeURIComponent(q)}`
  );
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((r) => ({
    id: String(r.Id),
    name: r.Name,
    poster: imageUrl(r.Image),
    provider: "anipub" as const,
  }));
}

export async function anipubResolveByMal(malId: number, title: string) {
  const hits = await anipubSearch(title);
  for (const hit of hits.slice(0, 10)) {
    try {
      const info = await anipubInfo(hit.id);
      const infoMal = Number(info.MALID);
      if (Number.isFinite(infoMal) && infoMal === malId) return hit;
    } catch {
      /* try next */
    }
  }

  const normalized = title.trim().toLowerCase();
  const exact = hits.find((h) => h.name.trim().toLowerCase() === normalized);
  if (exact) return exact;

  return hits[0] ?? null;
}

export async function anipubFind(q: string) {
  return anipubGet<{ exist: boolean; id?: number; ep?: number }>(
    `/api/find/${encodeURIComponent(q)}`
  );
}

export async function anipubInfo(id: string) {
  return anipubGet<AnipubInfo>(`/api/info/${id}`);
}

export async function anipubDetails(id: string) {
  return anipubGet<AnipubDetails>(`/v1/api/details/${id}`);
}

export function toAnimeInfoResponse(info: AnipubInfo) {
  const epCount = info.epCount ?? 0;
  return {
    anime: {
      info: {
        id: String(info._id),
        name: info.Name,
        poster: imageUrl(info.ImagePath ?? info.Cover),
        description: info.DescripTion ?? "",
        stats: {
          rating: info.MALScore ?? "—",
          quality: "HD",
          episodes: { sub: epCount, dub: 0 },
        },
        moreInfo: {
          status: info.Status ?? "",
          genres: info.Genres ?? [],
          malId: info.MALID ? String(info.MALID) : "",
        },
        provider: "anipub",
      },
    },
  };
}

export async function anipubEpisodes(id: string) {
  const { local } = await anipubDetails(id);
  const episodes: {
    episodeId: string;
    number: number;
    title: string;
    isFiller: boolean;
  }[] = [];

  if (local.link) {
    episodes.push({
      episodeId: "1",
      number: 1,
      title: local.name ? `${local.name}` : "Episode 1",
      isFiller: false,
    });
  }

  for (let i = 0; i < (local.ep?.length ?? 0); i++) {
    const number = i + 2;
    episodes.push({
      episodeId: String(number),
      number,
      title: `Episode ${number}`,
      isFiller: false,
    });
  }

  return {
    episodes,
    totalEpisodes: episodes.length,
  };
}

async function resolveEmbedUrl(playUrl: string): Promise<string> {
  const res = await fetch(playUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
  });
  if (!res.ok) return playUrl;
  const html = await res.text();
  const quoted = html.match(/<iframe\s+src=["'](https?:\/\/[^"']+)["']/i);
  if (quoted?.[1]) return quoted[1];
  const unquoted = html.match(/<iframe\s+src=(https?:\/\/[^\s>]+)/i);
  if (unquoted?.[1]) return unquoted[1];
  return playUrl;
}

export async function anipubWatch(animeId: string, episodeNum: string) {
  const { local } = await anipubDetails(animeId);
  const num = Number(episodeNum);
  if (!Number.isFinite(num) || num < 1) {
    throw new Error("Invalid episode number");
  }

  let playLink: string | undefined;
  if (num === 1) {
    playLink = local.link;
  } else {
    playLink = local.ep?.[num - 2]?.link;
  }
  if (!playLink) throw new Error("Episode not found");

  const playUrl = stripSrc(playLink);
  const embedUrl = await resolveEmbedUrl(playUrl);

  return {
    headers: { Referer: base() },
    sources: [
      {
        url: embedUrl,
        quality: "auto",
        isM3U8: false,
        type: "embed" as const,
      },
    ],
    subtitles: [] as { url: string; lang: string }[],
  };
}
