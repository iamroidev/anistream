import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CatalogAnime } from "../api";
import { catalogAnimePath, catalogTitle, stripHtml } from "../lib/catalog";
import { formatPremiereDate } from "../lib/formatAirDate";
import { LuxuryButton } from "./ui/LuxuryButton";

const ROTATE_MS = 7000;

export function HeroSpotlight({ items }: { items: CatalogAnime[] }) {
  const slides = items.filter(Boolean).slice(0, 8);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % slides.length);
        setVisible(true);
      }, 420);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) return null;

  const featured = slides[index];
  const title = catalogTitle(featured);
  const banner = featured.banner_image ?? featured.images.jpg.large_image_url;
  const synopsis = stripHtml(featured.synopsis).slice(0, 220);
  const genres = featured.genres?.slice(0, 4).map((g) => g.name) ?? [];
  const premiere = formatPremiereDate(featured.start_date ?? featured.next_airing_at);

  return (
    <section className="hero-spotlight" aria-live="polite">
      <img
        key={featured.anilist_id}
        src={banner}
        alt=""
        className={`hero-spotlight__bg ${visible ? "hero-spotlight__bg--in" : "hero-spotlight__bg--out"}`}
        loading="eager"
      />
      <div className="hero-spotlight__shade" aria-hidden />
      <div className={`hero-spotlight__content ${visible ? "hero-spotlight__content--in" : "hero-spotlight__content--out"}`}>
        <p className="hero-spotlight__eyebrow">Featured · Spotlight</p>
        <h1 className="hero-spotlight__title">{title}</h1>
        <div className="hero-spotlight__meta">
          {featured.score != null && <span>★ {featured.score.toFixed(1)}</span>}
          {featured.status && <span>{featured.status.replace(/_/g, " ")}</span>}
          {featured.episodes != null && featured.episodes > 0 && (
            <span>{featured.episodes} eps</span>
          )}
          {premiere && <span>Premieres {premiere}</span>}
        </div>
        {genres.length > 0 && (
          <div className="hero-spotlight__genres">
            {genres.map((g) => (
              <Link
                key={g}
                to={`/browse/genre?genre=${encodeURIComponent(g)}`}
                className="badge-pill no-underline"
              >
                {g}
              </Link>
            ))}
          </div>
        )}
        {synopsis && <p className="hero-spotlight__synopsis">{synopsis}…</p>}
        <Link to={catalogAnimePath(featured)} className="inline-flex mt-6 no-underline">
          <LuxuryButton>Watch Now</LuxuryButton>
        </Link>
      </div>
      {slides.length > 1 && (
        <div className="hero-spotlight__dots" role="tablist" aria-label="Spotlight slides">
          {slides.map((slide, i) => (
            <button
              key={slide.anilist_id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show ${catalogTitle(slide)}`}
              className={`hero-spotlight__dot ${i === index ? "hero-spotlight__dot--active" : ""}`}
              onClick={() => {
                setVisible(false);
                window.setTimeout(() => {
                  setIndex(i);
                  setVisible(true);
                }, 200);
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
