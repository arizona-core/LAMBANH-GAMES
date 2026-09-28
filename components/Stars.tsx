export function Stars({ value, max = 5, size = 16 }: { value: number; max?: number; size?: number }) {
  return (
    <span className="stars" style={{ fontSize: size }} role="img" aria-label={`${value} trên ${max} sao`}>
      {"★".repeat(value)}
      <span className="stars__off">{"★".repeat(Math.max(0, max - value))}</span>
    </span>
  );
}
