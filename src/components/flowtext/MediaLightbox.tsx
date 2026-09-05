import { useEffect } from "react";

export type LightboxItem = { url: string; kind: "image" | "video" };

export function MediaLightbox({
  item,
  onClose,
}: {
  item: LightboxItem | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!item) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full size media"
      onClick={onClose}
      className="fixed inset-0 z-[90] grid place-items-center bg-ink/85 p-4 backdrop-blur-sm"
    >
      {item.kind === "image" ? (
        <img
          src={item.url}
          alt=""
          className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
        />
      ) : (
        <video
          src={item.url}
          controls
          autoPlay
          className="max-h-[85vh] max-w-full rounded-xl shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        />
      )}
      <button
        onClick={onClose}
        aria-label="Close"
        className="font-display absolute top-4 right-4 rounded-full bg-bone/90 px-3 py-1.5 text-xs font-semibold text-ink"
      >
        Close
      </button>
    </div>
  );
}
