import { ReactNode } from "react";

interface EditorialCardProps {
  tagline?: string;
  title?: string;
  children: ReactNode;
  className?: string;
  divider?: boolean;
}

export function EditorialCard({
  tagline,
  title,
  children,
  className = "",
  divider = true,
}: EditorialCardProps) {
  return (
    <div className={`editorial-card p-6 md:p-8 ${className}`}>
      {(tagline || title) && (
        <header className={divider ? "card-divider pb-5 mb-6" : "mb-6"}>
          {tagline && <p className="editorial-tagline mb-2">{tagline}</p>}
          {title && (
            <h2 className="editorial-heading text-2xl md:text-3xl font-semibold m-0">
              {title}
            </h2>
          )}
        </header>
      )}
      {children}
    </div>
  );
}
