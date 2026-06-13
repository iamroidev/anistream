const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function isHlsReachable(
  url: string,
  referer = "https://www.miruro.tv/"
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "*/*",
        Referer: referer,
        Origin: referer.replace(/\/$/, ""),
        "User-Agent": DEFAULT_UA,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return false;

    const sample = await res.arrayBuffer();
    if (sample.byteLength < 7) return false;

    const head = new TextDecoder().decode(sample.slice(0, Math.min(sample.byteLength, 512)));
    if (head.includes("#EXTM3U") || head.includes("#EXT-X")) return true;

    const ct = res.headers.get("content-type") ?? "";
    return ct.includes("mpegurl") || ct.includes("m3u8");
  } catch {
    return false;
  }
}

export async function pickReachableHls(
  sources: { url: string; quality?: string; isM3U8?: boolean; type?: string }[],
  referer?: string
) {
  for (const source of sources) {
    if (source.type === "embed") return source;
    const isHls = source.isM3U8 !== false && (source.isM3U8 === true || source.url.includes(".m3u8"));
    if (!isHls) continue;
    if (await isHlsReachable(source.url, referer)) return source;
  }
  return null;
}

export function isMiruroEmbedSource(source: {
  url: string;
  isM3U8?: boolean;
  type?: string;
}): boolean {
  if (source.type === "embed") return true;
  if (source.isM3U8 === true || source.url.includes(".m3u8")) return false;
  return source.url.startsWith("http");
}

export type MiruroWatchPayload = {
  headers?: { Referer?: string; "User-Agent"?: string };
  sources: { url: string; quality?: string; isM3U8?: boolean; type?: string }[];
  subtitles?: { url: string; lang: string }[];
  tracks?: { file: string; label: string; kind: string; default?: boolean }[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
};

/** Pick HLS via proxy, Miruro embed, or direct client HLS when CDN blocks the server. */
export async function resolveMiruroPlayback(
  raw: MiruroWatchPayload,
  preferEmbed = false
): Promise<MiruroWatchPayload & { playback: "hls-proxy" | "embed" | "hls-direct" }> {
  const referer = raw.headers?.Referer;
  const embeds = raw.sources.filter(isMiruroEmbedSource);
  const hlsList = raw.sources.filter((s) => !isMiruroEmbedSource(s));

  if (preferEmbed && embeds.length > 0) {
    return {
      ...raw,
      sources: embeds.map((s) => ({ ...s, type: "embed" as const })),
      tracks: [],
      subtitles: [],
      playback: "embed",
    };
  }

  const reachable = await pickReachableHls(hlsList, referer);
  if (reachable) {
    const rest = raw.sources.filter((s) => s.url !== reachable.url);
    return { ...raw, sources: [reachable, ...rest], playback: "hls-proxy" };
  }

  if (embeds.length > 0) {
    return {
      ...raw,
      sources: embeds.map((s) => ({ ...s, type: "embed" as const })),
      tracks: [],
      subtitles: [],
      playback: "embed",
    };
  }

  const firstHls = hlsList[0];
  if (firstHls) {
    return { ...raw, sources: [firstHls], playback: "hls-direct" };
  }

  throw new Error("No playable Miruro stream");
}
