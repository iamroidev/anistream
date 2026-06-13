import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Shell } from "../components/Layout";
import { EditorialCard } from "../components/ui/EditorialCard";
import { BadgePill } from "../components/ui/BadgePill";
import { LuxuryButton } from "../components/ui/LuxuryButton";
import { MetricCard } from "../components/ui/MetricCard";
import { SourcePicker, type SourceOption } from "../components/SourcePicker";
import { EpisodeList } from "../components/EpisodeList";
import { api, CatalogSource, Episode, JikanAnime } from "../api";
import { proxyImageUrl } from "../lib/proxyImage";
interface AnimeInfo {
  id: string;
  name: string;
  poster: string;
  description: string;
  stats: {
    rating: string;
    quality: string;
    episodes: { sub: number; dub: number; planned?: number };
  };
  moreInfo: Record<string, string | string[]>;
}

export default function AnimePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const malId = searchParams.get("mal");
  const anilistId = searchParams.get("anilist");
  const providerParam = searchParams.get("provider") ?? undefined;

  const [info, setInfo] = useState<AnimeInfo | null>(null);
  const [mal, setMal] = useState<JikanAnime | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | undefined>(providerParam);
  const [loading, setLoading] = useState(true);
  const [resolvingStream, setResolvingStream] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [catalogSources, setCatalogSources] = useState<CatalogSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [activeSourceKey, setActiveSourceKey] = useState<string | null>(null);
  const [relatedSeasons, setRelatedSeasons] = useState<
    { relation: string; mal_id: number; name: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [streamMeta, setStreamMeta] = useState<{ provider?: string; category?: string } | null>(null);
  const [zenshinPlanned, setZenshinPlanned] = useState<number | null>(null);
  const [checkingNew, setCheckingNew] = useState(false);
  const [newEpisodeCount, setNewEpisodeCount] = useState(0);
  const [newSourceKeys, setNewSourceKeys] = useState<Set<string>>(new Set());
  const sourceBaselineRef = useRef<Map<string, { episodes: number; latestEpisode: number }>>(
    new Map()
  );

  const POLL_MS = 5 * 60 * 1000;

  function setSourceBaseline(sources: CatalogSource[]) {
    const next = new Map<string, { episodes: number; latestEpisode: number }>();
    for (const s of sources) {
      next.set(s.key, { episodes: s.episodes, latestEpisode: s.latestEpisode });
    }
    sourceBaselineRef.current = next;
  }

  const loadStreamSource = useCallback(
    async (activeStreamId: string, activeProvider?: string) => {
      const resolvedMal = malId ? Number(malId) : undefined;
      const resolvedAnilist =
        activeProvider === "miruro"
          ? anilistId
            ? Number(anilistId)
            : /^\d+$/.test(activeStreamId)
              ? Number(activeStreamId)
              : undefined
          : anilistId
            ? Number(anilistId)
            : undefined;

      const [raw, eps] = await Promise.all([
        api.animeInfo(activeStreamId, activeProvider),
        api.episodes(activeStreamId, activeProvider, {
          malId: Number.isFinite(resolvedMal) ? resolvedMal : undefined,
          anilistId: Number.isFinite(resolvedAnilist) ? resolvedAnilist : undefined,
        }),
      ]);

      const anime = raw.anime.info as unknown as AnimeInfo;
      setStreamId(activeStreamId);
      setProvider(activeProvider);
      setInfo(anime);
      setEpisodes(eps.episodes);
      setZenshinPlanned(eps.zenshin?.planned ?? null);
      setStreamMeta({
        provider: eps.streamProvider ?? activeProvider,
        category: eps.category ?? undefined,
      });
      setStreamError(null);

      api.downloadSearch(anime.name)
        .then((dl) => {
          if (!dl || typeof dl !== "object") return;
          const results = (dl as { data?: { id?: string }[] }).data;
          if (results?.[0]?.id) setDownloadId(results[0].id);
        })
        .catch(() => {});
    },
    [malId, anilistId]
  );

  const discoverSources = useCallback(
    async (title: string, options?: { autoPick?: boolean }) => {
      const autoPick = options?.autoPick ?? false;
      const parsedMal = malId ? Number(malId) : undefined;
      const parsedAnilist = anilistId ? Number(anilistId) : undefined;

      setSourcesLoading(true);
      setStreamError(null);
      try {
        const data = await api.catalogSources(id ?? "", title, {
          malId: Number.isFinite(parsedMal) ? parsedMal : undefined,
          anilistId: Number.isFinite(parsedAnilist) ? parsedAnilist : undefined,
        });
        setCatalogSources(data.sources);
        setSourceBaseline(data.sources);
        setNewEpisodeCount(0);
        setNewSourceKeys(new Set());

        if (data.sources.length === 0) {
          setStreamError("No stream sources found for this title.");
          return;
        }

        if (autoPick && data.sources.length === 1) {
          const only = data.sources[0];
          setActiveSourceKey(only.key);
          await loadStreamSource(only.animeId, only.provider);
          return;
        }

        if (providerParam) {
          const match = data.sources.find((s) => s.provider === providerParam);
          if (match) {
            setActiveSourceKey(match.key);
            await loadStreamSource(match.animeId, match.provider);
            return;
          }
        }
      } catch (e) {
        setStreamError(String(e));
      } finally {
        setSourcesLoading(false);
      }
    },
    [id, malId, anilistId, providerParam, loadStreamSource]
  );

  const checkForNewEpisodes = useCallback(
    async (options?: { reloadActive?: boolean }) => {
      if (catalogSources.length === 0) return;
      const title = info?.name ?? mal?.title_english ?? mal?.title;
      if (!title) return;

      setCheckingNew(true);
      try {
        const { snapshots } = await api.refreshCatalogSources({
          sources: catalogSources.map((s) => ({
            key: s.key,
            provider: s.provider,
            animeId: s.animeId,
          })),
          title,
          malId: malId ?? undefined,
          anilistId: anilistId ?? undefined,
        });

        if (snapshots.length === 0) return;

        const baseline = sourceBaselineRef.current;
        const gainedKeys = new Set<string>();
        let gainedTotal = 0;

        setCatalogSources((prev) =>
          prev.map((s) => {
            const snap = snapshots.find((x) => x.key === s.key);
            if (!snap) return s;
            const base = baseline.get(s.key);
            const epGain = base ? Math.max(0, snap.episodes - base.episodes) : 0;
            const latestGain = base
              ? Math.max(0, snap.latestEpisode - base.latestEpisode)
              : 0;
            const gain = Math.max(epGain, latestGain);
            if (gain > 0) {
              gainedKeys.add(s.key);
              gainedTotal += gain;
            }
            baseline.set(s.key, {
              episodes: snap.episodes,
              latestEpisode: snap.latestEpisode,
            });
            return {
              ...s,
              episodes: snap.episodes,
              latestEpisode: snap.latestEpisode,
              checkedAt: snap.checkedAt,
            };
          })
        );

        if (gainedTotal > 0) {
          setNewEpisodeCount((n) => n + gainedTotal);
          setNewSourceKeys((prev) => new Set([...prev, ...gainedKeys]));
        }

        const shouldReload =
          (options?.reloadActive ?? true) &&
          activeSourceKey &&
          gainedKeys.has(activeSourceKey) &&
          streamId &&
          provider;

        if (shouldReload) {
          await loadStreamSource(streamId, provider);
        }
      } catch {
        // Silent on background poll — manual button shows no error either to avoid noise
      } finally {
        setCheckingNew(false);
      }
    },
    [
      catalogSources,
      info?.name,
      mal?.title,
      mal?.title_english,
      malId,
      anilistId,
      activeSourceKey,
      streamId,
      provider,
      loadStreamSource,
    ]
  );

  useEffect(() => {
    if (!malId) return;
    api
      .metadataRelations(Number(malId))
      .then((r) => setRelatedSeasons(r.data))
      .catch(() => setRelatedSeasons([]));
  }, [malId]);

  const isOngoing =
    Boolean(mal?.status?.toLowerCase().includes("airing")) ||
    Boolean(mal?.status?.toLowerCase().includes("releasing"));

  useEffect(() => {
    if (!isOngoing || catalogSources.length === 0) return;
    const timer = window.setInterval(() => {
      void checkForNewEpisodes({ reloadActive: true });
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [isOngoing, catalogSources.length, checkForNewEpisodes]);

  useEffect(() => {
    if (!id) return;
    const animeId = id;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setStreamError(null);
      setEpisodes([]);
      setDownloadId(null);
      setStreamMeta(null);
      setZenshinPlanned(null);

      const parsedAnilist = anilistId ? Number(anilistId) : NaN;
      const hasMiruroId = providerParam === "miruro" || (Number.isFinite(parsedAnilist) && parsedAnilist > 0);
      const hasStreamId = providerParam ? true : !/^\d+$/.test(animeId) || hasMiruroId;
      let activeStreamId = hasStreamId
        ? hasMiruroId && Number.isFinite(parsedAnilist)
          ? String(parsedAnilist)
          : animeId
        : null;
      let activeProvider = providerParam ?? (hasMiruroId ? "miruro" : undefined);

      let malData: JikanAnime | null = null;
      try {
        if (malId) {
          malData = await api.metadataById(Number(malId)).then((r) => r.data).catch(() => null);
          if (cancelled) return;
          setMal(malData);
          if (malData) {
            setInfo(malFromJikan(malData, animeId));
            setLoading(false);
          }
        }

        if (!activeStreamId && malData) {
          const title = malData.title_english || malData.title;
          await discoverSources(title);
          if (cancelled) return;
          return;
        }

        if (!activeStreamId) {
          if (malData) {
            setStreamId(null);
            setProvider(undefined);
            setStreamError("No stream source found. Tap Find Stream to retry.");
            return;
          }
          throw new Error("Anime not found");
        }

        await loadStreamSource(activeStreamId, activeProvider);
        if (cancelled) return;
        const title = malData?.title_english || malData?.title;
        if (title) void discoverSources(title);
      } catch (e) {
        if (cancelled) return;
        if (malData) {
          setInfo(malFromJikan(malData, animeId));
          setStreamError(String(e));
        } else {
          setError(String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, malId, anilistId, providerParam, discoverSources, loadStreamSource]);

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <span className="spinner spinner--dark" />
          {resolvingStream && (
            <p className="font-sans text-xs text-taupe uppercase tracking-widest">
              Finding stream source…
            </p>
          )}
        </div>
      </Shell>
    );
  }

  if (error || !info) {
    return (
      <Shell>
        <EditorialCard tagline="Error" title="Could not load anime">
          <p className="font-sans text-sm text-taupe">{error ?? "Not found"}</p>
          <Link to="/search" className="luxury-btn luxury-btn--secondary mt-6 inline-flex no-underline">
            Back to Search
          </Link>
        </EditorialCard>
      </Shell>
    );
  }

  const streamableEpisodes = episodes.filter((ep) => ep.streamable !== false);
  const catalogOnlyEpisodes = episodes.filter((ep) => ep.streamable === false);

  const streamableCount = streamableEpisodes.length;
  const malOfficial = mal?.episodes ?? null;
  const seriesTotal = malOfficial && malOfficial > 0 ? malOfficial : episodes.length;
  const extrasInStream =
    malOfficial && malOfficial > 0 && streamableCount > malOfficial
      ? streamableCount - malOfficial
      : 0;
  const firstEp = streamableEpisodes[0];
  const synopsis = mal?.synopsis ?? stripHtml(info.description);
  const genres = mal?.genres?.map((g) => g.name) ?? [];
  const status = mal?.status ?? String(info.moreInfo?.status ?? "");
  const dubCount = info.stats.episodes.dub ?? 0;
  const canStream = Boolean(streamId && firstEp);
  const episodeCountLabel = formatEpisodeCounts(streamableCount, seriesTotal);

  async function handlePickCatalogSource(source: SourceOption) {
    const full = catalogSources.find((s) => s.key === source.key);
    if (!full) return;
    setResolvingStream(true);
    setStreamError(null);
    setActiveSourceKey(full.key);
    try {
      await loadStreamSource(full.animeId, full.provider);
    } catch (e) {
      setStreamError(String(e));
    } finally {
      setResolvingStream(false);
    }
  }

  const catalogSourceOptions: SourceOption[] = catalogSources.map((s) => ({
    key: s.key,
    provider: s.provider,
    label: s.label,
    type: s.type,
    episodes: s.episodes,
    latestEpisode: s.latestEpisode,
    checkedAt: s.checkedAt,
    hasNew: newSourceKeys.has(s.key),
  }));
  return (
    <Shell>
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <div className="editorial-card overflow-hidden p-0">
          <img
            src={proxyImageUrl(info.poster) || mal?.images.jpg.large_image_url || ""}
            alt={info.name}
            className="w-full aspect-[2/3] object-cover"
          />
        </div>

        <div className="space-y-6">
          <EditorialCard tagline="Anime Detail" title={info.name}>
            <div className="flex flex-wrap gap-2 mb-6">
              {streamableCount > 0 ? (
                <BadgePill variant="live">{streamableCount} streamable now</BadgePill>
              ) : seriesTotal > 0 ? (
                <BadgePill variant="live">{seriesTotal} in series catalog</BadgePill>
              ) : null}
              {seriesTotal > streamableCount && (
                <BadgePill>
                  {seriesTotal} episode series
                </BadgePill>
              )}
              {catalogOnlyEpisodes.length > 0 && (
                <BadgePill>{catalogOnlyEpisodes.length} not yet uploaded</BadgePill>
              )}
              {status && <BadgePill>{status}</BadgePill>}
              {dubCount > 0 && <BadgePill>Dub · {dubCount}</BadgePill>}
              {info.stats.quality && <BadgePill>{info.stats.quality}</BadgePill>}
              {streamMeta?.provider && <BadgePill>Source · {streamMeta.provider}</BadgePill>}
              {zenshinPlanned != null && <BadgePill>Catalog · Zenshin</BadgePill>}
              {mal?.score != null && <BadgePill>★ {mal.score.toFixed(1)} MAL</BadgePill>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <MetricCard label="Rating" value={info.stats.rating || mal?.score?.toFixed(1) || "—"} />
              <MetricCard label="Streamable" value={streamableCount || "—"} />
              <MetricCard label="Series Total" value={seriesTotal || "—"} />
              <MetricCard label="Downloads" value={downloadId ? "Ready" : "—"} />
            </div>

            {seriesTotal > streamableCount && streamableCount > 0 && (
              <p className="font-sans text-xs text-taupe mb-6 leading-relaxed">
                {streamableCount} of {seriesTotal} episodes are available to stream right now.
                {catalogOnlyEpisodes.length > 0
                  ? ` ${catalogOnlyEpisodes.length} more are listed in the catalog but not uploaded yet.`
                  : ""}
                {status.toLowerCase().includes("airing")
                  ? " New episodes appear as providers publish them."
                  : ""}
              </p>
            )}
            {extrasInStream > 0 && (
              <p className="font-sans text-xs text-taupe mb-6 leading-relaxed">
                This source lists {streamableCount} playable entries ({extrasInStream} extra vs MAL&apos;s{" "}
                {malOfficial} — often OVAs or specials bundled by the host).
              </p>
            )}

            {genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {genres.map((g) => (
                  <Link
                    key={g}
                    to={`/browse/genre?genre=${encodeURIComponent(g)}`}
                    className="badge-pill no-underline"
                  >
                    {g}
                  </Link>
                ))}
              </div>
            )}

            <p className="font-sans text-sm text-taupe leading-relaxed mb-6">{synopsis}</p>

            {streamError && (
              <p className="font-sans text-sm text-taupe mb-6 border border-[var(--border-color)] rounded-sm p-4">
                {friendlyStreamError(streamError)}
              </p>
            )}

            {relatedSeasons.length > 0 && (
              <div className="season-rail mb-6">
                <p className="editorial-tagline mb-2">More seasons & related</p>
                <div className="season-rail__chips">
                  {relatedSeasons.map((rel) => (
                    <Link
                      key={`${rel.relation}-${rel.mal_id}`}
                      to={`/anime/${rel.mal_id}?mal=${rel.mal_id}`}
                      className="badge-pill no-underline"
                    >
                      {rel.relation}: {rel.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {resolvingStream && (
              <p className="font-sans text-xs text-taupe uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="spinner spinner--dark" style={{ width: 14, height: 14 }} />
                Finding stream source…
              </p>
            )}

            {newEpisodeCount > 0 && (
              <div className="new-episodes-banner mb-6">
                <p className="font-sans text-sm m-0">
                  <strong className="theme-accent-text">+{newEpisodeCount} new episode{newEpisodeCount === 1 ? "" : "s"}</strong>
                  {" "}detected on one or more sources since you opened this page.
                </p>
                <button
                  type="button"
                  className="new-episodes-banner__dismiss"
                  onClick={() => {
                    setNewEpisodeCount(0);
                    setNewSourceKeys(new Set());
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}

            {isOngoing && catalogSourceOptions.length > 0 && (
              <p className="font-sans text-xs text-taupe mb-4 m-0">
                Auto-checking sources every 5 minutes while this series is airing.
              </p>
            )}

            {(catalogSourceOptions.length > 0 || sourcesLoading) && (
              <div className="mb-6">
                <SourcePicker
                  sources={catalogSourceOptions}
                  activeKey={activeSourceKey}
                  loading={sourcesLoading}
                  onSelect={handlePickCatalogSource}
                  onCheckNew={() => void checkForNewEpisodes()}
                  checkingNew={checkingNew}
                  title="Choose a catalog source"
                  subtitle="Different hosts may have different episode counts, dubs, or upload speed."
                />
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {canStream && (
                <Link to={watchUrl(streamId!, firstEp!.episodeId, firstEp!.number, provider, malId, anilistId)}>
                  <LuxuryButton>Watch Episode 1</LuxuryButton>
                </Link>
              )}
              {canStream && downloadId && (
                <DownloadButton animetsuId={downloadId} ep={String(firstEp!.number)} label="Download Ep 1" />
              )}
              {!canStream && !sourcesLoading && catalogSourceOptions.length === 0 && (
                <LuxuryButton
                  loading={resolvingStream}
                  onClick={() => discoverSources(info.name)}
                >
                  Find sources
                </LuxuryButton>
              )}
            </div>
          </EditorialCard>
        </div>
      </div>

      {episodes.length > 0 && streamId && (
        <EditorialCard
          tagline="Episode List"
          title={`${episodeCountLabel} — Stream or Save`}
          className="mt-10"
        >
          <EpisodeList
            episodes={episodes}
            streamId={streamId}
            provider={provider}
            malId={malId}
            anilistId={anilistId}
          />
        </EditorialCard>
      )}
    </Shell>
  );
}

function friendlyStreamError(msg: string): string {
  if (msg.includes("500") && msg.toLowerCase().includes("internal server error")) {
    return "That stream host returned a server error. Pick a different source above and try again.";
  }
  if (msg.includes("502") || msg.includes("503") || msg.includes("504")) {
    return "Stream host is temporarily unavailable. Try another source.";
  }
  return msg.replace(/^Error:\s*/i, "");
}

function malFromJikan(mal: JikanAnime, fallbackId: string): AnimeInfo {
  return {
    id: fallbackId,
    name: mal.title_english || mal.title,
    poster: mal.images.jpg.large_image_url,
    description: mal.synopsis ?? "",
    stats: {
      rating: mal.score?.toFixed(1) ?? "—",
      quality: "HD",
      episodes: { sub: mal.episodes ?? 0, planned: mal.episodes ?? 0, dub: 0 },
    },
    moreInfo: {},
  };
}

function DownloadButton({
  animetsuId,
  ep,
  label = "Save",
}: {
  animetsuId: string;
  ep: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const data = await api.downloads(animetsuId, ep);
      const links = extractDownloadLinks(data);
      if (links[0]) {
        window.open(links[0], "_blank");
      } else {
        alert("No download link available for this episode.");
      }
    } catch {
      alert("Download unavailable. Try streaming instead.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LuxuryButton
      variant="secondary"
      loading={loading}
      className="!py-2 !px-4 !text-[0.65rem]"
      onClick={handleDownload}
    >
      {label}
    </LuxuryButton>
  );
}

function watchUrl(
  animeId: string,
  episodeId: string,
  ep: number,
  provider?: string,
  mal?: string | null,
  anilist?: string | null
) {
  const params = new URLSearchParams({ ep: String(ep) });
  if (provider) params.set("provider", provider);
  if (mal) params.set("mal", mal);
  if (anilist) params.set("anilist", anilist);
  return `/watch/${animeId}/${episodeId}?${params}`;
}

function formatEpisodeCounts(streamable: number, seriesTotal: number | null): string {
  if (streamable > 0 && seriesTotal != null && seriesTotal > streamable) {
    return `${streamable} of ${seriesTotal} Episodes`;
  }
  if (streamable > 0) return `${streamable} Episodes`;
  if (seriesTotal != null && seriesTotal > 0) return `${seriesTotal} Episodes (catalog)`;
  return "Episodes";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

function extractDownloadLinks(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const links: string[] = [];

  function walk(o: unknown) {
    if (!o || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === "string" && (k.includes("url") || k.includes("link") || v.startsWith("http"))) {
        if (v.startsWith("http")) links.push(v);
      } else if (typeof v === "object") {
        walk(v);
      }
    }
  }
  walk(data);
  return [...new Set(links)];
}
