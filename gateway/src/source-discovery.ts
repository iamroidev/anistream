import { withTimeout } from "./timeout.js";
import { isHlsReachable, isMiruroEmbedSource, resolveMiruroPlayback } from "./stream-verify.js";
import { activeStreamProviders, type ActiveStreamProvider } from "./provider-config.js";
import { anilistIdFromMal } from "./services/anilist.js";
import * as miruro from "./services/miruro.js";
import * as anipub from "./services/anipub.js";
import * as consumet from "./services/consumet-adapter.js";

const DISCOVER_MS = 14_000;

export interface CatalogSource {
  key: string;
  provider: string;
  label: string;
  animeId: string;
  type: "hls" | "embed";
  episodes: number;
  latestEpisode: number;
  checkedAt: string;
  malId?: number;
}

export interface SourceSnapshot {
  key: string;
  provider: string;
  animeId: string;
  episodes: number;
  latestEpisode: number;
  checkedAt: string;
}

export interface WatchSourceOption {
  key: string;
  provider: string;
  label: string;
  type: "hls" | "embed";
  status: "ok" | "blocked" | "unknown";
  episodeId: string;
  animeId?: string;
  server?: string;
  category?: "sub" | "dub";
  note?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  miruro: "Miruro",
  anipub: "AniPub",
  hianime: "HiAnime",
  aniwatch: "HiAnime",
  animepahe: "AnimePahe",
  animekai: "AnimeKai",
  kickassanime: "KickAssAnime",
};

function labelFor(provider: string) {
  return PROVIDER_LABELS[provider] ?? provider;
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await withTimeout(fn(), DISCOVER_MS, "discover");
  } catch {
    return null;
  }
}

async function resolveAnilistId(malId?: string, anilistId?: string): Promise<string | null> {
  if (anilistId && /^\d+$/.test(anilistId)) return anilistId;
  if (!malId || !/^\d+$/.test(malId)) return null;
  const resolved = await anilistIdFromMal(malId);
  return resolved ? String(resolved) : null;
}

function latestFromNumbers(nums: number[]): number {
  return nums.length > 0 ? Math.max(...nums) : 0;
}

function stampSource(
  source: Omit<CatalogSource, "checkedAt" | "latestEpisode"> & { latestEpisode?: number }
): CatalogSource {
  return {
    ...source,
    latestEpisode: source.latestEpisode ?? source.episodes,
    checkedAt: new Date().toISOString(),
  };
}

async function countEpisodesForProvider(
  provider: string,
  animeId: string,
  opts: { title?: string; malId?: number; anilistId?: string }
): Promise<{ episodes: number; latestEpisode: number } | null> {
  const FAST_MS = 10_000;
  try {
    if (provider === "miruro") {
      let miruroId = animeId;
      if (opts.malId && !opts.anilistId) {
        const aid = await anilistIdFromMal(String(opts.malId));
        if (aid) miruroId = String(aid);
      } else if (opts.anilistId) {
        miruroId = opts.anilistId;
      }
      const eps = await withTimeout(miruro.miruroEpisodes(miruroId), FAST_MS, "miruro-count");
      const nums = eps.episodes.map((e) => e.number);
      return { episodes: eps.episodes.length, latestEpisode: latestFromNumbers(nums) };
    }

    if (provider === "anipub") {
      let anipubId = animeId;
      if (opts.malId && opts.title) {
        const hit = await anipub.anipubResolveByMal(opts.malId, opts.title);
        if (hit) anipubId = hit.id;
      }
      const eps = await withTimeout(anipub.anipubEpisodes(anipubId), FAST_MS, "anipub-count");
      const nums = eps.episodes.map((e) => e.number);
      return { episodes: eps.totalEpisodes, latestEpisode: latestFromNumbers(nums) };
    }

    if (activeStreamProviders().includes(provider as ActiveStreamProvider)) {
      const info = await withTimeout(consumet.consumetInfo(provider, animeId), FAST_MS, "consumet-count");
      const nums = info.episodes.map((e) => e.number);
      return { episodes: info.episodes.length, latestEpisode: latestFromNumbers(nums) };
    }
  } catch {
    return null;
  }
  return null;
}

export async function refreshSourceSnapshots(
  sources: { key: string; provider: string; animeId: string }[],
  opts: { title?: string; malId?: string; anilistId?: string }
): Promise<SourceSnapshot[]> {
  const malNum = opts.malId && /^\d+$/.test(opts.malId) ? Number(opts.malId) : undefined;
  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const stats = await countEpisodesForProvider(source.provider, source.animeId, {
        title: opts.title,
        malId: malNum,
        anilistId: opts.anilistId,
      });
      if (!stats) return null;
      return {
        key: source.key,
        provider: source.provider,
        animeId: source.animeId,
        episodes: stats.episodes,
        latestEpisode: stats.latestEpisode,
        checkedAt: new Date().toISOString(),
      } satisfies SourceSnapshot;
    })
  );

  const out: SourceSnapshot[] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) out.push(result.value);
  }
  return out;
}

function pickTitleMatch<T extends { name?: string; title?: string }>(
  hits: T[],
  title: string
): T | null {
  if (hits.length === 0) return null;
  const norm = title.trim().toLowerCase();
  const exact = hits.find((h) => (h.name ?? h.title ?? "").trim().toLowerCase() === norm);
  return exact ?? hits[0];
}

export async function discoverCatalogSources(options: {
  title: string;
  malId?: string;
  anilistId?: string;
}): Promise<CatalogSource[]> {
  const { title, malId } = options;
  const malNum = malId && /^\d+$/.test(malId) ? Number(malId) : null;
  const resolvedAnilist = await resolveAnilistId(malId, options.anilistId);

  const consumetProviders = activeStreamProviders();

  const [miruroEps, anipubHit, consumetHits] = await Promise.all([
    resolvedAnilist ? safe(() => miruro.miruroEpisodes(resolvedAnilist)) : Promise.resolve(null),
    malNum
      ? safe(() => anipub.anipubResolveByMal(malNum, title))
      : safe(() => anipub.anipubSearch(title).then((h) => h[0] ?? null)),
    consumetProviders.length > 0
      ? Promise.allSettled(
          consumetProviders.map(async (provider) => {
            const data = await consumet.consumetSearch(provider, title);
            const hit = pickTitleMatch(data.results.map((r) => ({ ...r, name: r.title })), title);
            if (!hit) return null;
            const info = await consumet.consumetInfo(provider, hit.id);
            return { provider, id: hit.id, episodes: info.episodes.length };
          })
        )
      : Promise.resolve([]),
  ]);

  const out: CatalogSource[] = [];
  const seen = new Set<string>();

  function push(source: CatalogSource) {
    const dedupe = `${source.provider}:${source.animeId}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    out.push(source);
  }

  if (miruroEps && miruroEps.episodes.length > 0 && resolvedAnilist) {
    const nums = miruroEps.episodes.map((e) => e.number);
    push(
      stampSource({
        key: `miruro:${resolvedAnilist}`,
        provider: "miruro",
        label: labelFor("miruro"),
        animeId: resolvedAnilist,
        type: "hls",
        episodes: miruroEps.episodes.length,
        latestEpisode: latestFromNumbers(nums),
        malId: malNum ?? undefined,
      })
    );
  }

  if (anipubHit) {
    const eps = await safe(() => anipub.anipubEpisodes(anipubHit.id));
    const nums = eps?.episodes.map((e) => e.number) ?? [];
    push(
      stampSource({
        key: `anipub:${anipubHit.id}`,
        provider: "anipub",
        label: labelFor("anipub"),
        animeId: anipubHit.id,
        type: "embed",
        episodes: eps?.totalEpisodes ?? eps?.episodes.length ?? 0,
        latestEpisode: latestFromNumbers(nums),
      })
    );
  }

  for (const result of consumetHits) {
    if (result.status !== "fulfilled" || !result.value) continue;
    const { provider, id, episodes } = result.value;
    push(
      stampSource({
        key: `${provider}:${id}`,
        provider,
        label: labelFor(provider),
        animeId: id,
        type: "hls",
        episodes,
        latestEpisode: episodes,
      })
    );
  }

  return out.sort((a, b) => b.episodes - a.episodes);
}

async function miruroEpisodeSource(
  anilistId: string,
  epNum: number,
  fallbackEpisodeId?: string
): Promise<WatchSourceOption | null> {
  let episodeId = fallbackEpisodeId;
  if (!episodeId?.includes("~")) {
    const eps = await safe(() => miruro.miruroEpisodes(anilistId));
    const match = eps?.episodes.find((ep) => ep.number === epNum);
    if (!match) return null;
    episodeId = match.episodeId;
  }

  let status: WatchSourceOption["status"] = "unknown";
  let hasEmbed = false;
  try {
    const watch = await miruro.miruroWatch(episodeId);
    const referer = watch.headers?.Referer;
    hasEmbed = watch.sources.some(isMiruroEmbedSource);
    const hls = watch.sources.find((s) => s.isM3U8 !== false && !isMiruroEmbedSource(s));
    if (hls) {
      status = (await isHlsReachable(hls.url, referer)) ? "ok" : "blocked";
    } else if (hasEmbed) {
      status = "ok";
    }
  } catch {
    status = "unknown";
  }

  const useEmbed = status === "blocked" && hasEmbed;

  return {
    key: `miruro:${episodeId}`,
    provider: "miruro",
    label: "Miruro",
    type: useEmbed ? "embed" : "hls",
    status: useEmbed ? "ok" : status,
    episodeId,
    animeId: anilistId,
    server: useEmbed ? "embed" : undefined,
    note: useEmbed
      ? "Miruro embed player — HLS CDN blocked on server"
      : status === "blocked"
        ? "CDN may block this server — try another source"
        : undefined,
  };
}

async function anipubEpisodeSource(
  animeId: string,
  epNum: number,
  title?: string,
  malId?: string
): Promise<WatchSourceOption | null> {
  let anipubId = animeId;
  const numeric = Number(animeId);
  const malNum = malId && /^\d+$/.test(malId) ? Number(malId) : null;

  if (!Number.isFinite(numeric) || numeric >= 100_000) {
    if (malNum && title?.trim()) {
      const hit = await safe(() => anipub.anipubResolveByMal(malNum, title.trim()));
      if (!hit) return null;
      anipubId = hit.id;
    } else if (!title?.trim()) {
      return null;
    } else {
      const hits = await safe(() => anipub.anipubSearch(title.trim()));
      if (!hits?.[0]) return null;
      anipubId = hits[0].id;
    }
  }

  const eps = await safe(() => anipub.anipubEpisodes(anipubId));
  if (!eps || epNum < 1 || epNum > eps.totalEpisodes) return null;

  return {
    key: `anipub:${anipubId}:${epNum}`,
    provider: "anipub",
    label: labelFor("anipub"),
    type: "embed",
    status: "ok",
    episodeId: String(epNum),
    animeId: anipubId,
    note: "Embed player — hosted externally",
  };
}

async function consumetEpisodeSources(title: string, epNum: number): Promise<WatchSourceOption[]> {
  const options: WatchSourceOption[] = [];
  const providers = activeStreamProviders();
  if (providers.length === 0) return options;

  await Promise.allSettled(
    providers.map(async (provider) => {
      const data = await safe(() => consumet.consumetSearch(provider, title));
      const hit = pickTitleMatch(data?.results.map((r) => ({ ...r, name: r.title })) ?? [], title);
      if (!hit) return;

      const info = await safe(() => consumet.consumetInfo(provider, hit.id));
      const ep = info?.episodes.find((e) => e.number === epNum);
      if (!ep?.id) return;

      options.push({
        key: `${provider}:${ep.id}`,
        provider,
        label: labelFor(provider),
        type: "hls",
        status: "ok",
        episodeId: ep.id,
        animeId: hit.id,
      });
    })
  );

  return options;
}

export async function discoverWatchSources(options: {
  epNum: number;
  title: string;
  animeId?: string;
  episodeId?: string;
  malId?: string;
  anilistId?: string;
}): Promise<WatchSourceOption[]> {
  const { epNum, title, animeId, episodeId, malId } = options;
  const resolvedAnilist = await resolveAnilistId(malId, options.anilistId);

  const results = await Promise.allSettled([
    resolvedAnilist
      ? miruroEpisodeSource(resolvedAnilist, epNum, episodeId)
      : Promise.resolve(null),
    animeId || title
      ? anipubEpisodeSource(animeId ?? "", epNum, title, malId)
      : Promise.resolve(null),
    consumetEpisodeSources(title, epNum),
  ]);

  const out: WatchSourceOption[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const value = result.value;
    if (!value) continue;
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (seen.has(item.key)) continue;
      seen.add(item.key);
      out.push(item);
    }
  }

  return out.sort((a, b) => {
    const rank = (s: WatchSourceOption) => {
      if (s.status === "ok") return 0;
      if (s.status === "unknown") return 1;
      return 2;
    };
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (a.type === "hls" && b.type === "embed") return -1;
    if (a.type === "embed" && b.type === "hls") return 1;
    return a.label.localeCompare(b.label);
  });
}
