'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';
import './dialog.css';

type DialogProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function Dialog({ title, open, onClose, children }: DialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-header">
          <h2 id="dialog-title">{title}</h2>
          <Button
            type="button"
            variant="secondary"
            icon={<X aria-hidden="true" />}
            aria-label="Close dialog"
            onClick={onClose}
          />
        </div>
        {children}
      </section>
    </div>
  );
}
