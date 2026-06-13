import { config } from "./config.js";

function encodeProxyTarget(url: string, referer?: string, userAgent?: string): string {
  const params = new URLSearchParams({ url });
  if (referer) params.set("referer", referer);
  if (userAgent) params.set("ua", userAgent);
  return `${config.publicUrl}/proxy/resource?${params}`;
}

export function proxyUrl(
  url: string,
  referer?: string,
  userAgent?: string
): string {
  return encodeProxyTarget(url, referer, userAgent);
}

export async function proxyResource(
  targetUrl: string,
  referer?: string,
  userAgent?: string
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "*/*",
    "User-Agent":
      userAgent ??
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (referer) headers.Referer = referer;

  const upstream = await fetch(targetUrl, { headers, redirect: "follow" });
  const contentType =
    upstream.headers.get("content-type") ??
    (targetUrl.includes(".m3u8") ? "application/vnd.apple.mpegurl" : "application/octet-stream");

  const body = await upstream.arrayBuffer();

  if (
    contentType.includes("mpegurl") ||
    contentType.includes("m3u8") ||
    targetUrl.includes(".m3u8")
  ) {
    const playlist = new TextDecoder().decode(body);
    const base = new URL(targetUrl);
    const rewritten = rewritePlaylist(playlist, base, referer, userAgent);
    return new Response(rewritten, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    });
  }

  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function rewritePlaylist(
  playlist: string,
  base: URL,
  referer?: string,
  userAgent?: string
): string {
  return playlist
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        if (trimmed.startsWith("#EXT-X-MAP:")) {
          return trimmed.replace(/URI="([^"]+)"/, (_, uri) => {
            const abs = resolveUrl(uri, base);
            return `URI="${encodeProxyTarget(abs, referer, userAgent)}"`;
          });
        }
        return line;
      }
      const abs = resolveUrl(trimmed, base);
      return encodeProxyTarget(abs, referer, userAgent);
    })
    .join("\n");
}

function resolveUrl(path: string, base: URL): string {
  try {
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}
