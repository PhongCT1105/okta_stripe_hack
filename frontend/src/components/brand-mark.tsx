import { cn } from "@/lib/utils";

/**
 * Brand mark: a handshake-as-checkmark. A commitment made, then kept.
 * Drawn inline rather than shipped as an asset so it inherits currentColor.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="size-5"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="currentColor"
      >
        <path d="M4 12.5 9 17.5 20 6.5" />
        <circle cx="9" cy="17.5" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
