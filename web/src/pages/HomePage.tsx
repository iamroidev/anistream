import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell, SearchBar } from "../components/Layout";
import { HeroSpotlight } from "../components/HeroSpotlight";
import { CatalogRow } from "../components/CatalogRow";
import { GenreRail } from "../components/GenreRail";
import { ContinueWatchingRow } from "../components/ContinueWatchingRow";
import { EditorialCard } from "../components/ui/EditorialCard";
import { LuxuryButton } from "../components/ui/LuxuryButton";
import { api, CuratedHome } from "../api";

export default function HomePage() {
  const navigate = useNavigate();
  const [data, setData] = useState<CuratedHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setLoadError(null);
    api
      .curatedHome()
      .then(setData)
      .catch((e) => setLoadError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const featured = data?.spotlight[0] ?? data?.trending[0] ?? null;

  return (
    <Shell wide>
      <HeroSpotlight featured={featured} />

      <div className="home-search-band">
        <SearchBar onSearch={(q) => navigate(`/search?q=${encodeURIComponent(q)}`)} />
      </div>

      {loading ? (
        <div className="home-sections">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <div className="loading-shimmer h-5 w-48" />
              <div className="flex gap-3 overflow-hidden">
                {[1, 2, 3, 4, 5, 6].map((j) => (
                  <div key={j} className="loading-shimmer h-[220px] w-[150px] shrink-0" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <EditorialCard title="Could not load catalog" className="mt-8">
          <p className="font-sans text-sm text-taupe mb-4">{loadError}</p>
          <LuxuryButton variant="secondary" onClick={load}>
            Retry
          </LuxuryButton>
        </EditorialCard>
      ) : data ? (
        <div className="home-sections">
          <ContinueWatchingRow />

          <CatalogRow
            title="Trending Now"
            subtitle="What everyone is watching this week."
            items={data.trending}
            section="trending"
            badgeFor={(a) => (a.score && a.score >= 8.5 ? "Hot" : undefined)}
          />

          <CatalogRow
            title="Popular"
            subtitle="All-time fan favorites."
            items={data.popular}
            section="popular"
          />

          <CatalogRow
            title="New Episodes"
            subtitle="Currently airing simulcasts."
            items={data.recent}
            section="recent"
            badgeFor={(a) =>
              a.status?.toLowerCase().includes("releasing") ? "Simulcast" : undefined
            }
          />

          <CatalogRow
            title="This Season"
            subtitle="Fresh picks from the current cour."
            items={data.season}
            section="season"
          />

          <CatalogRow
            title="Coming Soon"
            subtitle="Upcoming premieres to add to your list."
            items={data.upcoming}
            section="upcoming"
            badgeFor={() => "Soon"}
          />

          <CatalogRow
            title="Top Rated"
            subtitle="Critics and community darlings."
            items={data.top}
            section="top"
            badgeFor={(a) => (a.score && a.score >= 8 ? "Top" : undefined)}
          />

          <GenreRail genres={data.genres} />
        </div>
      ) : null}
    </Shell>
  );
}
