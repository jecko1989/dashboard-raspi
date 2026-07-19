import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

export interface KebabMenuItem {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  icon?: ReactNode;
}

interface KebabMenuProps {
  items: KebabMenuItem[];
  // Etichetta accessibile del pulsante (es. "Azioni luogo").
  ariaLabel?: string;
  // Usa i tre puntini orizzontali (⋯) invece che verticali (⋮).
  horizontal?: boolean;
}

// Menu contestuale a 3 puntini riutilizzabile (card device, sezioni luogo).
export function KebabMenu({ items, ariaLabel = 'Azioni', horizontal = true }: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 176 });
    }
    setOpen((o) => !o);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleOpen}
        className="rounded-md p-1.5 text-xl leading-none text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        {horizontal ? '⋯' : '⋮'}
      </button>
      {open && menuPos && createPortal(
        <div
          role="menu"
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="w-44 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                item.destructive
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-700 dark:text-gray-200'
              }`}
            >
              {item.icon && <span aria-hidden="true">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
