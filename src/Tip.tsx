import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GLOSSARY, type GlossaryId } from "./glossary";

const PAD = 8;
const GAP = 6;

export function Tip({
  id,
  on,
  children,
}: {
  id: GlossaryId;
  on: boolean;
  children: ReactNode;
}) {
  const wrap = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    function place() {
      const trigger = wrap.current;
      const box = bubble.current;
      if (!trigger || !box) return;
      const r = trigger.getBoundingClientRect();
      const w = box.offsetWidth;
      const h = box.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let top = r.top - h - GAP;
      if (top < PAD) top = r.bottom + GAP;
      if (top + h > vh - PAD) top = Math.max(PAD, vh - PAD - h);
      let left = r.left;
      if (left + w > vw - PAD) left = vw - PAD - w;
      if (left < PAD) left = PAD;
      setPos({ top, left });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, id]);

  if (!on) return <>{children}</>;
  return (
    <span
      className="tip"
      ref={wrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open &&
        createPortal(
          <div
            ref={bubble}
            className="tip-bubble"
            style={{
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              visibility: pos ? "visible" : "hidden",
            }}
          >
            {GLOSSARY[id]}
          </div>,
          document.body
        )}
    </span>
  );
}
