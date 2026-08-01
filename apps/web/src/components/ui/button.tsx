import React, { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';
import './button.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  variant?: 'primary' | 'secondary';
};

export function Button({
  children,
  className,
  icon,
  iconPosition = 'left',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button className={clsx('ui-button', `ui-button-${variant}`, className)} {...props}>
      {icon && iconPosition === 'left' ? <span className="ui-button-icon">{icon}</span> : null}
      <span>{children}</span>
      {icon && iconPosition === 'right' ? <span className="ui-button-icon">{icon}</span> : null}
    </button>
  );
}
