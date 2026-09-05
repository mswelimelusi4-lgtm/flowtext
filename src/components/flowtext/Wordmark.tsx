import { cn } from "@/lib/utils";

/** FlowText wordmark: chrome-gradient display type, no icon. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn("font-display chrome-text font-bold tracking-tight select-none", className)}
    >
      FlowText
    </span>
  );
}
