import React, { type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string | undefined;
};

export function TextField({ id, label, error, ...props }: TextFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="field-stack">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? errorId : undefined}
        style={{
          width: '100%',
          minHeight: 42,
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '0 12px',
          background: '#fff',
          color: 'var(--color-ink)'
        }}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" style={{ color: 'var(--color-coral)', margin: 0 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
  error?: string | undefined;
};

export function TextAreaField({ id, label, error, ...props }: TextAreaFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="field-stack">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        className="text-area"
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" style={{ color: 'var(--color-coral)', margin: 0 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
