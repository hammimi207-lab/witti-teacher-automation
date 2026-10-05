export function FairyImage({ className, decorative = true, width = 48, height = 54 }: { className?: string; decorative?: boolean; width?: number; height?: number }) {
  // All record-fairy illustrations share the home screen asset.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/girok-fairy.svg" className={className} width={width} height={height} alt={decorative ? "" : "기록 요정"} aria-hidden={decorative || undefined} style={{ objectFit: "contain", flexShrink: 0 }} />;
}
