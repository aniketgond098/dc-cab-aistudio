import { cn } from "@/lib/utils";
import { useInView } from "./Reveal";

const stages = [
  { k: "Flight tracked", v: "Pickup timed to the actual arrival" },
  { k: "Chauffeur dispatched", v: "Real-time dispatch, 24/7 operations" },
  { k: "Meet & greet", v: "Uniformed, English-speaking, verified" },
  { k: "GPS-tracked journey", v: "Every movement visible end to end" },
  { k: "Arrival & billing", v: "Automated, transparent billing" },
];

/** Editorial visualization of a DC Cabs transfer, built only from the company's stated capabilities. */
export function JourneyTrace({ className }: { className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.25);
  const path = "M40,470 C120,470 120,360 200,340 S300,250 260,180 S300,60 420,50";
  return (
    <div ref={ref} className={cn("relative flex h-full min-h-[460px] flex-col justify-between overflow-hidden border border-hairline bg-charcoal p-6 md:p-8", className)}>
      <svg viewBox="0 0 460 520" className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <pattern id="jgrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.9" className="fill-foreground/10" />
          </pattern>
        </defs>
        <rect width="460" height="520" fill="url(#jgrid)" />
        <path d={path} className="fill-none stroke-foreground/10" strokeWidth={10} strokeLinecap="round" />
        {inView && <path d={path} className="arc-draw fill-none stroke-primary" strokeWidth={2} strokeLinecap="round" style={{ animationDuration: "3s" }} />}
        <circle cx={40} cy={470} r={6} className="fill-foreground" />
        <circle cx={420} cy={50} r={9} className="pulse-ring fill-primary/50" />
        <circle cx={420} cy={50} r={6} className="fill-primary" />
        {inView && (
          <circle r={5} className="fill-foreground">
            <animateMotion dur="6s" repeatCount="indefinite" path={path} />
          </circle>
        )}
        <text x={56} y={490} className="fill-foreground/60 text-[11px] tracking-[0.2em]">AIRPORT</text>
        <text x={330} y={84} className="fill-foreground/60 text-[11px] tracking-[0.2em]">DESTINATION</text>
      </svg>
      <p className="eyebrow relative">A DC Cabs transfer</p>
      <ol className="relative ml-auto w-full max-w-[15rem] space-y-4">
        {stages.map((s, i) => (
          <li
            key={s.k}
            className={cn("border-l border-primary/60 bg-background/80 py-2 pl-4 pr-2 backdrop-blur-sm transition-all duration-700", inView ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0")}
            style={{ transitionDelay: `${400 + i * 250}ms` }}
          >
            <p className="text-sm font-bold tabular-nums text-primary-tint">0{i + 1}</p>
            <p className="text-sm font-semibold text-foreground">{s.k}</p>
            <p className="text-xs text-muted-foreground">{s.v}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
