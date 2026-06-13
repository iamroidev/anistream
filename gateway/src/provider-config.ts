/**
 * Stream scraper config — update domains here when hosts rotate.
 * We use @consumet/extensions in-process (not api.consumet.org).
 *
 * Disabled providers are kept for legacy ?provider= URLs but skipped in discovery.
 */

export type StreamProviderId = "animepahe" | "hianime" | "animekai" | "kickassanime";

export interface ProviderMeta {
  id: StreamProviderId;
  label: string;
  enabled: boolean;
  reason?: string;
  /** Consumet AnimeParser.baseUrl override */
  baseUrl?: string;
}

/** Primary English scrapers attempted during catalog/watch discovery */
export const ACTIVE_STREAM_PROVIDERS = ["animepahe"] as const satisfies readonly StreamProviderId[];

export type ActiveStreamProvider = (typeof ACTIVE_STREAM_PROVIDERS)[number];

export const PROVIDER_REGISTRY: Record<StreamProviderId, ProviderMeta> = {
  animepahe: {
    id: "animepahe",
    label: "AnimePahe",
    enabled: process.env.ENABLE_ANIMEPAHE === "true",
    reason:
      process.env.ENABLE_ANIMEPAHE === "true"
        ? undefined
        : "Cloudflare bot protection — set ENABLE_ANIMEPAHE=true to try (often still blocked)",
    baseUrl: process.env.ANIMEPAHE_BASE_URL ?? "https://animepahe.com",
  },
  hianime: {
    id: "hianime",
    label: "HiAnime",
    enabled: false,
    reason: "Site shut down March 2026 — scrapers defunct",
    baseUrl: "https://hianime.to",
  },
  animekai: {
    id: "animekai",
    label: "AnimeKai",
    enabled: false,
    reason: "Domain dead / infrastructure offline — check ANIMEKAI_BASE_URL before re-enabling",
    baseUrl: process.env.ANIMEKAI_BASE_URL ?? "https://animekai.to",
  },
  kickassanime: {
    id: "kickassanime",
    label: "KickAssAnime",
    enabled: false,
    reason: "Stale API paths — not maintained",
    baseUrl: "https://kickass-anime.ru",
  },
};

export function activeStreamProviders(): ActiveStreamProvider[] {
  return ACTIVE_STREAM_PROVIDERS.filter((id) => PROVIDER_REGISTRY[id].enabled);
}

export function allStreamProviderIds(): StreamProviderId[] {
  return Object.keys(PROVIDER_REGISTRY) as StreamProviderId[];
}

export function isStreamProvider(id: string): id is StreamProviderId {
  return id in PROVIDER_REGISTRY;
}

export function providerMeta(id: string): ProviderMeta | null {
  return isStreamProvider(id) ? PROVIDER_REGISTRY[id] : null;
}

/** Domains to try for AnimePahe when ENABLE_ANIMEPAHE=true (first success wins) */
export function animepaheDomainCandidates(): string[] {
  const primary = process.env.ANIMEPAHE_BASE_URL;
  const defaults = ["https://animepahe.com", "https://animepahe.org", "https://animepahe.si"];
  if (primary) return [primary.replace(/\/$/, ""), ...defaults.filter((d) => d !== primary)];
  return defaults;
}
