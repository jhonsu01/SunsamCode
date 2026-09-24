import { cn } from "@/components/lib/utils.js";

/** Marca monocroma de Sunsam (brújula + triángulo). Usa `currentColor` para seguir el tema. */
export function SunsamMarkLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="116"
      height="100"
      fill="none"
      viewBox="130 180 760 660"
      className={cn("shrink-0 text-current", className)}
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" strokeWidth="26" strokeLinecap="round">
        <path d="M475 208L489 285" />
        <path d="M477 741L487 815" />
        <path d="M156 510L228 487" />
        <path d="M793 468L870 445" />
      </g>
      <path d="M383 394L733 442L436 629Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Marca + texto "SUNSAM CODE" para cabeceras anchas. Se reexporta como `ZCodeWordmarkLogo`.
 * @lintignore
 */
export function SunsamWordmarkLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2 text-current", className)}>
      <SunsamMarkLogo className="h-[1.1em] w-auto" />
      <span className="font-semibold tracking-[0.18em]">SUNSAM CODE</span>
    </span>
  );
}
