/**
 * Prefer self-hosted Consumet API (Docker) when reachable; fall back to in-process scrapers.
 */
import { config } from "../config.js";
import { providerOrder } from "../providers.js";
import * as local from "./consumet-local.js";
import * as remote from "./consumet.js";

let remoteOk: boolean | null = null;
let remoteCheckedAt = 0;
const REMOTE_TTL_MS = 60_000;

async function remoteAvailable(): Promise<boolean> {
  if (Date.now() - remoteCheckedAt < REMOTE_TTL_MS && remoteOk !== null) {
    return remoteOk;
  }
  remoteCheckedAt = Date.now();
  try {
    const res = await fetch(config.consumetUrl.replace(/\/$/, ""), {
      signal: AbortSignal.timeout(4_000),
    });
    remoteOk = res.ok;
  } catch {
    remoteOk = false;
  }
  return remoteOk;
}

export async function consumetMode(): Promise<"remote" | "local"> {
  return (await remoteAvailable()) ? "remote" : "local";
}

export async function consumetSearch(provider: string, q: string) {
  if (await remoteAvailable()) return remote.consumetSearch(provider, q);
  return local.consumetSearch(provider, q);
}

export async function consumetSearchAny(q: string, preferred?: string) {
  if (await remoteAvailable()) {
    for (const provider of providerOrder(preferred)) {
      try {
        const data = await remote.consumetSearch(provider, q);
        if (data.results?.length) return { provider, value: { results: data.results } };
      } catch {
        continue;
      }
    }
    return null;
  }
  return local.consumetSearchAny(q, preferred);
}

export async function consumetInfo(provider: string, id: string) {
  if (await remoteAvailable()) return remote.consumetInfo(provider, id);
  return local.consumetInfo(provider, id);
}

export async function consumetInfoAny(id: string, preferred?: string) {
  if (await remoteAvailable()) {
    for (const provider of providerOrder(preferred)) {
      try {
        const info = await remote.consumetInfo(provider, id);
        if (info.episodes?.length || info.title) return { provider, value: { info } };
      } catch {
        continue;
      }
    }
    return null;
  }
  return local.consumetInfoAny(id, preferred);
}

export async function consumetWatch(provider: string, episodeId: string) {
  if (await remoteAvailable()) return remote.consumetWatch(provider, episodeId);
  return local.consumetWatch(provider, episodeId);
}

export async function consumetWatchAny(episodeId: string, preferred?: string) {
  if (await remoteAvailable()) {
    for (const provider of providerOrder(preferred)) {
      try {
        const sources = await remote.consumetWatch(provider, episodeId);
        if (sources.sources?.length) return { provider, value: { sources } };
      } catch {
        continue;
      }
    }
    return null;
  }
  return local.consumetWatchAny(episodeId, preferred);
}

export { toAnimeInfoResponse, toEpisodesResponse } from "./consumet-local.js";
