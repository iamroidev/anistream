import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Shell } from "../components/Layout";
import { EditorialCard } from "../components/ui/EditorialCard";
import { BadgePill } from "../components/ui/BadgePill";
import { LuxuryButton } from "../components/ui/LuxuryButton";
import { MetricCard } from "../components/ui/MetricCard";
import { api, Episode, JikanAnime } from "../api";

interface AnimeInfo {
  id: string;
  name: string;
  poster: string;
  description: string;
  stats: { rating: string; quality: string; episodes: { sub: number; dub: number } };
  moreInfo: Record<string, string | string[]>;
}

export default function AnimePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const malId = searchParams.get("mal");
  const provider = searchParams.get("provider") ?? undefined;

  const [info, setInfo] = useState<AnimeInfo | null>(null);
  const [mal, setMal] = useState<JikanAnime | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    const malPromise = malId
      ? api.metadataById(Number(malId)).then((r) => r.data).catch(() => null)
      : Promise.resolve(null);

    Promise.all([api.animeInfo(id, provider), api.episodes(id, provider), malPromise])
      .then(([raw, eps, malData]) => {
        const anime = raw.anime.info as unknown as AnimeInfo;
        setInfo(anime);
        setEpisodes(eps.episodes);
        setMal(malData);
        return api.downloadSearch(anime.name).catch(() => null);
      })
      .then((dl) => {
        if (dl && typeof dl === "object" && dl !== null) {
          const results = (dl as { data?: { id?: string }[] }).data;
          if (results?.[0]?.id) setDownloadId(results[0].id);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id, malId, provider]);

  if (loading) {
    return (
      <Shell>
        <div className="flex justify-center py-24">
          <span className="spinner spinner--dark" />
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

  const subCount = info.stats.episodes.sub ?? episodes.length;
  const dubCount = info.stats.episodes.dub ?? 0;
  const firstEp = episodes[0];
  const synopsis = mal?.synopsis ?? stripHtml(info.description);
  const genres = mal?.genres?.map((g) => g.name) ?? [];

  return (
    <Shell>
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <div className="editorial-card overflow-hidden p-0">
          <img
            src={info.poster || mal?.images.jpg.large_image_url || ""}
            alt={info.name}
            className="w-full aspect-[2/3] object-cover"
          />
        </div>

        <div className="space-y-6">
          <EditorialCard tagline="Anime Detail" title={info.name}>
            <div className="flex flex-wrap gap-2 mb-6">
              <BadgePill variant="live">Sub · {subCount} eps</BadgePill>
              {dubCount > 0 && <BadgePill>Dub · {dubCount}</BadgePill>}
              {info.stats.quality && <BadgePill>{info.stats.quality}</BadgePill>}
              {mal?.score != null && <BadgePill>★ {mal.score.toFixed(1)} MAL</BadgePill>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <MetricCard label="Rating" value={info.stats.rating || mal?.score?.toFixed(1) || "—"} />
              <MetricCard label="Episodes" value={subCount} />
              <MetricCard label="Dub" value={dubCount || "—"} />
              <MetricCard label="Downloads" value={downloadId ? "Ready" : "—"} />
            </div>

            {genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {genres.map((g) => (
                  <span key={g} className="badge-pill">{g}</span>
                ))}
              </div>
            )}

            <p className="font-sans text-sm text-taupe leading-relaxed mb-6">{synopsis}</p>

            <div className="flex flex-wrap gap-3">
              {firstEp && (
                <Link to={watchUrl(id!, firstEp.episodeId, firstEp.number, provider)}>
                  <LuxuryButton>Watch Episode 1</LuxuryButton>
                </Link>
              )}
              {firstEp && downloadId && (
                <DownloadButton animetsuId={downloadId} ep={String(firstEp.number)} label="Download Ep 1" />
              )}
            </div>
          </EditorialCard>
        </div>
      </div>

      <EditorialCard
        tagline="Episode List"
        title={`${episodes.length} Episodes — Stream or Save`}
        className="mt-10"
      >
        <div className="flex flex-col gap-0 rounded-sm overflow-hidden border border-[var(--border-color)]">
          {episodes.map((ep) => (
            <div key={ep.episodeId} className="episode-row">
              <div className="flex-1 font-sans text-sm">
                <span className="font-medium theme-accent-text mr-3">
                  {String(ep.number).padStart(2, "0")}
                </span>
                {ep.title || `Episode ${ep.number}`}
                {ep.isFiller && <span className="ml-2 badge-pill">Filler</span>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Link to={watchUrl(id!, ep.episodeId, ep.number, provider)}>
                  <LuxuryButton variant="primary" className="!py-2 !px-4 !text-[0.65rem]">
                    Stream
                  </LuxuryButton>
                </Link>
                {downloadId && (
                  <DownloadButton animetsuId={downloadId} ep={String(ep.number)} />
                )}
              </div>
            </div>
          ))}
        </div>
      </EditorialCard>
    </Shell>
  );
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

function watchUrl(animeId: string, episodeId: string, ep: number, provider?: string) {
  const params = new URLSearchParams({ ep: String(ep) });
  if (provider) params.set("provider", provider);
  return `/watch/${animeId}/${episodeId}?${params}`;
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
