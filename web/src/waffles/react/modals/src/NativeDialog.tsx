// SQL Drills: replaces react-modal (no React 19 support worth keeping) with the native <dialog>, the same element
// the old app's askConfirm uses (#confirmDlg). It takes the react-modal props BaseDialog and Panel passed, so those
// components keep their code: the <dialog> itself is the overlay (overlayClassName), the content sits inside it
// (className); showModal() gives the focus trap, inert page and Esc; focus returns to where it was on close.
import React, { useEffect, useRef, useState } from 'react';

type ClassNames = { afterOpen: string; base: string; beforeClose: string };
export type RequestCloseEvent = { type: 'click' | 'keydown' };

interface NativeDialogProps {
  bodyOpenClassName?: string;
  children: React.ReactNode;
  className: ClassNames;
  closeTimeoutMS?: number;
  contentLabel: string;
  data?: { [key: string]: string };
  id?: string;
  isOpen: boolean;
  onAfterOpen?: () => void;
  onRequestClose: (event: RequestCloseEvent) => void;
  overlayClassName: ClassNames;
  shouldCloseOnEsc?: boolean;
  shouldCloseOnOverlayClick?: boolean;
}

const dialogReset: React.CSSProperties = {
  border: 0, height: '100%', inset: 0, margin: 0, maxHeight: 'none', maxWidth: 'none', padding: 0, width: '100%',
};

const NativeDialog = ({
  bodyOpenClassName, children, className, closeTimeoutMS = 0, contentLabel, data, id, isOpen, onAfterOpen, onRequestClose,
  overlayClassName, shouldCloseOnEsc = true, shouldCloseOnOverlayClick = true,
}: NativeDialogProps): React.ReactElement | null => {
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(isOpen);
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');

  useEffect(() => {
    if (isOpen) { setMounted(true); return undefined; }
    if (!mounted) return undefined;
    setPhase('closing');
    const t = window.setTimeout(() => { ref.current?.open && ref.current.close(); setMounted(false); setPhase('closed'); }, closeTimeoutMS);
    return () => window.clearTimeout(t);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const d = ref.current;
    if (!mounted || !isOpen || !d) return undefined;
    if (!d.open) d.showModal();
    if (bodyOpenClassName) document.body.classList.add(bodyOpenClassName);
    const raf = window.requestAnimationFrame(() => { setPhase('open'); if (onAfterOpen) onAfterOpen(); });
    return () => { window.cancelAnimationFrame(raf); if (bodyOpenClassName) document.body.classList.remove(bodyOpenClassName); };
  }, [mounted, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;
  const pick = (c: ClassNames) => [c.base, phase === 'open' && c.afterOpen, phase === 'closing' && c.beforeClose].filter(Boolean).join(' ');
  const dataAttrs = Object.fromEntries(Object.entries(data || {}).map(([k, v]) => ['data-' + k, v]));
  return (
    <dialog
      aria-label={contentLabel}
      aria-modal="true"
      className={pick(overlayClassName)}
      id={id}
      onCancel={(e) => { e.preventDefault(); if (shouldCloseOnEsc) onRequestClose({ type: 'keydown' }); }}
      onClick={(e) => { if (e.target === e.currentTarget && shouldCloseOnOverlayClick) onRequestClose({ type: 'click' }); }}
      ref={ref}
      style={dialogReset}
      {...dataAttrs}
    >
      <div className={pick(className)}>{children}</div>
    </dialog>
  );
};

export default NativeDialog;
