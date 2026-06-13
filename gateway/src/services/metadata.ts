import * as anilist from "./anilist.js";
import * as jikan from "./jikan.js";

export type { JikanAnime } from "./jikan.js";
export type { CatalogAnime } from "./anilist.js";
export async function browseHome() {
  try {
    return await jikan.jikanHome();
  } catch {
    return await anilist.anilistHome();
  }
}

export async function browseSeason() {
  try {
    return await jikan.jikanSeasonNow();
  } catch {
    return await anilist.anilistSeasonNow();
  }
}

export async function browseTop() {
  try {
    return await jikan.jikanTop();
  } catch {
    return await anilist.anilistTop();
  }
}

export async function metadataSearch(q: string) {
  try {
    return await jikan.jikanSearch(q);
  } catch {
    return await anilist.anilistSearch(q);
  }
}

export async function metadataAnime(malId: string) {
  try {
    return await jikan.jikanAnime(malId);
  } catch {
    return await anilist.anilistAnime(malId);
  }
}

export async function metadataRelations(malId: string) {
  try {
    return { data: await jikan.jikanRelations(malId) };
  } catch {
    return { data: [] as { relation: string; mal_id: number; name: string }[] };
  }
}

export async function browseCurated() {
  try {
    return await anilist.anilistCuratedHome();
  } catch {
    const home = await browseHome();
    const season = home.season.map((a) => ({
      ...a,
      anilist_id: 0,
      banner_image: null,
    }));
    const top = home.top.map((a) => ({
      ...a,
      anilist_id: 0,
      banner_image: null,
    }));
    return {
      spotlight: top.slice(0, 1),
      trending: top.slice(0, 18),
      popular: top,
      recent: season,
      upcoming: [],
      season,
      top,
      genres: [...anilist.BROWSE_GENRES],
    };
  }
}

export async function browseSection(section: string, genre?: string) {
  switch (section) {
    case "trending":
      return { data: await anilist.anilistTrending() };
    case "popular":
      return { data: await anilist.anilistPopular() };
    case "recent":
      return { data: await anilist.anilistRecent() };
    case "upcoming":
      return { data: await anilist.anilistUpcoming() };
    case "season":
      return { data: await anilist.anilistCatalogSeason() };
    case "top":
      return { data: await anilist.anilistCatalogTop() };
    case "genre":
      if (!genre) throw new Error("genre required");
      return { data: await anilist.anilistByGenre(genre) };
    default:
      throw new Error(`Unknown section: ${section}`);
  }
}
