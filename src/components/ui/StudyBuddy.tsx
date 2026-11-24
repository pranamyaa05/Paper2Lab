import { useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type BuddyMood = "idle" | "thinking" | "cheer";

const BODY = "M48 20V46L22 88Q16 102 32 104H88Q104 102 98 88L72 46V20Z";
const WAVE = "M-40 66q10-6 20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0V122H-40Z";
const INK = "#33406e";
const OUTLINE = "#5c6aa8";
const MOUTH = "#a8325a";

/**
 * Bubbles, the study buddy: a friendly little flask. Drawn in SVG so it stays sharp at any size.
 * It blinks, bobs, sloshes, moves its mouth while `speaking`, tilts its head while thinking and cheers.
 */
export function StudyBuddy({ mood = "idle", speaking = false, className }: { mood?: BuddyMood; speaking?: boolean; className?: string }) {
  const id = useId();
  const cheer = mood === "cheer";
  const think = mood === "thinking";
  return (
    <svg viewBox="0 0 120 120" className={cn("buddy", cheer && "buddy-cheer", think && "buddy-think", className)} aria-hidden>
      <defs>
        <clipPath id={`${id}b`}>
          <path d={BODY} />
        </clipPath>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9fd8f7" />
          <stop offset="1" stopColor="#f7b3cd" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="111" rx="30" ry="4.5" fill="#6f8fb8" opacity="0.18" />
      <g className="buddy-body">
        {/* little hands and feet, behind the glass */}
        <circle className="buddy-hand-l" cx="19" cy="86" r="6" fill="#ffd6e3" stroke={OUTLINE} strokeWidth="2.2" />
        <circle className="buddy-hand-r" cx="101" cy="86" r="6" fill="#ffd6e3" stroke={OUTLINE} strokeWidth="2.2" />
        <ellipse cx="42" cy="106" rx="9" ry="5" fill="#ffd6e3" stroke={OUTLINE} strokeWidth="2.2" />
        <ellipse cx="78" cy="106" rx="9" ry="5" fill="#ffd6e3" stroke={OUTLINE} strokeWidth="2.2" />

        {/* glass, liquid and shine */}
        <path d={BODY} fill="#fff" fillOpacity="0.6" />
        <g clipPath={`url(#${id}b)`}>
          <g className="buddy-wave">
            <path d={WAVE} fill={`url(#${id}l)`} />
          </g>
        </g>
        <path d="M33 84Q29 93 35 99" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" fill="none" opacity="0.8" />
        <path d={BODY} fill="none" stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round" />

        {/* cork hat */}
        <rect x="43" y="7" width="34" height="14" rx="5" fill="#ecbf80" stroke="#b9854a" strokeWidth="2.2" />
        <path d="M49 12h10" stroke="#fff" opacity="0.6" strokeWidth="2.2" strokeLinecap="round" />

        {/* face */}
        <g className={cn("buddy-eyes", !cheer && "buddy-blink")} transform={think ? "translate(2 -2.5)" : undefined}>
          {cheer ? (
            <>
              <path d="M44 80q6-8 12 0" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
              <path d="M64 80q6-8 12 0" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              <circle cx="50" cy="78" r="5.4" fill={INK} />
              <circle cx="70" cy="78" r="5.4" fill={INK} />
              <circle cx="52" cy="76" r="1.8" fill="#fff" />
              <circle cx="72" cy="76" r="1.8" fill="#fff" />
            </>
          )}
        </g>
        <ellipse cx="40.5" cy="88" rx="5.6" ry="3.2" fill="#ff8fb1" opacity="0.6" />
        <ellipse cx="79.5" cy="88" rx="5.6" ry="3.2" fill="#ff8fb1" opacity="0.6" />
        {cheer ? (
          <path d="M52 88Q60 101 68 88Z" fill={MOUTH} />
        ) : speaking ? (
          <g className="buddy-talk">
            <ellipse cx="60" cy="91" rx="4.2" ry="3.8" fill={MOUTH} />
            <ellipse cx="60" cy="92.6" rx="2.4" ry="1.3" fill="#ff8fb1" />
          </g>
        ) : think ? (
          <ellipse cx="62" cy="91" rx="2.2" ry="2.7" fill={MOUTH} />
        ) : (
          <path d="M54 89Q60 95 66 89" stroke={MOUTH} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        )}
      </g>

      {think && (
        <g fill={OUTLINE}>
          <circle className="buddy-dot" cx="88" cy="28" r="2.6" />
          <circle className="buddy-dot" cx="97" cy="22" r="3.2" style={{ animationDelay: "0.2s" }} />
          <circle className="buddy-dot" cx="108" cy="14" r="3.8" style={{ animationDelay: "0.4s" }} />
        </g>
      )}
      {cheer &&
        [
          [20, 30],
          [102, 36],
          [104, 70],
        ].map(([x, y], i) => (
          <path key={i} className="buddy-sparkle" transform={`translate(${x} ${y})`} d="M0-7 2-2 7 0 2 2 0 7-2 2-7 0-2-2Z" fill="#f6c453" style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
    </svg>
  );
}

/**
 * Bubbles in the corner of the 3D view, with a speech bubble that shows exactly what it is saying.
 * Tap Bubbles to hear the line again; the × tucks the speech bubble away.
 */
export function BuddyCorner({
  line,
  mood,
  speaking,
  open,
  onOpen,
  onClose,
  onRepeat,
}: {
  line: { text: string; tip?: string | undefined } | null;
  mood: BuddyMood;
  speaking: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRepeat: () => void;
}) {
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex max-w-[calc(100%-4.25rem)] items-end gap-1 sm:left-3 sm:bottom-3">
      <button
        onClick={() => (open ? onRepeat() : onOpen())}
        className="pointer-events-auto shrink-0 rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-deep/60 active:scale-95"
        aria-label={open ? "Bubbles, your study buddy. Tap to hear that again." : "Bubbles, your study buddy. Tap to see what it said."}
        title={open ? "Tap Bubbles to hear it again" : "Tap Bubbles"}
      >
        <StudyBuddy mood={mood} speaking={speaking} className="size-[4.5rem] drop-shadow-[0_6px_8px_rgba(80,110,170,0.25)] sm:size-24" />
      </button>
      {line && open && (
        <Bubble onClose={onClose}>
          <p className="thin-scroll max-h-[4.6rem] overflow-y-auto pr-1 text-[13px] font-semibold leading-snug text-ink sm:max-h-[6.5rem]">{line.text}</p>
          {line.tip && <p className="mt-1 hidden text-[11px] font-bold text-ink/50 sm:block">{line.tip}</p>}
        </Bubble>
      )}
    </div>
  );
}

function Bubble({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div role="status" aria-live="polite" className="animate-caption-in pointer-events-auto relative mb-3 min-w-0 max-w-[22rem] rounded-2xl rounded-bl-md bg-white/92 py-2.5 pl-3.5 pr-8 shadow-[0_10px_24px_-10px_rgba(80,110,170,0.45)] ring-1 ring-white">
      <span aria-hidden className="absolute -left-1.5 bottom-3 size-3 rotate-45 rounded-[2px] bg-white/92" />
      <button onClick={onClose} aria-label="Hide Bubbles' message" className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full text-ink/45 hover:bg-white hover:text-ink">
        <X className="size-3.5" />
      </button>
      {children}
    </div>
  );
}
