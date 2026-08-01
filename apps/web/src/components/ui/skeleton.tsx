export function Skeleton({ label = 'Loading' }: Readonly<{ label?: string }>) {
  return (
    <div
      aria-label={label}
      role="status"
      style={{
        minHeight: 20,
        borderRadius: 'var(--radius-sm)',
        background: 'linear-gradient(90deg, #e8e3da, #f7f5f0, #e8e3da)',
        backgroundSize: '200% 100%'
      }}
    />
  );
}
