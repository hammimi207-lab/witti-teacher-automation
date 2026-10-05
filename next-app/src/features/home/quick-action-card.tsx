import type { LucideIcon } from "lucide-react";

type Props = {
  title: string; description: string; icon: LucideIcon;
  variant?: "capture" | "record"; disabled?: boolean; loading?: boolean;
  badge?: string; ariaLabel?: string;
} & ({ href: string; onClick?: never } | { href?: never; onClick: () => void });

export function QuickActionCard({ title, description, icon: Icon, variant = "record", disabled, loading, badge, ariaLabel, href, onClick }: Props) {
  const content = <><span className="action-card-top"><Icon size={28} aria-hidden="true" />{badge && <small>{badge}</small>}</span><strong>{title}</strong><span className="action-description">{description}</span></>;
  const common = { className: `quick-action-card ${variant}`, "aria-label": ariaLabel, "aria-busy": loading || undefined };
  return href && !disabled && !loading
    ? <a {...common} href={href}>{content}</a>
    : <button {...common} type="button" disabled={disabled || loading} onClick={onClick}>{content}</button>;
}
