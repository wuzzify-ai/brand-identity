type ToastProps = {
  tone?: 'success' | 'warning' | 'error';
  message: string;
};

export function Toast({ tone = 'success', message }: ToastProps) {
  return (
    <div
      role="status"
      style={{
        border: '1px solid var(--color-border)',
        borderLeft: `4px solid ${tone === 'error' ? 'var(--color-coral)' : tone === 'warning' ? 'var(--color-gold)' : 'var(--color-signal)'}`,
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-paper)',
        padding: '12px 14px'
      }}
    >
      {message}
    </div>
  );
}
