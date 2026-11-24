import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "glass" | "glassSky" | "glassOchre" | "glassBlush" | "rainbow" | "ghost" | "tubeSky" | "tubeOchre" | "tubeBlush";
export type ButtonSize = "pill" | "sm" | "round" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  glass: "glass-convex tint-sky",
  glassSky: "glass-convex tint-sky",
  glassOchre: "glass-convex tint-ochre",
  glassBlush: "glass-convex tint-blush",
  rainbow: "glass-convex tint-rainbow",
  ghost: "rounded-full text-ink/80 hover:bg-white/50 transition-colors",
  // Main actions: a corked test tube of liquid.
  tubeSky: "btn-tube liq-sky",
  tubeOchre: "btn-tube liq-ochre",
  tubeBlush: "btn-tube liq-blush",
};
const SIZES: Record<ButtonSize, string> = {
  pill: "rounded-full px-5 py-2.5 text-sm",
  sm: "rounded-full px-3.5 py-1.5 text-xs",
  lg: "rounded-full px-7 py-3.5 text-base",
  round: "rounded-full size-11 grid place-items-center [&_svg]:size-5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Show a small pilot lamp, like a bench instrument, that flashes green when the button is pressed. */
  lamp?: boolean;
}

/** Convex gradient-glass button in the Paper2Lab pastel palette. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "glass", size = "pill", lamp = false, className, type = "button", onClick, children, ...rest }, ref) {
  const [lit, setLit] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (
    <button
      ref={ref}
      type={type}
      onClick={(e) => {
        if (lamp) {
          setLit(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setLit(false), 650);
        }
        onClick?.(e);
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-display font-bold whitespace-nowrap select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-deep/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        VARIANTS[variant],
        SIZES[size],
        // Round icon buttons are petri dishes (except the plain close button).
        size === "round" && variant !== "ghost" && "btn-dish",
        className,
      )}
      {...rest}
    >
      {lamp && <span aria-hidden className={cn("size-2 shrink-0 rounded-full transition-all duration-200", lit ? "bg-[#7be0b0] shadow-[0_0_10px_2px_#7be0b0]" : "bg-ink/25")} />}
      {children}
    </button>
  );
});

/** Anchor styled like a Button. */
export function LinkButton({ variant = "glass", size = "pill", className, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <a className={cn("inline-flex items-center justify-center gap-2 font-display font-bold whitespace-nowrap [&_svg]:size-4", VARIANTS[variant], SIZES[size], className)} {...rest} />;
}
