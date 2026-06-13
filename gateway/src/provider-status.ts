import { activeStreamProviders, PROVIDER_REGISTRY, allStreamProviderIds } from "./provider-config.js";
import { consumetSearch, consumetMode } from "./services/consumet-adapter.js";
import * as miruro from "./services/miruro.js";
import { withTimeout } from "./timeout.js";

const PROBE_MS = 6_000;

export interface ProviderStatusRow {
  id: string;
  label: string;
  enabled: boolean;
  status: "ok" | "disabled" | "error";
  reason?: string;
  detail?: string;
}

export async function probeStreamProviders(): Promise<{
  primary: ProviderStatusRow[];
  consumet: ProviderStatusRow[];
  note: string;
  consumetMode: "remote" | "local";
}> {
  const miruroRow: ProviderStatusRow = {
    id: "miruro",
    label: "Miruro",
    enabled: true,
    status: "error",
    reason: "Self-hosted Miruro-API sidecar (Docker)",
  };
  try {
    const ok = await withTimeout(miruro.miruroAvailable(), PROBE_MS, "miruro-probe");
    miruroRow.status = ok ? "ok" : "error";
    miruroRow.detail = ok ? "API reachable" : "Start miruro service + MIRURO_API_KEY";
  } catch (e) {
    miruroRow.detail = String(e);
  }

  const anipubRow: ProviderStatusRow = {
    id: "anipub",
    label: "AniPub",
    enabled: true,
    status: "ok",
    reason: "Embed host — most reliable on VPS",
    detail: "anipub.xyz",
  };

  const consumet: ProviderStatusRow[] = [];
  for (const id of allStreamProviderIds()) {
    const meta = PROVIDER_REGISTRY[id];
    const row: ProviderStatusRow = {
      id,
      label: meta.label,
      enabled: meta.enabled,
      status: meta.enabled ? "error" : "disabled",
      reason: meta.reason,
    };
    if (!meta.enabled) {
      consumet.push(row);
      continue;
    }
    try {
      const data = await withTimeout(consumetSearch(id, "naruto"), PROBE_MS, `${id}-probe`);
      row.status = data.results.length > 0 ? "ok" : "error";
      row.detail = data.results.length > 0 ? `${data.results.length} test hits` : "No results";
    } catch (e) {
      row.status = "error";
      row.detail = String(e).slice(0, 160);
    }
    consumet.push(row);
  }

  const active = activeStreamProviders();
  const mode = await consumetMode();
  return {
    primary: [miruroRow, anipubRow],
    consumet,
    consumetMode: mode,
    note:
      active.length === 0
        ? "Consumet scrapers disabled — Miruro + AniPub only. Enable AnimePahe with ENABLE_ANIMEPAHE=true if you add CF bypass."
        : `Active consumet providers: ${active.join(", ")}`,
  };
}
