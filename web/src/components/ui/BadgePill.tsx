interface BadgePillProps {
  children: React.ReactNode;
  variant?: "default" | "live";
}

export function BadgePill({ children, variant = "default" }: BadgePillProps) {
  return (
    <span className={`badge-pill ${variant === "live" ? "badge-pill--live" : ""}`}>
      {children}
    </span>
  );
}
