import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export function VideoPlayer({ src, poster }: { src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setError(null);
    setLoading(true);
    let hls: Hls | null = null;

    const onReady = () => setLoading(false);

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, onReady);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setError(`Playback error: ${data.type}`);
          setLoading(false);
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", onReady);
    } else {
      setError("HLS not supported in this browser");
      setLoading(false);
    }

    return () => {
      hls?.destroy();
      video.removeEventListener("loadedmetadata", onReady);
    };
  }, [src]);

  return (
    <div className="player-shell relative">
      {loading && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-charcoal/80">
          <span className="spinner" />
        </div>
      )}
      {error ? (
        <div className="flex aspect-video items-center justify-center p-8 text-center font-sans text-sm text-gold">
          {error}
        </div>
      ) : (
        <video
          ref={videoRef}
          controls
          poster={poster}
          className="aspect-video w-full bg-black"
          playsInline
        />
      )}
    </div>
  );
}
