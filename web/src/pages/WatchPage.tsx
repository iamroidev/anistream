import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Shell } from "../components/Layout";
import { VideoPlayer } from "../components/VideoPlayer";
import { EditorialCard } from "../components/ui/EditorialCard";
import { LuxuryButton } from "../components/ui/LuxuryButton";
import { BadgePill } from "../components/ui/BadgePill";
import { api } from "../api";

export default function WatchPage() {
  const { animeId, episodeId } = useParams<{ animeId: string; episodeId: string }>();
  const [params] = useSearchParams();
  const epNum = params.get("ep") ?? "?";
  const provider = params.get("provider") ?? undefined;

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | undefined>();
  const [servers, setServers] = useState<string[]>([]);
  const [category, setCategory] = useState<"sub" | "dub">("sub");
  const [activeServer, setActiveServer] = useState("hd-1");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);

  useEffect(() => {
    if (!episodeId || provider) return;
    api
      .watchServers(episodeId)
      .then((s) => {
        const names = [...s.sub.map((x) => x.serverName), ...s.dub.map((x) => x.serverName)];
        setServers([...new Set(names)]);
        if (s.sub[0]) setActiveServer(s.sub[0].serverName.toLowerCase());
      })
      .catch(() => {});
  }, [episodeId, provider]);

  useEffect(() => {
    if (!episodeId) return;
    loadStream(activeServer, category);
  }, [episodeId, activeServer, category, provider]);

  useEffect(() => {
    if (!animeId) return;
    api
      .animeInfo(animeId, provider)
      .then((d) => {
        const info = d.anime.info as { poster?: string; name?: string };
        setPoster(info.poster);
      })
      .catch(() => {});
  }, [animeId, provider]);

  async function loadStream(server: string, cat: "sub" | "dub") {
    if (!episodeId) return;
    setLoading(true);
    setError(null);

    try {
      const data = await api.watch(episodeId, server, cat, provider);
      const url = data.sources?.[0]?.url;
      if (!url) throw new Error("No stream source returned");
      setStreamUrl(url);
      setActiveProvider(data.provider ?? provider ?? "hianime");
    } catch (e) {
      setError(String(e));
      setStreamUrl(null);
      setActiveProvider(null);
    } finally {
      setLoading(false);
    }
  }

  const isFallback = activeProvider != null && activeProvider !== "hianime";

  return (
    <Shell>
      <div className="mb-6">
        <Link
          to={`/anime/${animeId}${provider ? `?provider=${provider}` : ""}`}
          className="font-sans text-xs uppercase tracking-widest text-taupe no-underline hover:text-gold-dark transition"
        >
          ← Back to Episodes
        </Link>
      </div>

      <EditorialCard
        tagline="Now Playing"
        title={`Episode ${epNum}`}
        className="mb-8"
      >
        <div className="flex flex-wrap gap-2 mb-6">
          <BadgePill variant="live">
            {activeProvider ? `Source · ${activeProvider}` : "Loading"}
          </BadgePill>
          {isFallback && <BadgePill>Auto-fallback</BadgePill>}
          <BadgePill>{category.toUpperCase()}</BadgePill>
          {!isFallback && servers.length > 0 && <BadgePill>{activeServer}</BadgePill>}
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <span className="spinner spinner--dark" />
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-12">
            <p className="font-sans text-sm text-taupe mb-4">{error}</p>
            <LuxuryButton onClick={() => loadStream(activeServer, category)}>
              Retry
            </LuxuryButton>
          </div>
        )}

        {!loading && streamUrl && <VideoPlayer src={streamUrl} poster={poster} />}

        {!loading && servers.length > 0 && !provider && (
          <div className="mt-6 pt-6 card-divider">
            <p className="editorial-tagline mb-3">Server Selection</p>
            <div className="flex flex-wrap gap-2">
              {servers.map((s) => (
                <LuxuryButton
                  key={s}
                  variant={activeServer === s.toLowerCase() ? "primary" : "secondary"}
                  className="!py-2 !px-4 !text-[0.65rem]"
                  onClick={() => setActiveServer(s.toLowerCase())}
                >
                  {s}
                </LuxuryButton>
              ))}
              <LuxuryButton
                variant={category === "sub" ? "primary" : "secondary"}
                className="!py-2 !px-4 !text-[0.65rem]"
                onClick={() => setCategory("sub")}
              >
                Sub
              </LuxuryButton>
              <LuxuryButton
                variant={category === "dub" ? "primary" : "secondary"}
                className="!py-2 !px-4 !text-[0.65rem]"
                onClick={() => setCategory("dub")}
              >
                Dub
              </LuxuryButton>
            </div>
          </div>
        )}
      </EditorialCard>
    </Shell>
  );
}
