import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Shell } from "../components/Layout";
import { SourcePicker, type SourceOption } from "../components/SourcePicker";
import { VideoPlayer, type SubtitleTrack } from "../components/VideoPlayer";
import { EditorialCard } from "../components/ui/EditorialCard";
import { LuxuryButton } from "../components/ui/LuxuryButton";
import { BadgePill } from "../components/ui/BadgePill";
import { api, type WatchSourceOption } from "../api";
import { saveContinueWatching } from "../lib/continueWatching";
import { proxyImageUrl } from "../lib/proxyImage";

const SOURCE_KEY = "anistream:last-source";

function toSourceOption(s: WatchSourceOption): SourceOption {
  return {
    key: s.key,
    provider: s.provider,
    label: s.label,
    type: s.type,
    status: s.status,
    note: s.note,
  };
}

function pickDefaultSource(sources: WatchSourceOption[]): WatchSourceOption | null {
  const saved = localStorage.getItem(SOURCE_KEY);
  if (saved) {
    const hit = sources.find((s) => s.key === saved && s.status !== "blocked");
    if (hit) return hit;
  }
  const ok = sources.find((s) => s.status === "ok");
  if (ok) return ok;
  const fallback = sources.find((s) => s.status !== "blocked");
  return fallback ?? null;
}

export default function WatchPage() {
  const { animeId, episodeId } = useParams<{ animeId: string; episodeId: string }>();
  const [params, setParams] = useSearchParams();
  const epNum = params.get("ep") ?? "?";
  const malId = params.get("mal") ?? undefined;
  const anilistId = params.get("anilist") ?? undefined;

  const [sources, setSources] = useState<WatchSourceOption[]>([]);
  const [activeSource, setActiveSource] = useState<WatchSourceOption | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamFallbackUrl, setStreamFallbackUrl] = useState<string | undefined>();
  const [streamEmbed, setStreamEmbed] = useState(false);
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [poster, setPoster] = useState<string | undefined>();
  const [streamLoading, setStreamLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animeTitle, setAnimeTitle] = useState("");

  const loadStream = useCallback(
    async (source: WatchSourceOption) => {
      if (!episodeId) return;
      setStreamLoading(true);
      setError(null);
      setActiveSource(source);
      localStorage.setItem(SOURCE_KEY, source.key);

      const next = new URLSearchParams(params);
      next.set("provider", source.provider);
      next.set("source", source.key);
      if (source.server) next.set("server", source.server);
      if (source.category) next.set("category", source.category);
      setParams(next, { replace: true });

      if (source.status === "blocked") {
        setStreamUrl(null);
        setStreamFallbackUrl(undefined);
        setSubtitles([]);
        setStreamEmbed(false);
        setError(
          source.note ??
            "This source is blocked on the server — pick an embed source or wait for another host."
        );
        setStreamLoading(false);
        return;
      }

      try {
        const data = await api.watch(
          source.episodeId,
          source.server ?? "hd-1",
          source.category ?? "sub",
          source.provider,
          source.animeId ?? animeId,
          animeTitle || undefined
        );
        const streamSource = data.sources?.[0];
        if (!streamSource?.url) throw new Error("No stream source returned");

        setStreamUrl(streamSource.url);
        setStreamFallbackUrl(
          "originalUrl" in streamSource && typeof streamSource.originalUrl === "string"
            ? streamSource.originalUrl
            : undefined
        );
        setSubtitles(
          (data.tracks ?? []).map((t) => ({
            url: t.file,
            label: t.label,
            lang: t.label,
            default: t.default,
          }))
        );
        setStreamEmbed(streamSource.type === "embed" || source.type === "embed");
      } catch (e) {
        setError(String(e));
        setStreamUrl(null);
        setStreamFallbackUrl(undefined);
        setSubtitles([]);
        setStreamEmbed(false);
      } finally {
        setStreamLoading(false);
      }
    },
    [episodeId, animeId, animeTitle, params, setParams]
  );

  const loadSources = useCallback(async () => {
    if (!episodeId || !animeTitle) return;
    const ep = Number(epNum);
    if (!Number.isFinite(ep)) return;

    setSourcesLoading(true);
    setError(null);
    try {
      const data = await api.watchSources(episodeId, {
        ep,
        title: animeTitle,
        animeId,
        malId,
        anilistId,
      });
      setSources(data.sources);

      const urlKey = params.get("source");
      const urlProvider = params.get("provider");
      const picked =
        (urlKey && data.sources.find((s) => s.key === urlKey && s.status !== "blocked")) ||
        (urlProvider &&
          data.sources.find((s) => s.provider === urlProvider && s.status !== "blocked")) ||
        pickDefaultSource(data.sources);

      if (picked) {
        setActiveSource(picked);
        if (picked.status === "blocked") {
          setError(
            picked.note ??
              "This source is blocked on the server — pick an embed source or wait for another host."
          );
        } else {
          void loadStream(picked);
        }
      } else {
        setActiveSource(null);
      }
    } catch (e) {
      setError(String(e));
      setSources([]);
      setActiveSource(null);
    } finally {
      setSourcesLoading(false);
    }
  }, [episodeId, epNum, animeTitle, animeId, malId, anilistId, params, loadStream]);

  useEffect(() => {
    if (!animeId) return;
    const provider = params.get("provider") ?? undefined;
    api
      .animeInfo(animeId, provider)
      .then((d) => {
        const info = d.anime.info as { poster?: string; name?: string };
        setPoster(proxyImageUrl(info.poster));
        if (info.name) setAnimeTitle(info.name);
      })
      .catch(() => {});
  }, [animeId, params]);

  useEffect(() => {
    if (animeTitle) void loadSources();
  }, [animeTitle, loadSources]);

  useEffect(() => {
    if (!animeId || !episodeId || !streamUrl || !poster) return;
    const ep = Number(epNum);
    if (!Number.isFinite(ep)) return;

    saveContinueWatching({
      animeId,
      episodeId: activeSource?.episodeId ?? episodeId,
      epNum: ep,
      title: animeTitle || `Episode ${epNum}`,
      poster,
      provider: activeSource?.provider,
    });
  }, [animeId, episodeId, streamUrl, poster, epNum, animeTitle, activeSource]);

  const backParams = new URLSearchParams();
  if (params.get("provider")) backParams.set("provider", params.get("provider")!);
  if (malId) backParams.set("mal", malId);
  if (anilistId) backParams.set("anilist", anilistId);

  function handleSelectSource(opt: SourceOption) {
    const full = sources.find((s) => s.key === opt.key);
    if (!full || full.key === activeSource?.key) return;
    void loadStream(full);
  }

  return (
    <Shell>
      <div className="mb-6">
        <Link
          to={`/anime/${animeId}${backParams.toString() ? `?${backParams}` : ""}`}
          className="font-sans text-xs uppercase tracking-widest text-taupe no-underline hover:text-gold-dark transition"
        >
          ← Back to Episodes
        </Link>
      </div>

      <EditorialCard tagline="Now Playing" title={`Episode ${epNum}`} className="mb-8">
        <div className="flex flex-wrap gap-2 mb-6">
          {activeSource && <BadgePill variant="live">Source · {activeSource.label}</BadgePill>}
          {activeSource?.type === "embed" && <BadgePill>Embed</BadgePill>}
          {activeSource?.category && <BadgePill>{activeSource.category.toUpperCase()}</BadgePill>}
        </div>

        <SourcePicker
          sources={sources.map(toSourceOption)}
          activeKey={activeSource?.key}
          loading={sourcesLoading}
          onSelect={handleSelectSource}
          title="Choose a source"
          subtitle="Each source is a different host — switch if one buffers, blocks, or has the wrong audio."
        />

        {(streamLoading || sourcesLoading) && (
          <div className="flex justify-center py-16">
            <span className="spinner spinner--dark" />
          </div>
        )}

        {error && !streamLoading && (
          <div className="text-center py-10 mt-6 border border-[var(--border-color)] rounded-sm">
            <p className="font-sans text-sm text-taupe mb-4">{error}</p>
            <p className="font-sans text-xs text-taupe mb-4">
              Try a different source above — embed players often work when HLS is blocked.
            </p>
            {activeSource && (
              <LuxuryButton onClick={() => loadStream(activeSource)}>Retry source</LuxuryButton>
            )}
          </div>
        )}

        {!streamLoading && streamUrl && activeSource?.status !== "blocked" && (
          <div className="mt-8">
            <VideoPlayer
              src={streamUrl}
              fallbackSrc={streamFallbackUrl}
              poster={poster}
              embed={streamEmbed}
              subtitles={subtitles}
            />
          </div>
        )}
      </EditorialCard>
    </Shell>
  );
}
