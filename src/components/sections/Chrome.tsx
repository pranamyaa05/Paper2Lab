import { FlaskConical, ImageUp } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";

export function Header() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-3 pt-3 md:pt-4">
      <nav aria-label="Main" className="glass-panel pointer-events-auto flex items-center gap-1 rounded-full py-1.5 pl-5 pr-1.5 text-[15px] font-bold text-ink">
        <a href="#top" className="mr-2 flex items-center gap-1.5 font-display text-lg font-extrabold">
          <FlaskConical className="size-5 text-sky-deep" aria-hidden />
          <span className="text-gradient-title">Paper2Lab</span>
        </a>
        <a href="#labs" className="hidden min-h-10 items-center rounded-full px-3.5 hover:bg-white/60 sm:flex">Labs</a>
        <a href="#story" className="hidden min-h-10 items-center rounded-full px-3.5 hover:bg-white/60 md:flex">How it works</a>
        <LinkButton href="#top" variant="glassBlush" size="sm" className="min-h-10 px-4 text-sm">
          <ImageUp /> Upload
        </LinkButton>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="px-4 pb-16 pt-6 md:px-8">
      <div className="mx-auto max-w-7xl text-center">
        <p className="font-display text-3xl font-extrabold text-ink md:text-5xl">
          Don't just read science. <span className="text-gradient-title">See it. Try it. Understand it.</span>
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-base text-ink/60">Paper2Lab is a free virtual science lab for every student, whatever their school, language or access to a real laboratory.</p>
      </div>
    </footer>
  );
}
