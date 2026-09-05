import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserAvatar({
  name,
  src,
  className,
  square,
}: {
  name: string;
  src?: string | null | undefined;
  className?: string | undefined;
  square?: boolean | undefined;
}) {
  const shape = square ? "rounded-xl" : "rounded-full";
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        className={cn("shrink-0 bg-bone-soft object-cover", shape, className ?? "size-10")}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "font-display grid shrink-0 place-items-center bg-bone-deep text-[0.7em] font-bold text-ink-soft",
        shape,
        className ?? "size-10",
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}
