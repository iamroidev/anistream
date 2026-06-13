import { ButtonHTMLAttributes, ReactNode } from "react";

interface LuxuryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  loading?: boolean;
  children: ReactNode;
}

export function LuxuryButton({
  variant = "primary",
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}: LuxuryButtonProps) {
  return (
    <button
      className={`luxury-btn luxury-btn--${variant} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className={`spinner ${variant === "secondary" ? "spinner--dark" : ""}`} />}
      {children}
    </button>
  );
}
