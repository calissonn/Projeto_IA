'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from './ui';

/**
 * Botão com confirmação no próprio botão (segundo toque em até 4 s).
 * Substitui window.confirm, que não funciona em todos os ambientes (ex.: páginas incorporadas).
 */
export function ConfirmButton({
  children,
  confirmLabel,
  onConfirm,
  variant = 'danger',
  className,
  disabled,
  title,
}: {
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  variant?: 'primary' | 'ok' | 'danger' | 'ghost';
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      variant={variant}
      className={`${className ?? ''} ${armed ? 'ring-2 ring-amber-300' : ''}`}
      disabled={disabled}
      title={title}
      aria-live="polite"
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}
