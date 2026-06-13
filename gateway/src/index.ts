import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.js";
import { discoverCatalogSources, discoverWatchSources, refreshSourceSnapshots } from "./source-discovery.js";
import { proxyResource, proxyUrl, proxyImage, proxyImageUrl } from "./proxy.js";
import { activeStreamProviders, type ActiveStreamProvider } from "./provider-config.js";
import { probeStreamProviders } from "./provider-status.js";
import { resolveMiruroPlayback } from "./stream-verify.js";
import { withTimeout } from "./timeout.js";

const SEARCH_TIMEOUT_MS = 25_000;
import * as metadata from "./services/metadata.js";
import * as consumet from "./services/consumet-adapter.js";
import * as animetsu from "./services/animetsu.js";
import * as anipub from "./services/anipub.js";
import * as miruro from "./services/miruro.js";
import * as anilist from "./services/anilist.js";
import * as zenshin from "./services/zenshin.js";

const STREAM_SOURCES = ["miruro", "anipub", ...activeStreamProviders()] as const;

function discontinuedProvider(c: { json: (body: unknown, status?: number) => Response }, name: string) {
  return c.json(
    {
      error: `${name} is discontinued. Use Miruro or AniPub — see GET /api/providers/status.`,
      tried: [...STREAM_SOURCES],
    },
    410
  );
}

const app = new Hono();

app.use(
  "*",
  cors({
    origin: config.corsOrigin === "*" ? "*" : config.corsOrigin.split(","),
    allowMethods: ["GET", "POST", "OPTIONS"],
  })
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "anistream-gateway",
    publicUrl: config.publicUrl,
    streamProviders: [...STREAM_SOURCES],
  })
);

app.get("/api/providers/status", async (c) => {
  try {
    return c.json(await probeStreamProviders());
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

// ── Jikan metadata ──────────────────────────────────────────────

app.get("/api/browse/season", async (c) => {
  try {
    return c.json(await metadata.browseSeason());
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/api/browse/home", async (c) => {
  try {
    return c.json(await metadata.browseHome());
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/api/browse/curated", async (c) => {
  try {
    return c.json(await metadata.browseCurated());
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/api/browse/section/:section", async (c) => {
  try {
    const genre = c.req.query("genre");
    return c.json(await metadata.browseSection(c.req.param("section"), genre));
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/api/browse/top", async (c) => {
  try {
    return c.json(await metadata.browseTop());
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/api/metadata/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "q required" }, 400);
  try {
    return c.json(await metadata.metadataSearch(q));
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/api/metadata/:malId", async (c) => {
  try {
    return c.json(await metadata.metadataAnime(c.req.param("malId")));
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/api/metadata/:malId/relations", async (c) => {
  try {
    return c.json(await metadata.metadataRelations(c.req.param("malId")));
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/api/zenshin/mappings", async (c) => {
  const malId = c.req.query("mal_id") ?? c.req.query("mal");
  const anilistId = c.req.query("anilist_id") ?? c.req.query("anilist");
  if (!malId && !anilistId) {
    return c.json({ error: "mal_id or anilist_id required" }, 400);
  }
  try {
    const data = await zenshin.zenshinMappings({ malId, anilistId });
    if (!data) return c.json({ error: "Not found in Zenshin" }, 404);
    return c.json(data);
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

// ── Streaming (aniwatch → consumet chain) ───────────────────────

function episodeNumberFromId(episodeId: string): string | null {
  const decoded = episodeId.includes("~") ? episodeId.replace(/~/g, "/") : episodeId;
  const slug = decoded.split("/").pop() ?? decoded;
  const num = slug.includes("-") ? slug.split("-").pop() : slug;
  return num && /^\d+$/.test(num) ? num : null;
}

async function resolveAnipubId(animeId: string, title?: string): Promise<string | null> {
  const numeric = Number(animeId);
  if (Number.isFinite(numeric) && numeric > 0 && numeric < 100_000) {
    return animeId;
  }
  if (!title?.trim()) return null;
  const hits = await anipub.anipubSearch(title.trim());
  return hits[0]?.id ?? null;
}

async function anipubWatchResolved(animeId: string, episodeId: string, title?: string) {
  const ep = episodeNumberFromId(episodeId) ?? episodeId;
  const anipubId = await resolveAnipubId(animeId, title);
  if (!anipubId) throw new Error("AniPub source not found for this title");
  return anipub.anipubWatch(anipubId, ep);
}

async function miruroWatchRaw(episodeId: string) {
  return miruro.miruroWatchPreferSubs(episodeId);
}

async function searchAnime(q: string) {
  const tryAnipub = async () => {
    const anipubHits = await withTimeout(anipub.anipubSearch(q), 8_000, "anipub-search");
    if (anipubHits.length > 0) {
      return { animes: anipubHits, source: "anipub" as const };
    }
    return null;
  };

  const tryMiruro = async () => {
    const miruroHits = await withTimeout(miruro.miruroSearch(q), 25_000, "miruro-search");
    if (miruroHits.length > 0) {
      return { animes: miruroHits, source: "miruro" as const };
    }
    return null;
  };

  if (config.preferEmbed) {
    try {
      const hit = await tryAnipub();
      if (hit) return hit;
    } catch {
      /* fall through */
    }
  }

  try {
    const hit = await tryMiruro();
    if (hit) return hit;
  } catch {
    /* try other providers */
  }

  if (!config.preferEmbed) {
    try {
      const hit = await tryAnipub();
      if (hit) return hit;
    } catch {
      /* try scrapers */
    }
  }

  try {
    const hit = await consumet.consumetSearchAny(q);
    if (hit) {
      return {
        animes: hit.value.results.map((r) => ({
          id: r.id,
          name: r.title,
          poster: proxyImageUrl(r.image ?? ""),
          provider: hit.provider,
        })),
        source: hit.provider,
      };
    }
  } catch {
    /* consumet disabled or failed */
  }

  return { animes: [], tried: [...STREAM_SOURCES] };
}

app.get("/api/anime/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "q required" }, 400);

  try {
    const result = await withTimeout(searchAnime(q), SEARCH_TIMEOUT_MS, "anime-search");
    return c.json(result);
  } catch {
    return c.json({
      animes: [],
      tried: [...STREAM_SOURCES],
      error: "Search timed out",
    });
  }
});

app.get("/api/anime/:id", async (c) => {
  const id = c.req.param("id");
  const provider = c.req.query("provider");

  if (provider === "miruro") {
    try {
      const info = await miruro.miruroInfo(id);
      return c.json(miruro.toAnimeInfoResponse(info));
    } catch (e) {
      return c.json({ error: String(e) }, 502);
    }
  }

  if (provider === "anipub") {
    try {
      const info = await anipub.anipubInfo(id);
      return c.json(anipub.toAnimeInfoResponse(info));
    } catch (e) {
      return c.json({ error: String(e) }, 502);
    }
  }

  if (provider === "hianime" || provider === "aniwatch") {
    return discontinuedProvider(c, "HiAnime");
  }

  if (provider && provider !== "miruro" && provider !== "anipub") {
    const hit = await consumet.consumetInfoAny(id, provider);
    if (hit) return c.json(consumet.toAnimeInfoResponse(hit.value.info, hit.provider));
    return c.json({ error: "Anime not found", tried: [...STREAM_SOURCES] }, 502);
  }

  return c.json(
    { error: "provider required — use miruro, anipub, or GET /api/anime/:id/sources", tried: [...STREAM_SOURCES] },
    400
  );
});

app.get("/api/anime/:id/episodes", async (c) => {
  const id = c.req.param("id");
  const provider = c.req.query("provider");
  const malId = c.req.query("mal") ?? c.req.query("mal_id");
  const anilistId = c.req.query("anilist") ?? c.req.query("anilist_id");

  async function enrich(result: { episodes: zenshin.EnrichedEpisode[]; totalEpisodes: number }) {
    let resolvedAnilist = anilistId;
    if (!resolvedAnilist && malId) {
      const aid = await anilist.anilistIdFromMal(malId);
      if (aid) resolvedAnilist = String(aid);
    }
    if (!malId && !resolvedAnilist) return result;
    return zenshin.zenshinEnrichEpisodesResponse(result, { malId, anilistId: resolvedAnilist });
  }

  if (provider === "miruro") {
    try {
      let miruroId = id;
      if (!id.includes("~") && malId) {
        const aid = anilistId ?? String((await anilist.anilistIdFromMal(malId)) ?? "");
        if (aid) miruroId = aid;
      }
      return c.json(await enrich(await miruro.miruroEpisodes(miruroId)));
    } catch (e) {
      return c.json({ error: String(e) }, 502);
    }
  }

  if (provider === "anipub") {
    try {
      return c.json(await enrich(await anipub.anipubEpisodes(id)));
    } catch (e) {
      return c.json({ error: String(e) }, 502);
    }
  }

  if (provider === "hianime" || provider === "aniwatch") {
    return discontinuedProvider(c, "HiAnime");
  }

  if (provider && provider !== "miruro" && provider !== "anipub") {
    const hit = await consumet.consumetInfoAny(id, provider);
    if (hit) return c.json(await enrich(consumet.toEpisodesResponse(hit.value.info)));
    return c.json({ error: "Episodes not found" }, 502);
  }

  return c.json(
    { error: "provider required — use miruro, anipub, or GET /api/anime/:id/sources", tried: [...STREAM_SOURCES] },
    400
  );
});

app.get("/api/anime/:id/sources", async (c) => {
  const title = c.req.query("title");
  if (!title?.trim()) return c.json({ error: "title required" }, 400);

  try {
    const malId = c.req.query("mal") ?? c.req.query("mal_id") ?? undefined;
    const anilistParam = c.req.query("anilist") ?? c.req.query("anilist_id");
    const sources = await discoverCatalogSources({
      title: title.trim(),
      malId,
      anilistId: anilistParam ?? undefined,
    });
    return c.json({ sources });
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.post("/api/anime/sources/refresh", async (c) => {
  try {
    const body = await c.req.json<{
      sources?: { key: string; provider: string; animeId: string }[];
      title?: string;
      malId?: string;
      anilistId?: string;
    }>();
    if (!body.sources?.length) return c.json({ error: "sources required" }, 400);
    const snapshots = await refreshSourceSnapshots(body.sources, {
      title: body.title,
      malId: body.malId,
      anilistId: body.anilistId,
    });
    return c.json({ snapshots });
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/api/watch/:episodeId/sources", async (c) => {
  const ep = c.req.query("ep");
  const title = c.req.query("title");
  if (!ep || !title?.trim()) {
    return c.json({ error: "ep and title required" }, 400);
  }

  const epNum = Number(ep);
  if (!Number.isFinite(epNum) || epNum < 1) {
    return c.json({ error: "invalid ep" }, 400);
  }

  try {
    const sources = await discoverWatchSources({
      epNum,
      title: title.trim(),
      animeId: c.req.query("animeId") ?? undefined,
      episodeId: c.req.param("episodeId"),
      malId: c.req.query("mal") ?? undefined,
      anilistId: c.req.query("anilist") ?? undefined,
    });
    return c.json({ sources });
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/api/watch/:episodeId/servers", async (c) => {
  return c.json({ error: "HiAnime discontinued — use GET /api/watch/:episodeId/sources" }, 410);
});

app.get("/api/watch/:episodeId", async (c) => {
  const episodeId = c.req.param("episodeId");
  const server = c.req.query("server") ?? "hd-1";
  const category = (c.req.query("category") ?? "sub") as "sub" | "dub" | "raw";
  const preferred = c.req.query("provider") ?? undefined;
  const animeId = c.req.query("animeId") ?? undefined;
  const title = c.req.query("title") ?? undefined;

  if (!preferred) {
    return c.json({ error: "provider required — fetch /api/watch/:episodeId/sources to choose" }, 400);
  }

  if (preferred === "miruro") {
    try {
      const raw = await miruroWatchRaw(episodeId);
      const preferEmbed = server === "embed" || c.req.query("playback") === "embed";
      const resolved = await resolveMiruroPlayback(raw, preferEmbed);
      if (resolved.playback === "embed") {
        return c.json({
          provider: "miruro",
          headers: resolved.headers,
          sources: resolved.sources,
          tracks: [],
          subtitles: [],
          intro: resolved.intro,
          outro: resolved.outro,
        });
      }
      if (resolved.playback === "hls-direct") {
        return c.json({
          provider: "miruro",
          headers: resolved.headers,
          sources: resolved.sources.map((s) => ({
            ...s,
            url: s.url,
            originalUrl: s.url,
          })),
          tracks: resolved.tracks,
          subtitles: resolved.subtitles,
          intro: resolved.intro,
          outro: resolved.outro,
        });
      }
      return c.json(proxyStreamResponse(resolved, "miruro"));
    } catch (e) {
      return c.json({ error: String(e) }, 502);
    }
  }

  if (preferred === "anipub") {
    if (!animeId) return c.json({ error: "animeId required for anipub" }, 400);
    try {
      const sources = await anipubWatchResolved(animeId, episodeId, title);
      return c.json(proxyStreamResponse(sources, "anipub"));
    } catch (e) {
      return c.json({ error: String(e) }, 502);
    }
  }

  if (preferred === "hianime" || preferred === "aniwatch") {
    return discontinuedProvider(c, "HiAnime");
  }

  if (activeStreamProviders().includes(preferred as ActiveStreamProvider)) {
    const hit = await consumet.consumetWatchAny(episodeId, preferred);
    if (hit) return c.json(proxyStreamResponse(hit.value.sources, hit.provider));
    return c.json({ error: "No stream found", tried: [preferred] }, 502);
  }

  return c.json({ error: `Unknown provider: ${preferred}` }, 400);
});

app.get("/api/watch/:episodeId/fallback", async (c) => {
  const episodeId = c.req.param("episodeId");
  const preferred = c.req.query("provider") ?? undefined;
  const hit = await consumet.consumetWatchAny(episodeId, preferred);
  if (!hit) return c.json({ error: "No stream found", tried: activeStreamProviders() }, 502);
  return c.json(proxyStreamResponse(hit.value.sources, hit.provider));
});

// ── Consumet direct ─────────────────────────────────────────────

app.get("/api/consumet/search", async (c) => {
  const q = c.req.query("q");
  const provider = c.req.query("provider");
  if (!q) return c.json({ error: "q required" }, 400);

  if (provider) {
    try {
      return c.json(await consumet.consumetSearch(provider, q));
    } catch (e) {
      return c.json({ error: String(e) }, 502);
    }
  }

  const hit = await consumet.consumetSearchAny(q);
  if (!hit) return c.json({ results: [], tried: activeStreamProviders() });
  return c.json({ results: hit.value.results, provider: hit.provider });
});

// ── Animetsu downloads ────────────────────────────────────────────

app.get("/api/downloads/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "q required" }, 400);
  try {
    return c.json(await animetsu.animetsuSearch(q));
  } catch {
    return c.json({ results: [], animetsuAvailable: false });
  }
});

app.get("/api/downloads/:id", async (c) => {
  try {
    return c.json(await animetsu.animetsuAnime(c.req.param("id")));
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/api/downloads/:id/:ep", async (c) => {
  const { id, ep } = c.req.param();
  const quality = c.req.query("quality") ?? "1080p";
  const source = c.req.query("source") ?? "pahe";
  const group = c.req.query("group") ?? "SubsPlease";
  const type = c.req.query("type") ?? "sub";

  try {
    return c.json(
      await animetsu.animetsuDownloads(id, ep, { quality, source, group, type })
    );
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/api/downloads/:id/:ep/watch", async (c) => {
  const { id, ep } = c.req.param();
  const sourceType = c.req.query("source_type") ?? "sub";
  try {
    return c.json(await animetsu.animetsuWatch(id, ep, sourceType));
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

// ── HLS proxy ───────────────────────────────────────────────────

app.get("/proxy/image", async (c) => {
  const url = c.req.query("url");
  if (!url) return c.text("url required", 400);
  try {
    return await proxyImage(url);
  } catch (e) {
    return c.text(String(e), 502);
  }
});

app.get("/proxy/resource", async (c) => {
  const url = c.req.query("url");
  if (!url) return c.text("url required", 400);
  const referer = c.req.query("referer") ?? undefined;
  const ua = c.req.query("ua") ?? undefined;
  try {
    return await proxyResource(url, referer, ua);
  } catch (e) {
    return c.text(String(e), 502);
  }
});

function proxyStreamResponse(
  sources: {
    headers?: { Referer?: string; "User-Agent"?: string };
    sources: { url: string; quality?: string; isM3U8?: boolean; type?: string }[];
    subtitles?: { url: string; lang: string }[];
    tracks?: { file: string; label: string; kind: string; default?: boolean }[];
    intro?: { start: number; end: number };
    outro?: { start: number; end: number };
  },
  provider: string
) {
  const referer = sources.headers?.Referer;
  const ua = sources.headers?.["User-Agent"];

  return {
    provider,
    ...sources,
    sources: sources.sources.map((s) => {
      const isEmbed = s.type === "embed";
      const isHls = !isEmbed && s.isM3U8 !== false && (s.isM3U8 === true || s.url.includes(".m3u8"));
      return {
        ...s,
        url: isHls ? proxyUrl(s.url, referer, ua) : s.url,
        originalUrl: s.url,
      };
    }),
    tracks: sources.tracks?.map((t) => ({
      ...t,
      file: t.file.startsWith("http") ? proxyUrl(t.file, referer, ua) : t.file,
    })),
    subtitles: sources.subtitles?.map((sub) => ({
      ...sub,
      url: proxyUrl(sub.url, referer, ua),
    })),
  };
}

export default app;
