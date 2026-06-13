const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Short label for episode tiles — e.g. "Jun 14" or "Jun 14, 2026" */
export function formatEpisodeAirDate(value: string | undefined | null): string | null {
  const d = parseDate(value);
  if (!d) return null;
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const label = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return sameYear ? label : `${label}, ${d.getFullYear()}`;
}

/** Premiere badge for upcoming catalog cards */
export function formatPremiereDate(value: string | undefined | null): string | null {
  const d = parseDate(value);
  if (!d) return null;
  const now = new Date();
  if (d.getTime() < now.getTime()) return null;
  const sameYear = d.getFullYear() === now.getFullYear();
  const label = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return sameYear ? label : `${label}, ${d.getFullYear()}`;
}

/** Fallback when a catalog episode has no scheduled date yet */
export function episodeReleaseLabel(airDate: string | undefined | null): string {
  return formatEpisodeAirDate(airDate) ?? "Date TBA";
}
