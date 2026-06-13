import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.js";
import { proxyResource, proxyUrl } from "./proxy.js";
import { STREAM_PROVIDERS } from "./providers.js";
import * as jikan from "./services/jikan.js";
import * as aniwatch from "./services/aniwatch-local.js";
import * as consumet from "./services/consumet-local.js";
import * as animetsu from "./services/animetsu.js";

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
    streamProviders: STREAM_PROVIDERS,
  })
);

// ── Jikan metadata ──────────────────────────────────────────────

app.get("/api/browse/season", async (c) => {
  try {
    return c.json(await jikan.jikanSeasonNow());
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/api/browse/top", async (c) => {
  try {
    return c.json(await jikan.jikanTop());
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/api/metadata/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "q required" }, 400);
  try {
    return c.json(await jikan.jikanSearch(q));
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/api/metadata/:malId", async (c) => {
  try {
    return c.json(await jikan.jikanAnime(c.req.param("malId")));
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

// ── Streaming (aniwatch → consumet chain) ───────────────────────

app.get("/api/anime/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "q required" }, 400);

  try {
    const primary = await aniwatch.aniwatchSearch(q);
    if (primary.animes.length > 0) {
      return c.json({
        animes: primary.animes.map((a) => ({ ...a, provider: "hianime" })),
        source: "aniwatch",
      });
    }
  } catch {
    /* try consumet chain */
  }

  const hit = await consumet.consumetSearchAny(q);
  if (hit) {
    return c.json({
      animes: hit.value.results.map((r) => ({
        id: r.id,
        name: r.title,
        poster: r.image ?? "",
        provider: hit.provider,
      })),
      source: hit.provider,
    });
  }

  return c.json({ animes: [], tried: ["aniwatch", ...STREAM_PROVIDERS] });
});

app.get("/api/anime/:id", async (c) => {
  const id = c.req.param("id");
  const provider = c.req.query("provider");

  if (provider && provider !== "hianime") {
    const hit = await consumet.consumetInfoAny(id, provider);
    if (hit) return c.json(consumet.toAnimeInfoResponse(hit.value.info, hit.provider));
    return c.json({ error: "Anime not found", tried: STREAM_PROVIDERS }, 502);
  }

  try {
    const data = await aniwatch.aniwatchInfo(id);
    return c.json({ ...data, source: "aniwatch" });
  } catch {
    const hit = await consumet.consumetInfoAny(id, provider ?? undefined);
    if (hit) return c.json(consumet.toAnimeInfoResponse(hit.value.info, hit.provider));
    return c.json({ error: "Anime not found", tried: ["aniwatch", ...STREAM_PROVIDERS] }, 502);
  }
});

app.get("/api/anime/:id/episodes", async (c) => {
  const id = c.req.param("id");
  const provider = c.req.query("provider");

  if (provider && provider !== "hianime") {
    const hit = await consumet.consumetInfoAny(id, provider);
    if (hit) return c.json(consumet.toEpisodesResponse(hit.value.info));
    return c.json({ error: "Episodes not found" }, 502);
  }

  try {
    return c.json(await aniwatch.aniwatchEpisodes(id));
  } catch {
    const hit = await consumet.consumetInfoAny(id, provider ?? undefined);
    if (hit) return c.json(consumet.toEpisodesResponse(hit.value.info));
    return c.json({ error: "Episodes not found", tried: ["aniwatch", ...STREAM_PROVIDERS] }, 502);
  }
});

app.get("/api/watch/:episodeId/servers", async (c) => {
  try {
    return c.json(await aniwatch.aniwatchServers(c.req.param("episodeId")));
  } catch (e) {
    return c.json({ error: String(e), hint: "Use provider query on /api/watch" }, 502);
  }
});

app.get("/api/watch/:episodeId", async (c) => {
  const episodeId = c.req.param("episodeId");
  const server = c.req.query("server") ?? "hd-1";
  const category = (c.req.query("category") ?? "sub") as "sub" | "dub" | "raw";
  const preferred = c.req.query("provider") ?? undefined;

  // Consumet-only path when provider is set and not raw aniwatch
  if (preferred && preferred !== "hianime") {
    const hit = await consumet.consumetWatchAny(episodeId, preferred);
    if (hit) return c.json(proxyStreamResponse(hit.value.sources, hit.provider));
    return c.json({ error: "No stream found", tried: STREAM_PROVIDERS }, 502);
  }

  // 1) Aniwatch / HiAnime package
  try {
    const sources = await aniwatch.aniwatchSources(episodeId, server, category);
    if (sources.sources?.length) {
      return c.json(proxyStreamResponse(sources, "hianime"));
    }
  } catch {
    /* fall through */
  }

  // 2) Try all consumet providers
  const hit = await consumet.consumetWatchAny(episodeId, preferred);
  if (hit) return c.json(proxyStreamResponse(hit.value.sources, hit.provider));

  return c.json({
    error: "All providers failed",
    tried: ["aniwatch", ...STREAM_PROVIDERS],
  }, 502);
});

app.get("/api/watch/:episodeId/fallback", async (c) => {
  const episodeId = c.req.param("episodeId");
  const preferred = c.req.query("provider") ?? undefined;
  const hit = await consumet.consumetWatchAny(episodeId, preferred);
  if (!hit) return c.json({ error: "No stream found", tried: STREAM_PROVIDERS }, 502);
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
  if (!hit) return c.json({ results: [], tried: STREAM_PROVIDERS });
  return c.json({ results: hit.value.results, provider: hit.provider });
});

// ── Animetsu downloads ────────────────────────────────────────────

app.get("/api/downloads/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "q required" }, 400);
  try {
    return c.json(await animetsu.animetsuSearch(q));
  } catch (e) {
    return c.json({ error: String(e), animetsuAvailable: false }, 502);
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
    sources: { url: string; quality?: string; isM3U8?: boolean }[];
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
    sources: sources.sources.map((s) => ({
      ...s,
      url: s.isM3U8 !== false && (s.isM3U8 || s.url.includes(".m3u8"))
        ? proxyUrl(s.url, referer, ua)
        : s.url,
      originalUrl: s.url,
    })),
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
