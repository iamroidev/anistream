const STORAGE_KEY = "anistream:continue";
const MAX_ENTRIES = 12;

export interface ContinueEntry {
  animeId: string;
  episodeId: string;
  epNum: number;
  title: string;
  poster: string;
  provider?: string;
  updatedAt: number;
}

function readAll(): ContinueEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ContinueEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries: ContinueEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function getContinueWatching(): ContinueEntry[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveContinueWatching(entry: Omit<ContinueEntry, "updatedAt">) {
  const entries = readAll().filter(
    (e) => !(e.animeId === entry.animeId && e.episodeId === entry.episodeId)
  );
  entries.unshift({ ...entry, updatedAt: Date.now() });
  writeAll(entries);
}

export function removeContinueEntry(animeId: string, episodeId: string) {
  writeAll(readAll().filter((e) => !(e.animeId === animeId && e.episodeId === episodeId)));
}

export function continueWatchPath(entry: ContinueEntry): string {
  const params = new URLSearchParams({ ep: String(entry.epNum) });
  if (entry.provider) params.set("provider", entry.provider);
  return `/watch/${entry.animeId}/${entry.episodeId}?${params}`;
}
