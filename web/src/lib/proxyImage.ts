const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

/** Route external posters through the gateway to avoid browser CORS blocks (e.g. AniList CDN). */
export function proxyImageUrl(url: string | undefined | null): string {
  if (!url) return "";
  if (url.includes("/proxy/image")) return url;
  if (url.startsWith("http")) {
    return `${API}/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}
