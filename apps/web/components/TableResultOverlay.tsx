'use client';

import { useCallback, useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface TableResultOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  closeLabel: string;
  children: ReactNode;
}

export default function TableResultOverlay({
  isOpen,
  onClose,
  title,
  closeLabel,
  children,
}: TableResultOverlayProps) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, handleClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-gray-950/95 p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title?.trim() || closeLabel}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 pb-3 border-b border-gray-700/80">
        {title ? (
          <h2 className="text-base font-semibold text-emerald-400 min-w-0 break-words">
            {title}
          </h2>
        ) : (
          <span className="sr-only">{closeLabel}</span>
        )}
        <button
          type="button"
          onClick={handleClose}
          title={closeLabel}
          aria-label={closeLabel}
          className="inline-flex shrink-0 items-center justify-center rounded-md border border-gray-600/80 bg-gray-800/60 p-1.5 text-gray-200 hover:bg-gray-700/80 transition-colors"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto pt-4">{children}</div>
    </div>
  );
}
