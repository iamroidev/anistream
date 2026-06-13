import type { JikanAnime } from "./jikan.js";

const ANILIST_URL = "https://graphql.anilist.co";

interface AniListTitle {
  romaji: string | null;
  english: string | null;
  native: string | null;
}

interface AniListFuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

interface AniListMedia {
  id: number;
  idMal: number | null;
  title: AniListTitle;
  coverImage: { extraLarge?: string; large?: string } | null;
  bannerImage?: string | null;
  averageScore: number | null;
  description: string | null;
  episodes: number | null;
  status: string | null;
  genres: string[] | null;
  seasonYear: number | null;
  startDate?: AniListFuzzyDate | null;
  nextAiringEpisode?: { episode: number | null; airingAt: number | null } | null;
}

export interface CatalogAnime extends JikanAnime {
  anilist_id: number;
  banner_image: string | null;
  start_date?: string | null;
  next_airing_at?: string | null;
  next_airing_episode?: number | null;
}

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  coverImage { extraLarge large }
  bannerImage
  averageScore
  description(asHtml: false)
  episodes
  status
  genres
  seasonYear
  startDate { year month day }
  nextAiringEpisode { episode airingAt }
`;

function fuzzyDateToIso(date: AniListFuzzyDate | null | undefined): string | null {
  if (!date?.year) return null;
  const month = date.month ?? 1;
  const day = date.day ?? 1;
  const iso = new Date(Date.UTC(date.year, month - 1, day)).toISOString();
  return iso;
}

async function anilistQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AniList ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  if (!json.data) throw new Error("AniList returned no data");
  return json.data;
}

function currentSeasonYear(): { season: string; year: number } {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  if (month <= 2) return { season: "WINTER", year: month === 0 ? year - 1 : year };
  if (month <= 5) return { season: "SPRING", year };
  if (month <= 8) return { season: "SUMMER", year };
  return { season: "FALL", year };
}

function toCatalog(media: AniListMedia): CatalogAnime | null {
  const poster = media.coverImage?.extraLarge ?? media.coverImage?.large ?? "";
  const title = media.title.romaji ?? media.title.english ?? media.title.native ?? "Unknown";
  return {
    anilist_id: media.id,
    mal_id: media.idMal ?? 0,
    title,
    title_english: media.title.english,
    images: { jpg: { large_image_url: poster, image_url: poster } },
    banner_image: media.bannerImage ?? null,
    score: media.averageScore != null ? media.averageScore / 10 : null,
    synopsis: media.description,
    episodes: media.episodes,
    status: media.status ?? "",
    genres: (media.genres ?? []).map((name) => ({ name })),
    start_date: fuzzyDateToIso(media.startDate),
    next_airing_at:
      media.nextAiringEpisode?.airingAt != null
        ? new Date(media.nextAiringEpisode.airingAt * 1000).toISOString()
        : null,
    next_airing_episode: media.nextAiringEpisode?.episode ?? null,
  };
}

function toJikan(media: AniListMedia): JikanAnime | null {
  const mapped = toCatalog(media);
  if (!mapped) return null;
  if (!mapped.mal_id) return null;
  return mapped;
}

function mapCatalogList(media: AniListMedia[]): CatalogAnime[] {
  const seen = new Set<number>();
  const out: CatalogAnime[] = [];
  for (const item of media) {
    const mapped = toCatalog(item);
    if (!mapped || seen.has(mapped.anilist_id)) continue;
    seen.add(mapped.anilist_id);
    out.push(mapped);
  }
  return out;
}

function mapMediaList(media: AniListMedia[]): JikanAnime[] {
  const seen = new Set<number>();
  const out: JikanAnime[] = [];
  for (const item of media) {
    const mapped = toJikan(item);
    if (!mapped || seen.has(mapped.mal_id)) continue;
    seen.add(mapped.mal_id);
    out.push(mapped);
  }
  return out;
}

export async function anilistSeasonNow() {
  const { season, year } = currentSeasonYear();
  const data = await anilistQuery<{ Page: { media: AniListMedia[] } }>(
    `query ($season: MediaSeason, $year: Int) {
      Page(page: 1, perPage: 24) {
        media(season: $season, seasonYear: $year, type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }`,
    { season, year }
  );
  return { data: mapMediaList(data.Page.media) };
}

export async function anilistTop() {
  const data = await anilistQuery<{ Page: { media: AniListMedia[] } }>(
    `query {
      Page(page: 1, perPage: 24) {
        media(type: ANIME, sort: SCORE_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }`
  );
  return { data: mapMediaList(data.Page.media) };
}

export async function anilistHome() {
  const season = await anilistSeasonNow();
  const top = await anilistTop();
  return { season: season.data, top: top.data };
}

export async function anilistSearch(q: string) {
  const data = await anilistQuery<{ Page: { media: AniListMedia[] } }>(
    `query ($search: String) {
      Page(page: 1, perPage: 20) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }`,
    { search: q }
  );
  return { data: mapMediaList(data.Page.media) };
}

export const BROWSE_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
  "Horror",
  "Mystery",
  "Music",
  "Ecchi",
] as const;

async function fetchCatalogPage(
  sort: string,
  status?: string,
  perPage = 18,
  extra?: string
) {
  const statusFilter = status ? `, status: ${status}` : "";
  const data = await anilistQuery<{ Page: { media: AniListMedia[] } }>(
    `query {
      Page(page: 1, perPage: ${perPage}) {
        media(type: ANIME, sort: ${sort}${statusFilter}, isAdult: false${extra ?? ""}) {
          ${MEDIA_FIELDS}
        }
      }
    }`
  );
  return mapCatalogList(data.Page.media);
}

export async function anilistSpotlight() {
  return fetchCatalogPage("TRENDING_DESC", undefined, 10);
}

export async function anilistTrending() {
  return fetchCatalogPage("TRENDING_DESC");
}

export async function anilistPopular() {
  return fetchCatalogPage("POPULARITY_DESC");
}

export async function anilistRecent() {
  return fetchCatalogPage("START_DATE_DESC", "RELEASING");
}

export async function anilistUpcoming() {
  return fetchCatalogPage("POPULARITY_DESC", "NOT_YET_RELEASED");
}

export async function anilistCatalogSeason() {
  const { season, year } = currentSeasonYear();
  const data = await anilistQuery<{ Page: { media: AniListMedia[] } }>(
    `query ($season: MediaSeason, $year: Int) {
      Page(page: 1, perPage: 18) {
        media(season: $season, seasonYear: $year, type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }`,
    { season, year }
  );
  return mapCatalogList(data.Page.media);
}

export async function anilistCatalogTop() {
  return fetchCatalogPage("SCORE_DESC");
}

export async function anilistByGenre(genre: string) {
  const data = await anilistQuery<{ Page: { media: AniListMedia[] } }>(
    `query ($genre: String) {
      Page(page: 1, perPage: 24) {
        media(type: ANIME, genre_in: [$genre], sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }`,
    { genre }
  );
  return mapCatalogList(data.Page.media);
}

export async function anilistCuratedHome() {
  const [spotlight, trending, popular, recent, upcoming, season, top] = await Promise.all([
    anilistSpotlight(),
    anilistTrending(),
    anilistPopular(),
    anilistRecent(),
    anilistUpcoming(),
    anilistCatalogSeason(),
    anilistCatalogTop(),
  ]);
  return { spotlight, trending, popular, recent, upcoming, season, top, genres: [...BROWSE_GENRES] };
}

export async function anilistIdFromMal(malId: string): Promise<number | null> {
  try {
    const data = await anilistQuery<{ Media: { id: number } | null }>(
      `query ($idMal: Int) {
        Media(idMal: $idMal, type: ANIME) { id }
      }`,
      { idMal: Number(malId) }
    );
    return data.Media?.id ?? null;
  } catch {
    return null;
  }
}

export async function anilistAnime(malId: string) {
  const data = await anilistQuery<{ Media: AniListMedia | null }>(
    `query ($idMal: Int) {
      Media(idMal: $idMal, type: ANIME) {
        ${MEDIA_FIELDS}
      }
    }`,
    { idMal: Number(malId) }
  );
  const mapped = data.Media ? toJikan(data.Media) : null;
  if (!mapped) throw new Error("Anime not found on AniList");
  return { data: mapped };
}

interface AniListStreamingEpisode {
  episode: number | null;
  title: string | null;
  description: string | null;
}

export async function anilistStreamingEpisodes(anilistId: string) {
  const data = await anilistQuery<{
    Media: { streamingEpisodes: { nodes: AniListStreamingEpisode[] } | null } | null;
  }>(
    `query ($id: Int) {
      Media(id: $id, type: ANIME) {
        streamingEpisodes(sort: EPISODE_NUMBER_DESC, perPage: 50) {
          nodes {
            episode
            title
            description(asHtml: false)
          }
        }
      }
    }`,
    { id: Number(anilistId) }
  );

  const nodes = data.Media?.streamingEpisodes?.nodes ?? [];
  return nodes
    .filter((ep) => ep.episode != null && ep.episode > 0)
    .map((ep) => ({
      number: ep.episode as number,
      title: ep.title ?? `Episode ${ep.episode}`,
      description: ep.description ?? undefined,
    }));
}

export async function anilistStreamingEpisodesByMal(malId: string) {
  const data = await anilistQuery<{
    Media: {
      id: number;
      streamingEpisodes: { nodes: AniListStreamingEpisode[] } | null;
    } | null;
  }>(
    `query ($idMal: Int) {
      Media(idMal: $idMal, type: ANIME) {
        id
        streamingEpisodes(sort: EPISODE_NUMBER_DESC, perPage: 50) {
          nodes {
            episode
            title
            description(asHtml: false)
          }
        }
      }
    }`,
    { idMal: Number(malId) }
  );

  const nodes = data.Media?.streamingEpisodes?.nodes ?? [];
  return nodes
    .filter((ep) => ep.episode != null && ep.episode > 0)
    .map((ep) => ({
      number: ep.episode as number,
      title: ep.title ?? `Episode ${ep.episode}`,
      description: ep.description ?? undefined,
    }));
}
