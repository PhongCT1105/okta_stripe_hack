import { cn } from "@/lib/utils";

/**
 * The WIP AI whip: an angular W that snaps into a penalty dot.
 * Inline SVG keeps the mark sharp, themeable, and asset-free at every size.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-xl border-2 border-foreground bg-signal text-signal-foreground",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="size-6"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="currentColor"
      >
        <path d="M3.5 6.5 6.7 17l4.1-7.7 3.8 7.7 2.6-8.7c.55-1.85 2.05-2.15 3.3-1.15" />
        <path d="M20.5 7.15c1.15 1.05.85 2.7-.65 3.35" />
        <circle cx="19.1" cy="14.45" r="1.35" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
