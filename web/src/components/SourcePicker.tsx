import { LuxuryButton } from "./ui/LuxuryButton";
import { formatRelative } from "../lib/formatRelative";

export interface SourceOption {
  key: string;
  provider: string;
  label: string;
  type?: "hls" | "embed";
  status?: "ok" | "blocked" | "unknown";
  episodes?: number;
  latestEpisode?: number;
  checkedAt?: string;
  hasNew?: boolean;
  note?: string;
}

export function SourcePicker({
  sources,
  activeKey,
  loading = false,
  onSelect,
  title = "Stream Sources",
  subtitle = "Pick where to watch — try another if playback fails.",
  onCheckNew,
  checkingNew = false,
}: {
  sources: SourceOption[];
  activeKey?: string | null;
  loading?: boolean;
  onSelect: (source: SourceOption) => void;
  title?: string;
  subtitle?: string;
  onCheckNew?: () => void;
  checkingNew?: boolean;
}) {
  if (loading) {
    return (
      <div className="source-picker">
        <p className="editorial-tagline mb-3">{title}</p>
        <div className="flex justify-center py-8">
          <span className="spinner spinner--dark" />
        </div>
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="source-picker">
        <p className="editorial-tagline mb-2">{title}</p>
        <p className="font-sans text-sm text-taupe m-0">No stream sources found for this title.</p>
      </div>
    );
  }

  return (
    <div className="source-picker">
      <div className="source-picker__header">
        <div>
          <p className="editorial-tagline mb-1">{title}</p>
          <p className="font-sans text-xs text-taupe m-0">{subtitle}</p>
        </div>
        <div className="source-picker__actions">
          {onCheckNew && (
            <LuxuryButton
              variant="secondary"
              loading={checkingNew}
              className="!py-1.5 !px-3 !text-[0.6rem]"
              onClick={onCheckNew}
            >
              Check for new episodes
            </LuxuryButton>
          )}
          <span className="source-picker__count">{sources.length} sources</span>
        </div>
      </div>

      <div className="source-picker__grid">
        {sources.map((source) => {
          const active = source.key === activeKey;
          const blocked = source.status === "blocked";
          return (
            <button
              key={source.key}
              type="button"
              className={`source-card ${active ? "source-card--active" : ""} ${blocked ? "source-card--blocked" : ""} ${source.hasNew ? "source-card--new" : ""}`}
              onClick={() => onSelect(source)}
              disabled={blocked}
            >
              <div className="source-card__top">
                <span className="source-card__provider">{source.label}</span>
                <div className="source-card__badges">
                  {source.hasNew && <span className="source-card__new-badge">New</span>}
                  {source.type && (
                    <span className="source-card__type">{source.type === "embed" ? "Embed" : "HLS"}</span>
                  )}
                </div>
              </div>
              {source.episodes != null && source.episodes > 0 && (
                <p className="source-card__meta">
                  {source.episodes} episodes
                  {source.latestEpisode != null && source.latestEpisode > 0
                    ? ` · latest ep ${source.latestEpisode}`
                    : ""}
                </p>
              )}
              {source.checkedAt && (
                <p className="source-card__updated">Checked {formatRelative(source.checkedAt)}</p>
              )}
              {source.status && (
                <p className={`source-card__status source-card__status--${source.status}`}>
                  {source.status === "ok"
                    ? "Ready"
                    : source.status === "blocked"
                      ? "Blocked on server"
                      : "Unknown"}
                </p>
              )}
              {source.note && <p className="source-card__note">{source.note}</p>}
              {active && <span className="source-card__active-dot" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SourcePickerActions({
  onRetry,
  loading,
}: {
  onRetry?: () => void;
  loading?: boolean;
}) {
  if (!onRetry) return null;
  return (
    <div className="mt-4">
      <LuxuryButton variant="secondary" loading={loading} onClick={onRetry}>
        Refresh sources
      </LuxuryButton>
    </div>
  );
}
