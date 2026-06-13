import { useState } from "react";
import { Link } from "react-router-dom";
import { Episode } from "../api";
import { episodeReleaseLabel } from "../lib/formatAirDate";
import { EpisodePagination } from "./EpisodePagination";
import { LuxuryButton } from "./ui/LuxuryButton";

type ViewMode = "grid" | "list";

const GRID_PAGE_SIZE = 12;
const LIST_PAGE_SIZE = 8;

export function EpisodeList({
  episodes,
  streamId,
  provider,
  malId,
  anilistId,
}: {
  episodes: Episode[];
  streamId: string;
  provider?: string;
  malId?: string | null;
  anilistId?: string | null;
}) {
  const [view, setView] = useState<ViewMode>("grid");
  const pageSize = view === "grid" ? GRID_PAGE_SIZE : LIST_PAGE_SIZE;

  return (
    <div className="episode-list">
      <div className="episode-list__toolbar">
        <p className="episode-list__hint font-sans text-xs text-taupe m-0">
          {view === "grid"
            ? "Tap an episode to watch. Switch to list view for synopses."
            : "Detailed list with descriptions — fewer episodes per page."}
        </p>
        <div className="episode-view-toggle" role="tablist" aria-label="Episode layout">
          <button
            type="button"
            role="tab"
            aria-selected={view === "grid"}
            className={`episode-view-toggle__btn ${view === "grid" ? "episode-view-toggle__btn--active" : ""}`}
            onClick={() => setView("grid")}
          >
            Grid
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "list"}
            className={`episode-view-toggle__btn ${view === "list" ? "episode-view-toggle__btn--active" : ""}`}
            onClick={() => setView("list")}
          >
            List
          </button>
        </div>
      </div>

      <EpisodePagination
        key={view}
        items={episodes}
        pageSize={pageSize}
        render={(pageEps) =>
          view === "grid" ? (
            <div className="episode-grid">
              {pageEps.map((ep) => (
                <EpisodeTile
                  key={ep.episodeId}
                  ep={ep}
                  href={watchHref(streamId, ep, provider, malId, anilistId)}
                />
              ))}
            </div>
          ) : (
            <div className="episode-list-detail">
              {pageEps.map((ep) => (
                <EpisodeDetailRow
                  key={ep.episodeId}
                  ep={ep}
                  streamId={streamId}
                  provider={provider}
                  malId={malId}
                  anilistId={anilistId}
                />
              ))}
            </div>
          )
        }
      />
    </div>
  );
}

function EpisodeTile({ ep, href }: { ep: Episode; href: string | null }) {
  const streamable = ep.streamable !== false;
  const className = [
    "episode-tile",
    streamable ? "episode-tile--streamable" : "episode-tile--catalog",
    ep.isFiller ? "episode-tile--filler" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <span className="episode-tile__num">{String(ep.number).padStart(2, "0")}</span>
      <span className="episode-tile__title">{ep.title || `Episode ${ep.number}`}</span>
      <span className="episode-tile__meta">
        {!streamable && (
          <span className="episode-tile__tag">{episodeReleaseLabel(ep.airDate)}</span>
        )}
        {ep.isFiller && <span className="episode-tile__tag">Filler</span>}
        {streamable && <span className="episode-tile__play" aria-hidden />}
      </span>
    </>
  );

  if (streamable && href) {
    return (
      <Link to={href} className={className} title={ep.title || `Episode ${ep.number}`}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={className} title={ep.title || `Episode ${ep.number}`}>
      {inner}
    </div>
  );
}

function EpisodeDetailRow({
  ep,
  streamId,
  provider,
  malId,
  anilistId,
}: {
  ep: Episode;
  streamId: string;
  provider?: string;
  malId?: string | null;
  anilistId?: string | null;
}) {
  const streamable = ep.streamable !== false;
  const href = streamable ? watchHref(streamId, ep, provider, malId, anilistId) : null;

  return (
    <div
      className={`episode-row episode-row--rich episode-row--compact ${!streamable ? "episode-row--catalog" : ""}`}
    >
      {ep.image && (
        <img src={ep.image} alt="" className="episode-row__thumb hidden md:block" loading="lazy" />
      )}
      <div className="episode-row__body flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-sans text-xs font-semibold uppercase tracking-widest theme-accent-text">
            Ep {String(ep.number).padStart(2, "0")}
          </span>
          {!streamable && <span className="badge-pill">Catalog only</span>}
          {ep.isFiller && <span className="badge-pill">Filler</span>}
        </div>
        <p className="font-sans text-sm font-medium m-0 line-clamp-1">
          {ep.title || `Episode ${ep.number}`}
        </p>
        <p className="font-sans text-xs text-taupe mt-1.5 mb-0 line-clamp-2 leading-relaxed">
          {ep.description ||
            (streamable
              ? "No episode synopsis available yet."
              : "Scheduled in catalog — not uploaded yet.")}
        </p>
      </div>
      <div className="episode-row__actions flex gap-2 shrink-0 self-center">
        {streamable && href ? (
          <Link to={href}>
            <LuxuryButton variant="primary" className="!py-2 !px-4 !text-[0.65rem]">
              Stream
            </LuxuryButton>
          </Link>
        ) : (
          <span className="font-sans text-[0.65rem] uppercase tracking-widest text-taupe px-2">
            {episodeReleaseLabel(ep.airDate)}
          </span>
        )}
      </div>
    </div>
  );
}

function watchHref(
  streamId: string,
  ep: Episode,
  provider?: string,
  mal?: string | null,
  anilist?: string | null
): string {
  const params = new URLSearchParams({ ep: String(ep.number) });
  if (provider) params.set("provider", provider);
  if (mal) params.set("mal", mal);
  if (anilist) params.set("anilist", anilist);
  return `/watch/${streamId}/${ep.episodeId}?${params}`;
}
