"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onAudit: () => void;
  onReset: () => void;
  onDeleteData: () => void;
  onExport: () => void;
  disabled?: boolean;
  showAudit?: boolean;
};

export function SimulationOverflowMenu({
  open,
  onClose,
  onAudit,
  onReset,
  onDeleteData,
  onExport,
  disabled,
  showAudit = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sim-overflow-menu" ref={ref} role="menu">
      {showAudit ? (
        <button type="button" className="sim-overflow-item" disabled={disabled} onClick={onAudit}>
          Audit
        </button>
      ) : null}
      <button type="button" className="sim-overflow-item" disabled={disabled} onClick={onReset}>
        Reset
      </button>
      <button type="button" className="sim-overflow-item" disabled={disabled} onClick={onDeleteData}>
        Delete Data
      </button>
      <button type="button" className="sim-overflow-item" disabled={disabled} onClick={onExport}>
        Export
      </button>
    </div>
  );
}
