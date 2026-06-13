import { HiAnime } from "aniwatch";

const scraper = new HiAnime.Scraper();

export async function aniwatchSearch(q: string) {
  const result = await scraper.search(q, 1);
  return {
    animes: (result.animes ?? []).map((a) => ({
      id: a.id ?? "",
      name: a.name ?? "",
      poster: a.poster ?? "",
      type: a.type ?? undefined,
      episodes: { sub: a.episodes?.sub ?? undefined, dub: a.episodes?.dub ?? undefined },
    })),
  };
}

export async function aniwatchInfo(id: string) {
  const data = await scraper.getInfo(id);
  return {
    anime: {
      info: {
        id: data.anime.info.id,
        name: data.anime.info.name,
        poster: data.anime.info.poster,
        description: data.anime.info.description ?? "",
        stats: data.anime.info.stats,
        moreInfo: data.anime.moreInfo,
      },
    },
  };
}

export async function aniwatchEpisodes(id: string) {
  const data = await scraper.getEpisodes(id);
  return {
    episodes: data.episodes.map((ep) => ({
      episodeId: ep.episodeId ?? "",
      number: ep.number ?? 0,
      title: ep.title ?? "",
      isFiller: ep.isFiller ?? false,
    })),
    totalEpisodes: data.totalEpisodes,
  };
}

export async function aniwatchServers(episodeId: string) {
  const data = await scraper.getEpisodeServers(episodeId);
  return {
    sub: data.sub.map((s) => ({ serverName: s.serverName, serverId: 0 })),
    dub: data.dub.map((s) => ({ serverName: s.serverName, serverId: 0 })),
    raw: data.raw.map((s) => ({ serverName: s.serverName, serverId: 0 })),
  };
}

export async function aniwatchSources(
  episodeId: string,
  server: string,
  category: "sub" | "dub" | "raw"
) {
  const data = await scraper.getEpisodeSources(
    episodeId,
    server as HiAnime.AnimeServers,
    category
  );

  return {
    sources: data.sources.map((s) => ({
      url: s.url,
      isM3U8: s.isM3U8 ?? s.url.includes(".m3u8"),
      type: "hls",
    })),
    tracks: (data.subtitles ?? []).map((sub) => ({
      file: sub.url,
      label: sub.lang,
      kind: "captions",
      default: sub.lang.toLowerCase().includes("english"),
    })),
    headers: data.headers as { Referer?: string; "User-Agent"?: string },
    intro: data.intro,
    outro: undefined,
  };
}
