import { Link } from "react-router-dom";
import { enrichGenres } from "../lib/genres";

export function GenreRail({ genres }: { genres: string[] }) {
  if (genres.length === 0) return null;

  const cards = enrichGenres(genres);

  return (
    <section className="genre-rail">
      <div className="genre-rail__intro">
        <div>
          <p className="genre-rail__eyebrow">Discover</p>
          <h2 className="genre-rail__title">Browse by Genre</h2>
          <p className="genre-rail__lead">
            Curated moods from the catalog — each genre opens a full browse grid of titles you can
            stream.
          </p>
        </div>
        <p className="genre-rail__count">{cards.length} genres</p>
      </div>

      <div className="genre-rail__grid">
        {cards.map((genre, index) => (
          <Link
            key={genre.slug}
            to={`/browse/genre?genre=${encodeURIComponent(genre.slug)}`}
            className="genre-card"
            style={{ animationDelay: `${0.04 * index}s` }}
          >
            <div className="genre-card__bg" style={{ background: genre.gradient }} aria-hidden />
            <div className="genre-card__shine" aria-hidden />
            <span className="genre-card__icon" aria-hidden>
              {genre.icon}
            </span>
            <div className="genre-card__body">
              <h3 className="genre-card__name">{genre.label}</h3>
              <p className="genre-card__tagline">{genre.tagline}</p>
            </div>
            <span className="genre-card__cta">Explore →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
