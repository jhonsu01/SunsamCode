import { useId } from "react";
import { cn } from "@/components/lib/utils.js";
import "./sunsamAnimatedLogo.css";

const RAYS = [
  { d: "M475 208L489 285", delay: "0.3s" },
  { d: "M793 468L870 445", delay: "0.38s" },
  { d: "M477 741L487 815", delay: "0.46s" },
  { d: "M156 510L228 487", delay: "0.54s" },
] as const;

/** Marca Sunsam a color (rayos claros + triángulo con degradado); `animated` activa la entrada y el latido. */
export function SunsamAnimatedMark({ className, animated = true }: { className?: string; animated?: boolean }) {
  const gradientId = `sunsam-tri-${useId().replace(/:/g, "")}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="116"
      height="100"
      fill="none"
      viewBox="130 180 760 660"
      className={cn("sunsam-logo-mark shrink-0 overflow-visible", animated && "sunsam-logo-mark--animated", className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="383" y1="394" x2="600" y2="640" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FDB673" />
          <stop offset="0.55" stopColor="#F4415E" />
          <stop offset="1" stopColor="#DC447F" />
        </linearGradient>
      </defs>
      {RAYS.map((ray) => (
        <path
          key={ray.d}
          className="sunsam-logo-ray"
          d={ray.d}
          stroke="#F4F1F7"
          strokeWidth="26"
          strokeLinecap="round"
          style={{ "--sunsam-ray-delay": ray.delay } as React.CSSProperties}
        />
      ))}
      <path className="sunsam-logo-tri" d="M383 394L733 442L436 629Z" fill={`url(#${gradientId})`} />
    </svg>
  );
}

/** Placa del icono de la app usada en el arranque y en la introducción. */
export function SunsamStartupLogoBadge({
  animated = true,
  size = "default",
}: {
  animated?: boolean;
  /** "titlebar": insignia de 20px de la barra de título (upstream 3.17). */
  size?: "default" | "titlebar";
}) {
  const titlebar = size === "titlebar";
  return (
    <div
      data-desktop-logo-badge={titlebar ? "true" : undefined}
      className={cn(
        "relative flex items-center justify-center bg-[linear-gradient(180deg,#1a1622_0%,#100e15_100%)]",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-[rgba(255,255,255,0.1)] before:content-['']",
        titlebar ? "size-5 rounded shadow-sm/20" : "size-24 rounded-3xl shadow-xl/20",
        animated && "sunsam-logo-badge--animated",
      )}
    >
      <SunsamAnimatedMark className={titlebar ? "h-auto w-3.5" : "h-auto w-16"} animated={animated} />
    </div>
  );
}

/** Marca de agua de la pantalla de inicio (contorno que sigue el tema y se desvanece hacia abajo). */
export function SunsamEmptyStateLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(
        className,
        "opacity-70 dark:opacity-60",
        "[-webkit-mask-image:linear-gradient(to_bottom,black_0%,transparent_75%,transparent_100%)]",
        "[-webkit-mask-repeat:no-repeat] [-webkit-mask-size:100%_100%]",
        "[mask-image:linear-gradient(to_bottom,black_0%,transparent_75%,transparent_100%)]",
        "[mask-repeat:no-repeat] [mask-size:100%_100%]",
      )}
      width="400"
      height="320"
      viewBox="110 180 800 640"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M466 213C464 207 469 202 475 202C481 202 485 206 486 211L499 284C500 290 496 296 490 297C484 298 478 294 477 288Z" />
        <path d="M467 742C466 736 471 731 477 731C483 731 487 735 488 740L497 814C498 820 494 825 488 826C482 827 477 823 476 817Z" />
        <path d="M152 499C146 501 143 507 145 513C147 519 153 522 159 520L231 497C237 495 240 489 238 483C236 477 230 474 224 476Z" />
        <path d="M789 457C783 459 780 465 782 471C784 477 790 480 796 478L873 455C879 453 882 447 880 441C878 435 872 432 866 434Z" />
        <path d="M383 394L733 442L436 629Z" />
      </g>
    </svg>
  );
}
