import { useLocation } from "react-router-dom";
import { TopNav } from "./TopNav";
import { LuxuryButton } from "./ui/LuxuryButton";

export function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const location = useLocation();

  return (
    <div className="relative min-h-screen">
      <div className="accent-stripe" aria-hidden />
      <div className="ambient-bubble ambient-bubble--left" aria-hidden />
      <div className="ambient-bubble ambient-bubble--right" aria-hidden />

      <TopNav />

      <main
        key={location.pathname}
        className={`page-enter relative z-10 mx-auto px-4 py-8 md:py-12 ${
          wide ? "max-w-[1400px]" : "max-w-6xl"
        }`}
      >
        {children}
      </main>
    </div>
  );
}

export function SearchBar({
  defaultValue = "",
  onSearch,
  loading = false,
}: {
  defaultValue?: string;
  onSearch: (q: string) => void;
  loading?: boolean;
}) {
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSearch(String(fd.get("q") ?? ""));
      }}
    >
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder="Search titles, studios, genres..."
        className="luxury-input rounded-sm"
      />
      <LuxuryButton type="submit" loading={loading} className="shrink-0">
        Search
      </LuxuryButton>
    </form>
  );
}
