import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { parseVtt } from "../lib/vtt";
import { proxyImageUrl } from "../lib/proxyImage";

export interface SubtitleTrack {
  url: string;
  label: string;
  lang?: string;
  default?: boolean;
}

export function VideoPlayer({
  src,
  fallbackSrc,
  poster,
  embed = false,
  subtitles = [],
}: {
  src: string;
  fallbackSrc?: string;
  poster?: string;
  embed?: boolean;
  subtitles?: SubtitleTrack[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRefs = useRef<TextTrack[]>([]);
  const fallbackTriedRef = useRef(false);
  const [activeSrc, setActiveSrc] = useState(src);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSub, setActiveSub] = useState<number>(() => {
    const idx = subtitles.findIndex((s) => s.default);
    return idx >= 0 ? idx : subtitles.length > 0 ? 0 : -1;
  });

  const applySubIndex = useCallback((idx: number) => {
    const video = videoRef.current;
    if (!video) return;

    trackRefs.current.forEach((tt, i) => {
      tt.mode = i === idx ? "showing" : "disabled";
    });

    for (let i = 0; i < video.textTracks.length; i++) {
      const tt = video.textTracks[i];
      if (!trackRefs.current.includes(tt)) {
        tt.mode = "disabled";
      }
    }
  }, []);

  const attachSubtitles = useCallback(async () => {
    const video = videoRef.current;
    if (!video || subtitles.length === 0) {
      trackRefs.current = [];
      return;
    }

    trackRefs.current.forEach((tt) => {
      tt.mode = "disabled";
    });
    trackRefs.current = [];

    for (const sub of subtitles) {
      try {
        const res = await fetch(sub.url);
        if (!res.ok) continue;
        const text = await res.text();
        if (!text.includes("WEBVTT")) continue;

        const tt = video.addTextTrack("subtitles", sub.label, sub.lang ?? "en");
        parseVtt(text).forEach((cue) => {
          try {
            tt.addCue(cue);
          } catch {
            /* skip */
          }
        });
        trackRefs.current.push(tt);
      } catch {
        /* try next track */
      }
    }

    const defaultIdx = subtitles.findIndex((s) => s.default);
    const pick = defaultIdx >= 0 ? defaultIdx : trackRefs.current.length > 0 ? 0 : -1;
    setActiveSub(pick);
    applySubIndex(pick);
  }, [subtitles, applySubIndex]);

  useEffect(() => {
    setActiveSub(() => {
      const idx = subtitles.findIndex((s) => s.default);
      return idx >= 0 ? idx : subtitles.length > 0 ? 0 : -1;
    });
  }, [subtitles]);

  useEffect(() => {
    setActiveSrc(src);
    fallbackTriedRef.current = false;
  }, [src]);

  useEffect(() => {
    if (embed) return;

    const video = videoRef.current;
    if (!video || !activeSrc) return;

    setError(null);
    setLoading(true);
    let hls: Hls | null = null;

    const onReady = () => {
      setLoading(false);
      void attachSubtitles();
    };

    const tryFallback = () => {
      if (!fallbackTriedRef.current && fallbackSrc && activeSrc !== fallbackSrc) {
        fallbackTriedRef.current = true;
        setActiveSrc(fallbackSrc);
        return true;
      }
      return false;
    };

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(activeSrc);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, onReady);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (tryFallback()) return;
        setError(`Playback error: ${data.type}`);
        setLoading(false);
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = activeSrc;
      video.addEventListener("loadedmetadata", onReady);
      video.addEventListener(
        "error",
        () => {
          if (tryFallback()) return;
          setError("Playback error: network");
          setLoading(false);
        },
        { once: true }
      );
    } else {
      setError("HLS not supported in this browser");
      setLoading(false);
    }

    return () => {
      hls?.destroy();
      video.removeEventListener("loadedmetadata", onReady);
      trackRefs.current = [];
    };
  }, [activeSrc, embed, attachSubtitles, fallbackSrc]);

  useEffect(() => {
    applySubIndex(activeSub);
  }, [activeSub, applySubIndex]);

  function pickSub(idx: number) {
    setActiveSub(idx);
    applySubIndex(idx);
  }

  if (embed) {
    return (
      <div className="player-shell relative">
        <iframe
          src={src}
          title="Anime player"
          className="aspect-video w-full bg-black border-0"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-popups"
          onLoad={() => setLoading(false)}
        />
        <p className="font-sans text-[0.65rem] text-taupe mt-2 mb-0">
          Third-party embed player — playback is hosted externally, not by AniStream.
        </p>
      </div>
    );
  }

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
        <>
          <div className="relative">
            <video
              ref={videoRef}
              controls
              className="aspect-video w-full bg-black"
              playsInline
            />
            {poster && loading && !error && (
              <img
                src={proxyImageUrl(poster)}
                alt=""
                className="pointer-events-none absolute inset-0 aspect-video w-full object-cover"
                loading="eager"
              />
            )}
          </div>
          {subtitles.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="font-sans text-[0.65rem] uppercase tracking-widest text-taupe">
                Subtitles
              </span>
              <button
                type="button"
                className={`badge-pill ${activeSub < 0 ? "badge-pill--live" : ""}`}
                onClick={() => pickSub(-1)}
              >
                Off
              </button>
              {subtitles.map((sub, i) => (
                <button
                  key={`${sub.url}-${sub.label}`}
                  type="button"
                  className={`badge-pill ${activeSub === i ? "badge-pill--live" : ""}`}
                  onClick={() => pickSub(i)}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
