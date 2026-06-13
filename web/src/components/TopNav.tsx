import type { CSSProperties } from "react";
import { Link, NavLink } from "react-router-dom";
import { ACCENT_THEMES, useTheme } from "../context/ThemeContext";

export function TopNav() {
  const { theme, setThemeId } = useTheme();

  return (
    <header className="nav-shell">
      <div className="nav-pill">
        <Link to="/" className="nav-brand">
          ANI<span className="nav-brand-accent">STREAM</span>
        </Link>

        <nav className="nav-tiles" aria-label="Main">
          <NavLink to="/" end className={({ isActive }) => `nav-tile ${isActive ? "nav-tile--active" : ""}`}>
            Home
          </NavLink>
          <NavLink to="/search" className={({ isActive }) => `nav-tile ${isActive ? "nav-tile--active" : ""}`}>
            Search
          </NavLink>
        </nav>

        <div className="nav-theme" aria-label="Accent theme">
          <span className="nav-theme-label">{theme.name}</span>
          <div className="nav-theme-swatches">
            {ACCENT_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`nav-swatch ${theme.id === t.id ? "nav-swatch--active" : ""}`}
                style={{ "--swatch-color": t.accent } as CSSProperties}
                onClick={() => setThemeId(t.id)}
                title={t.name}
                aria-label={`${t.name} theme`}
                aria-pressed={theme.id === t.id}
              />
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
