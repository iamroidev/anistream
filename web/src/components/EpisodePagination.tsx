import { useEffect, useState } from "react";
import { LuxuryButton } from "./ui/LuxuryButton";

const DEFAULT_PAGE_SIZE = 12;

export function EpisodePagination<T>({
  items,
  pageSize = DEFAULT_PAGE_SIZE,
  render,
}: {
  items: T[];
  pageSize?: number;
  render: (pageItems: T[]) => React.ReactNode;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  useEffect(() => {
    setPage(0);
  }, [items.length, pageSize]);

  if (items.length <= pageSize) {
    return <>{render(items)}</>;
  }

  const ranges = Array.from({ length: totalPages }, (_, i) => {
    const rangeStart = i * pageSize + 1;
    const rangeEnd = Math.min((i + 1) * pageSize, items.length);
    return { page: i, label: `${rangeStart}–${rangeEnd}` };
  });

  return (
    <div className="episode-pagination-wrap">
      <EpisodeRangeBar ranges={ranges} activePage={safePage} onSelect={setPage} />
      {render(pageItems)}
      <div className="episode-pagination">
        <LuxuryButton
          variant="secondary"
          className="!py-2 !px-4 !text-[0.65rem]"
          disabled={safePage === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          Previous
        </LuxuryButton>
        <span className="episode-pagination__label">
          Episodes {start + 1}–{Math.min(start + pageSize, items.length)} of {items.length}
        </span>
        <LuxuryButton
          variant="secondary"
          className="!py-2 !px-4 !text-[0.65rem]"
          disabled={safePage >= totalPages - 1}
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        >
          Next
        </LuxuryButton>
      </div>
    </div>
  );
}

function EpisodeRangeBar({
  ranges,
  activePage,
  onSelect,
}: {
  ranges: { page: number; label: string }[];
  activePage: number;
  onSelect: (page: number) => void;
}) {
  if (ranges.length <= 1) return null;

  return (
    <div className="episode-ranges" role="navigation" aria-label="Episode ranges">
      {ranges.map((range) => (
        <button
          key={range.page}
          type="button"
          className={`episode-ranges__chip ${range.page === activePage ? "episode-ranges__chip--active" : ""}`}
          onClick={() => onSelect(range.page)}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
