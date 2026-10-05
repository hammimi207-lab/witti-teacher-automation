"use client";

import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export type CaptureDialogHandle = { open: () => void; close: () => void };

export const CaptureDialog = forwardRef<CaptureDialogHandle, { title: string; id: string; children: ReactNode; onClose?: () => void; beforeClose?: () => boolean; className?: string }>(function CaptureDialog({ title, id, children, onClose, beforeClose, className = "" }, ref) {
  const dialog = useRef<HTMLDialogElement>(null);
  useImperativeHandle(ref, () => ({ open: () => { if (!dialog.current?.open) dialog.current?.showModal(); }, close: () => dialog.current?.close() }), []);
  return <dialog ref={dialog} className={`capture-dialog ${className}`} aria-labelledby={id} onClose={onClose} onCancel={event => { if (beforeClose && !beforeClose()) event.preventDefault(); }}>
    <header className="capture-heading"><h2 id={id}>{title}</h2><button type="button" className="capture-close" aria-label={`${title} 닫기`} onClick={() => { if (!beforeClose || beforeClose()) dialog.current?.close(); }}><X aria-hidden="true" /></button></header>
    {children}
  </dialog>;
});
