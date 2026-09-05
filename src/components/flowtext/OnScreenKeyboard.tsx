import { useCallback, useEffect, useRef, useState } from "react";

type Field = HTMLInputElement | HTMLTextAreaElement;
type Panel = "letters" | "symbols" | "emoji";

const ROW1 = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const ROW2 = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
const ROW3 = ["z", "x", "c", "v", "b", "n", "m"];

const SYM1 = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const SYM2 = ["@", "#", "$", "%", "&", "*", "-", "+", "(", ")"];
const SYM3 = ["!", '"', "'", ":", ";", "/", "?", ",", "."];

const EMOJI: { label: string; items: string[] }[] = [
  {
    label: "Smileys",
    items: [
      "😀","😃","😄","😁","😆","😅","😂","🤣","🙂","🙃","😉","😊","😇","🥰","😍","😘","😗","😚","😙","🥲",
      "😋","😛","😜","🤪","😝","🤗","🤔","🤭","😐","😑","😶","😏","😒","🙄","😬","😮","😯","😲","🥺","😢",
      "😭","😤","😠","😡","🤯","😳","🥵","🥶","😱","😴","🤤","😷","🤒","🤕","🤠","🥳","😎","🤓","🧐","🤡",
    ],
  },
  {
    label: "Gestures",
    items: [
      "👍","👎","👌","🤌","✌️","🤞","🤟","🤘","👏","🙌","🙏","🤝","💪","👋","🖐️","✋","🖖","👊","🤛","🤜",
      "☝️","👆","👇","👉","👈","✍️","💅","🫶","🫰","🤙",
    ],
  },
  {
    label: "Hearts",
    items: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","✨"],
  },
];

function setFieldValue(field: Field, value: string, caret: number) {
  const proto =
    field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  try {
    field.setSelectionRange(caret, caret);
  } catch {
    /* some input types don't support selection */
  }
}

function isTextField(el: EventTarget | null): el is Field {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    return ["text", "search", "", "email", "url"].includes(el.type);
  }
  return false;
}

export function OnScreenKeyboard() {
  const [field, setField] = useState<Field | null>(null);
  const [panel, setPanel] = useState<Panel>("letters");
  const [shift, setShift] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const open = field !== null;

  const close = useCallback(() => {
    setField(null);
    setPanel("letters");
    setShift(false);
  }, []);

  useEffect(() => {
    function onFocusIn(event: FocusEvent) {
      const target = event.target;
      if (!isTextField(target)) return;
      if (target.closest("[data-osk-off]") || target.dataset["oskOff"] !== undefined) return;
      setField(target);
      setPanel("letters");
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (barRef.current?.contains(target)) return;
      if (isTextField(target)) return;
      close();
    }
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [close]);

  useEffect(() => {
    const height = open ? (barRef.current?.offsetHeight ?? 0) : 0;
    document.body.style.paddingBottom = height ? `${height}px` : "";
    document.documentElement.style.setProperty("--osk-height", height ? `${height}px` : "0px");
    return () => {
      document.body.style.paddingBottom = "";
      document.documentElement.style.setProperty("--osk-height", "0px");
    };
  }, [open, panel]);


  const insert = (text: string) => {
    if (!field) return;
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? start;
    const next = field.value.slice(0, start) + text + field.value.slice(end);
    setFieldValue(field, next, start + text.length);
    field.focus();
  };

  const backspace = () => {
    if (!field) return;
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? start;
    if (start === end && start === 0) return;
    const from = start === end ? start - 1 : start;
    const next = field.value.slice(0, from) + field.value.slice(end);
    setFieldValue(field, next, from);
    field.focus();
  };

  const submit = () => {
    if (!field) return;
    const targetId = field.dataset["oskSubmit"];
    if (targetId) {
      const button = document.getElementById(targetId) as HTMLButtonElement | null;
      button?.click();
    } else {
      const form = field.closest("form");
      if (form) form.requestSubmit();
    }
    field.focus();
  };

  const actionLabel = field?.dataset["oskAction"] ?? "Send";
  const letters = (keys: string[]) => (shift ? keys.map((k) => k.toUpperCase()) : keys);

  const keyClass =
    "grid h-11 flex-1 place-items-center rounded-lg bg-white text-[15px] font-medium text-neutral-800 shadow-sm active:bg-neutral-200";
  const modClass =
    "grid h-11 place-items-center rounded-lg bg-neutral-300 px-3 text-xs font-semibold text-neutral-700 active:bg-neutral-400";

  return (
    <div
      ref={barRef}
      aria-hidden={!open}
      className={`fixed inset-x-0 bottom-0 z-[80] select-none border-t border-neutral-300 bg-neutral-200 pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out ${
        open ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
      onPointerDown={(event) => event.preventDefault()}
    >
      {panel === "emoji" ? (
        <div className="max-h-64 overflow-y-auto p-2">
          {EMOJI.map((group) => (
            <div key={group.label} className="mb-2">
              <p className="px-1 pb-1 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
                {group.label}
              </p>
              <div className="grid grid-cols-8 gap-1 sm:grid-cols-12">
                {group.items.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insert(emoji)}
                    className="grid h-9 place-items-center rounded-lg bg-white text-lg active:bg-neutral-200"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 p-1.5">
          <div className="flex gap-1.5">
            {(panel === "letters" ? letters(ROW1) : SYM1).map((k) => (
              <button key={k} type="button" onClick={() => insert(k)} className={keyClass}>
                {k}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 px-3">
            {(panel === "letters" ? letters(ROW2) : SYM2).map((k) => (
              <button key={k} type="button" onClick={() => insert(k)} className={keyClass}>
                {k}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {panel === "letters" ? (
              <button
                type="button"
                onClick={() => setShift((s) => !s)}
                aria-pressed={shift}
                className={`${modClass} ${shift ? "bg-neutral-500 text-white" : ""}`}
              >
                ⇧
              </button>
            ) : (
              <span className="w-10" />
            )}
            {(panel === "letters" ? letters(ROW3) : SYM3).map((k) => (
              <button key={k} type="button" onClick={() => insert(k)} className={keyClass}>
                {k}
              </button>
            ))}
            <button type="button" onClick={backspace} className={modClass} aria-label="Backspace">
              ⌫
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPanel(panel === "letters" ? "symbols" : "letters")}
              className={modClass}
            >
              {panel === "letters" ? "123" : "ABC"}
            </button>
            <button
              type="button"
              onClick={() => setPanel("emoji")}
              className={modClass}
              aria-label="Emoji"
            >
              🙂
            </button>
            <button type="button" onClick={() => insert(" ")} className={`${keyClass} flex-[4]`}>
              space
            </button>
            <button type="button" onClick={() => insert("\n")} className={modClass}>
              return
            </button>
            <button
              type="button"
              onClick={submit}
              className="grid h-11 place-items-center rounded-lg bg-neutral-800 px-4 text-xs font-semibold text-white active:bg-neutral-700"
            >
              {actionLabel}
            </button>
          </div>
        </div>
      )}
      {panel === "emoji" && (
        <div className="flex items-center gap-1.5 border-t border-neutral-300 p-1.5">
          <button type="button" onClick={() => setPanel("letters")} className={modClass}>
            ABC
          </button>
          <button type="button" onClick={backspace} className={modClass} aria-label="Backspace">
            ⌫
          </button>
          <button type="button" onClick={() => insert(" ")} className={`${keyClass} flex-[3]`}>
            space
          </button>
          <button
            type="button"
            onClick={submit}
            className="grid h-11 place-items-center rounded-lg bg-neutral-800 px-4 text-xs font-semibold text-white active:bg-neutral-700"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
