import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { fleet, indiaCities, services, stats, worldDestinations, differentiators, regions } from "@/content/site";
import { cn } from "@/lib/utils";
import { Reveal, useInView } from "./Reveal";
import { CTALink } from "./ui";
import { JourneyTrace } from "./JourneyTrace";

function Counter({ to, run }: { to: number; run: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1600);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, to]);
  return <>{n}</>;
}

export function StatsSection() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  return (
    <section className="border-y border-border bg-background">
      <div ref={ref} className="container-x grid grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "reveal border-border py-10 md:py-14",
              inView && "is-visible",
              i % 2 === 1 && "border-l pl-6 md:pl-10",
              i >= 2 && "border-t lg:border-t-0",
              i === 2 && "lg:border-l lg:pl-10",
            )}
            style={{ transitionDelay: `${i * 120}ms` }}
          >
            <p className="font-display text-4xl font-bold uppercase sm:text-6xl">
              {"value" in s && s.value ? (
                <>
                  <Counter to={s.value} run={inView} />
                  <span className="text-primary">{s.suffix}</span>
                </>
              ) : (
                s.text
              )}
            </p>
            <p className="eyebrow mt-4">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ServiceList({ items = services }: { items?: { title: string; body: string; image?: string | undefined }[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
      <ul className="border-t border-border">
        {items.map((s, i) => (
          <li key={s.title}>
            <Link
              to="/contact"
              search={{ type: s.title } as never}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              className="group grid grid-cols-[2.5rem_1fr_auto] items-start gap-4 border-b border-border py-7 md:py-8"
            >
              <span className="pt-2 text-xs font-semibold tabular-nums text-muted-foreground">0{i + 1}</span>
              <span>
                <span className={cn("font-display block text-2xl font-bold uppercase transition-colors duration-300 md:text-4xl", active === i ? "text-foreground" : "text-foreground/45")}>
                  {s.title}
                </span>
                <span className={cn("grid transition-all duration-500", active === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 lg:grid-rows-[0fr]")}>
                  <span className="overflow-hidden">
                    <span className="block max-w-md pt-3 text-muted-foreground">{s.body}</span>
                  </span>
                </span>
              </span>
              <ArrowUpRight className={cn("mt-2 size-6 transition-all duration-300", active === i ? "text-primary" : "text-foreground/30")} />
            </Link>
          </li>
        ))}
      </ul>
      <div className="relative hidden aspect-[4/5] overflow-hidden lg:sticky lg:top-24 lg:block lg:self-start">
        {items.map((s, i) => s.image ? (
          <img
            key={s.title}
            src={s.image}
            alt={s.title}
            loading="lazy"
            className={cn("absolute inset-0 size-full object-cover transition-all duration-1000", active === i ? "scale-100 opacity-100" : "scale-105 opacity-0")}
          />
        ) : (
          <div key={s.title} className={cn("absolute inset-0 transition-opacity duration-1000", active === i ? "opacity-100" : "pointer-events-none opacity-0")}>
            <JourneyTrace className="border-0" />
          </div>
        ))}
        <div className="bg-scrim absolute inset-0" />
      </div>
    </div>
  );
}

export function VehicleCard({ cat, index, large }: { cat: (typeof fleet)[number]; index: number; large?: boolean }) {
  return (
    <Reveal delay={index * 80} className="group">
      <div className={cn("relative overflow-hidden bg-charcoal", large ? "aspect-[16/10]" : "aspect-[4/3]")}>
        <img src={cat.image} alt={cat.name} loading="lazy" className="size-full object-cover transition-transform duration-[1400ms] group-hover:scale-105" />
        <span className="absolute left-5 top-5 text-xs font-semibold tracking-[0.2em] text-foreground/70">0{index + 1}</span>
      </div>
      <div className="flex items-start justify-between gap-6 pt-6">
        <div>
          <h3 className="font-display text-2xl font-bold uppercase md:text-3xl">{cat.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{cat.models.join(" · ")}</p>
        </div>
      </div>
    </Reveal>
  );
}

const project = (lon: number, lat: number, box: [number, number, number, number], w: number, h: number) => {
  const [minLon, maxLon, minLat, maxLat] = box;
  return [((lon - minLon) / (maxLon - minLon)) * w, ((maxLat - lat) / (maxLat - minLat)) * h] as const;
};

export function IndiaNetwork() {
  const { ref, inView } = useInView<HTMLDivElement>(0.25);
  const W = 500, H = 560;
  const box: [number, number, number, number] = [67, 98, 6, 37];
  const delhi = project(77.2, 28.6, box, W, H);
  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="DC Cabs city network across India">
        <defs>
          <pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" className="fill-foreground/10" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#dots)" />
        {inView &&
          indiaCities.filter((c) => c.name !== "Delhi").map((c, i) => {
            const [x, y] = project(c.at[0], c.at[1], box, W, H);
            return (
              <path
                key={c.name}
                d={`M${delhi[0]},${delhi[1]} Q${(delhi[0] + x) / 2 + 30},${(delhi[1] + y) / 2 - 20} ${x},${y}`}
                className={cn("arc-draw fill-none", c.hub ? "stroke-primary/50" : "stroke-foreground/15")}
                strokeWidth={c.hub ? 1 : 0.7}
                style={{ animationDelay: `${i * 60}ms` }}
              />
            );
          })}
        {indiaCities.map((c) => {
          const [x, y] = project(c.at[0], c.at[1], box, W, H);
          return (
            <g key={c.name}>
              {c.hub && <circle cx={x} cy={y} r={3} className="pulse-ring fill-primary/40" />}
              <circle cx={x} cy={y} r={c.hub ? 3.5 : 2.2} className={c.hub ? "fill-primary" : "fill-foreground/60"} />
              {c.hub && (
                <text x={x + 8} y={y + 3.5} className="fill-foreground/80 text-[11px] font-medium">
                  {c.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function WorldNetwork() {
  const { ref, inView } = useInView<HTMLDivElement>(0.25);
  const W = 1000, H = 480;
  const box: [number, number, number, number] = [-100, 170, -45, 65];
  const india = project(77.2, 22, box, W, H);
  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="DC Cabs international destination network">
        <defs>
          <pattern id="wdots" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.9" className="fill-foreground/[0.07]" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#wdots)" />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={0} x2={W} y1={(H / 4) * i + H / 8} y2={(H / 4) * i + H / 8} className="stroke-foreground/5" />
        ))}
        {inView &&
          worldDestinations.map((d, i) => {
            const [x, y] = project(d.at[0], d.at[1], box, W, H);
            const lift = Math.min(160, Math.abs(x - india[0]) * 0.35 + 30);
            return (
              <path
                key={d.name}
                d={`M${india[0]},${india[1]} Q${(india[0] + x) / 2},${Math.min(india[1], y) - lift} ${x},${y}`}
                className="arc-draw fill-none stroke-primary/45"
                strokeWidth={1}
                style={{ animationDelay: `${i * 90}ms` }}
              />
            );
          })}
        {worldDestinations.map((d, i) => {
          const [x, y] = project(d.at[0], d.at[1], box, W, H);
          const left = ["Spain", "France", "USA", "Abu Dhabi", "South Africa", "Germany"].includes(d.name);
          const below = ["Abu Dhabi", "Switzerland", "Poland"].includes(d.name);
          return (
            <g key={d.name} className={cn("transition-opacity duration-700", inView ? "opacity-100" : "opacity-0")} style={{ transitionDelay: `${800 + i * 90}ms` }}>
              <circle cx={x} cy={y} r={3} className="fill-foreground" />
              <text x={left ? x - 7 : x + 7} y={below ? y + 14 : y - 6} textAnchor={left ? "end" : "start"} className="fill-foreground/70 text-[12px]">
                {d.name}
              </text>
            </g>
          );
        })}
        <circle cx={india[0]} cy={india[1]} r={4} className="pulse-ring fill-primary/50" />
        <circle cx={india[0]} cy={india[1]} r={7} className="fill-primary" />
        <text x={india[0] + 12} y={india[1] + 22} className="fill-foreground text-[15px] font-bold tracking-[0.2em]">INDIA</text>
      </svg>
    </div>
  );
}

export function Differentiators() {
  return (
    <div className="grid border-t border-border md:grid-cols-2">
      {differentiators.map((d, i) => (
        <Reveal key={d.title} delay={i * 100} className={cn("border-b border-border py-10 md:py-14", i % 2 === 0 ? "md:pr-12" : "md:border-l md:pl-12")}>
          <p className="font-display text-6xl font-bold text-primary/80 md:text-7xl">0{i + 1}</p>
          <h3 className="font-display mt-6 text-2xl font-bold uppercase md:text-3xl">{d.title}</h3>
          <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">{d.body}</p>
        </Reveal>
      ))}
    </div>
  );
}

export function RegionGrid() {
  const withImg = regions.filter((r) => r.image);
  const rest = regions.filter((r) => !r.image);
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {withImg.map((r, i) => (
          <Reveal key={r.name} delay={(i % 2) * 120} className={cn("group relative overflow-hidden", i === 0 ? "md:col-span-2 aspect-[16/9] md:aspect-[21/9]" : "aspect-[4/3]")}>
            <img src={r.image} alt={r.name} loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-[1400ms] group-hover:scale-105" />
            <div className="bg-scrim absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
              <h3 className="font-display text-4xl font-bold uppercase md:text-6xl">{r.name}</h3>
              <p className="mt-3 text-sm text-foreground/75 md:text-base">{r.places.join(" · ")}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <div className="mt-4 grid gap-px bg-border md:grid-cols-3">
        {rest.map((r) => (
          <div key={r.name} className="bg-background p-8">
            <p className="eyebrow">{r.name}</p>
            <p className="font-display mt-4 text-3xl font-bold uppercase">{r.places.join(" · ")}</p>
          </div>
        ))}
      </div>
    </>
  );
}

export function FleetPreview() {
  return (
    <>
      <div className="grid gap-x-6 gap-y-14 md:grid-cols-2">
        {fleet.map((c, i) => (
          <VehicleCard key={c.id} cat={c} index={i} />
        ))}
      </div>
      <div className="mt-16 flex justify-center">
        <CTALink to="/fleet" variant="outline">View complete fleet</CTALink>
      </div>
    </>
  );
}
