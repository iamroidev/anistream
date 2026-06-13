interface MetricCardProps {
  label: string;
  value: string | number;
}

export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="metric-card">
      <p className="metric-label mb-2">{label}</p>
      <p className="metric-value">{value}</p>
    </div>
  );
}
