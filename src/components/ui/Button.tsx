import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "glass" | "glassSky" | "glassOchre" | "glassBlush" | "rainbow" | "ghost";
export type ButtonSize = "pill" | "sm" | "round" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  glass: "glass-convex tint-sky",
  glassSky: "glass-convex tint-sky",
  glassOchre: "glass-convex tint-ochre",
  glassBlush: "glass-convex tint-blush",
  rainbow: "glass-convex tint-rainbow",
  ghost: "rounded-full text-ink/80 hover:bg-white/50 transition-colors",
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
}

/** Convex gradient-glass button in the Paper2Lab pastel palette. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "glass", size = "pill", className, type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-display font-bold whitespace-nowrap select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-deep/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
});

/** Anchor styled like a Button. */
export function LinkButton({ variant = "glass", size = "pill", className, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <a className={cn("inline-flex items-center justify-center gap-2 font-display font-bold whitespace-nowrap [&_svg]:size-4", VARIANTS[variant], SIZES[size], className)} {...rest} />;
}
