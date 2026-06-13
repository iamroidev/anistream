import type { CatalogAnime } from "../api";

export function catalogAnimePath(a: CatalogAnime): string {
  const params = new URLSearchParams();
  if (a.mal_id > 0) params.set("mal", String(a.mal_id));
  if (a.anilist_id > 0) params.set("anilist", String(a.anilist_id));

  if (a.mal_id > 0) {
    return `/anime/${a.mal_id}?${params}`;
  }

  params.set("provider", "miruro");
  return `/anime/${a.anilist_id}?${params}`;
}

export function catalogTitle(a: CatalogAnime): string {
  return a.title_english || a.title;
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "").trim();
}
