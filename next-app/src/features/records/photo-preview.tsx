"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function PhotoPreview({ file, onRemove, disabled }: { file: File; onRemove: () => void; disabled: boolean }) {
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (imageRef.current) imageRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return <li className="photo-preview">
    {/* Browser-local blob URLs do not require Next.js image optimization. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img ref={imageRef} alt={`등록 사진: ${file.name}`} width={96} height={96} />
    <button type="button" className="photo-remove" onClick={onRemove} disabled={disabled} aria-label={`${file.name} 사진 삭제`}><X size={14} /></button>
    <span title={file.name}>{file.name}</span>
  </li>;
}
