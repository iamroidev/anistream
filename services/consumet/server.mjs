/**
 * Lightweight Consumet-compatible API backed by @consumet/extensions (in-process).
 * Same scraper stack as the gateway fallback — no dependency on api.consumet.org.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { ANIME } from "@consumet/extensions";

const PORT = Number(process.env.PORT ?? 3000);
const ENABLE_ANIMEPAHE = process.env.ENABLE_ANIMEPAHE === "true";
const ANIMEPAHE_BASE_URL = (process.env.ANIMEPAHE_BASE_URL ?? "https://animepahe.com").replace(
  /\/$/,
  ""
);

const PROVIDERS = {
  animepahe: {
    enabled: ENABLE_ANIMEPAHE,
    create() {
      const p = new ANIME.AnimePahe();
      p.baseUrl = ANIMEPAHE_BASE_URL;
      return p;
    },
  },
  hianime: { enabled: false, create: () => new ANIME.Hianime() },
  animekai: { enabled: false, create: () => new ANIME.AnimeKai() },
  kickassanime: { enabled: false, create: () => new ANIME.KickAssAnime() },
};

const instances = new Map();

function provider(name) {
  const meta = PROVIDERS[name];
  if (!meta?.enabled) return null;
  if (!instances.has(name)) instances.set(name, meta.create());
  return instances.get(name);
}

async function animepaheSearch(q) {
  const domains = [
    ANIMEPAHE_BASE_URL,
    "https://animepahe.com",
    "https://animepahe.org",
    "https://animepahe.si",
  ].filter((v, i, a) => a.indexOf(v) === i);

  for (const base of domains) {
    try {
      const p = new ANIME.AnimePahe();
      p.baseUrl = base;
      const data = await p.search(q);
      if (data?.results?.length) return data;
    } catch {
      /* try next domain */
    }
  }
  return { results: [] };
}

const app = new Hono();

app.get("/", (c) =>
  c.json({
    ok: true,
    service: "anistream-consumet",
    engine: "@consumet/extensions",
    providers: Object.entries(PROVIDERS)
      .filter(([, m]) => m.enabled)
      .map(([id]) => id),
  })
);

app.get("/anime/:provider/:query", async (c) => {
  const { provider: name, query } = c.req.param();
  try {
    if (name === "animepahe") return c.json(await animepaheSearch(query));
    const p = provider(name);
    if (!p) return c.json({ error: `Provider disabled: ${name}` }, 503);
    return c.json(await p.search(query));
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/anime/:provider/info", async (c) => {
  const name = c.req.param("provider");
  const id = c.req.query("id");
  if (!id) return c.json({ error: "id required" }, 400);
  try {
    const p = provider(name);
    if (!p) return c.json({ error: `Provider disabled: ${name}` }, 503);
    const info = await p.fetchAnimeInfo(id);
    return c.json({
      id: info.id,
      title: info.title ?? "",
      image: info.image,
      description: info.description,
      episodes: (info.episodes ?? []).map((ep) => ({
        id: ep.id ?? "",
        number: ep.number ?? 0,
        title: ep.title,
      })),
    });
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/anime/animepahe/watch", async (c) => {
  const episodeId = c.req.query("episodeId");
  if (!episodeId) return c.json({ error: "episodeId required" }, 400);
  try {
    const p = provider("animepahe");
    if (!p) return c.json({ error: "AnimePahe disabled — set ENABLE_ANIMEPAHE=true" }, 503);
    return c.json(await p.fetchEpisodeSources(episodeId));
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get("/anime/:provider/watch/:episodeId", async (c) => {
  const { provider: name, episodeId } = c.req.param();
  try {
    const p = provider(name);
    if (!p) return c.json({ error: `Provider disabled: ${name}` }, 503);
    return c.json(await p.fetchEpisodeSources(episodeId));
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

console.log(`Consumet sidecar on :${PORT} (extensions in-process, animepahe=${ENABLE_ANIMEPAHE})`);
serve({ fetch: app.fetch, port: PORT });
