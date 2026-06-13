import { Link } from "react-router-dom";
import { continueWatchPath, getContinueWatching, type ContinueEntry } from "../lib/continueWatching";
import { proxyImageUrl } from "../lib/proxyImage";
import { useEffect, useState } from "react";

export function ContinueWatchingRow() {
  const [entries, setEntries] = useState<ContinueEntry[]>([]);

  useEffect(() => {
    setEntries(getContinueWatching());
  }, []);

  if (entries.length === 0) return null;

  return (
    <section className="catalog-row">
      <div className="catalog-row__header">
        <div>
          <h2 className="catalog-row__title">Continue Watching</h2>
          <p className="catalog-row__subtitle">Pick up where you left off.</p>
        </div>
      </div>
      <div className="catalog-row__track" tabIndex={0}>
        {entries.map((entry) => (
          <Link key={`${entry.animeId}-${entry.episodeId}`} to={continueWatchPath(entry)} className="continue-card group">
            <div className="continue-card__poster">
              <img src={proxyImageUrl(entry.poster)} alt={entry.title} loading="lazy" />
              <span className="continue-card__play">▶</span>
            </div>
            <p className="continue-card__title">{entry.title}</p>
            <p className="continue-card__ep">Episode {entry.epNum}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
