export interface GenreMeta {
  slug: string;
  label: string;
  icon: string;
  tagline: string;
  gradient: string;
}

const GENRE_MAP: Record<string, Omit<GenreMeta, "slug" | "label">> = {
  Action: {
    icon: "⚔",
    tagline: "High stakes, kinetic fights, and pulse-pounding set pieces.",
    gradient: "linear-gradient(135deg, #2a1810 0%, #8b3a1a 55%, #d4a574 100%)",
  },
  Adventure: {
    icon: "🧭",
    tagline: "Journeys across worlds, quests, and discovery.",
    gradient: "linear-gradient(135deg, #14261e 0%, #1f6b4a 55%, #7ec8a8 100%)",
  },
  Comedy: {
    icon: "✦",
    tagline: "Sharp gags, warm chaos, and feel-good absurdity.",
    gradient: "linear-gradient(135deg, #2a2418 0%, #9a7b2e 55%, #f0d78c 100%)",
  },
  Drama: {
    icon: "◈",
    tagline: "Character-driven stories with emotional weight.",
    gradient: "linear-gradient(135deg, #1a1820 0%, #4a3d6b 55%, #b8a8d8 100%)",
  },
  Fantasy: {
    icon: "✧",
    tagline: "Magic systems, mythic realms, and impossible odds.",
    gradient: "linear-gradient(135deg, #12182a 0%, #2d4a8c 55%, #8eb8f0 100%)",
  },
  Romance: {
    icon: "♡",
    tagline: "Slow burns, heartbreak, and sparks that linger.",
    gradient: "linear-gradient(135deg, #2a1418 0%, #8c3a52 55%, #f0a8b8 100%)",
  },
  "Sci-Fi": {
    icon: "◎",
    tagline: "Future tech, space opera, and speculative worlds.",
    gradient: "linear-gradient(135deg, #0e1a22 0%, #1a5c6e 55%, #6ec8dc 100%)",
  },
  "Slice of Life": {
    icon: "☕",
    tagline: "Quiet moments, everyday beauty, gentle rhythms.",
    gradient: "linear-gradient(135deg, #1e1c18 0%, #6b5c48 55%, #d8c8b0 100%)",
  },
  Sports: {
    icon: "◉",
    tagline: "Training arcs, rivalry, and the thrill of competition.",
    gradient: "linear-gradient(135deg, #142018 0%, #2d7a48 55%, #88d8a0 100%)",
  },
  Supernatural: {
    icon: "☽",
    tagline: "Spirits, curses, and rules beyond the ordinary.",
    gradient: "linear-gradient(135deg, #12101a 0%, #3d2d6b 55%, #a898d8 100%)",
  },
  Thriller: {
    icon: "▣",
    tagline: "Tension, twists, and stories that refuse to let go.",
    gradient: "linear-gradient(135deg, #101010 0%, #3a3a3a 55%, #9a9a9a 100%)",
  },
  Horror: {
    icon: "☠",
    tagline: "Dread, atmosphere, and things in the dark.",
    gradient: "linear-gradient(135deg, #0a0808 0%, #2a1010 55%, #6b3030 100%)",
  },
  Mystery: {
    icon: "?",
    tagline: "Clues, secrets, and puzzles worth unraveling.",
    gradient: "linear-gradient(135deg, #141820 0%, #3a4a62 55%, #98a8c0 100%)",
  },
  Music: {
    icon: "♪",
    tagline: "Performance, soundtracks, and rhythm as story.",
    gradient: "linear-gradient(135deg, #1a1420 0%, #5c3a7a 55%, #c8a0e8 100%)",
  },
  Ecchi: {
    icon: "◇",
    tagline: "Playful fanservice with comedic edge.",
    gradient: "linear-gradient(135deg, #2a1420 0%, #7a3a58 55%, #f0a0c0 100%)",
  },
};

const DEFAULT_META = {
  icon: "◆",
  tagline: "Explore curated picks in this genre.",
  gradient: "linear-gradient(135deg, #1e1c18 0%, #4a4038 55%, #c8b8a0 100%)",
};

export function genreMeta(name: string): GenreMeta {
  const extra = GENRE_MAP[name] ?? DEFAULT_META;
  return {
    slug: name,
    label: name,
    ...extra,
  };
}

export function enrichGenres(names: string[]): GenreMeta[] {
  return names.map(genreMeta);
}
