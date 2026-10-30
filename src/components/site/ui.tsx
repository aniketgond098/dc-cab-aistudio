import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

const base =
  "group inline-flex min-h-12 items-center justify-center gap-3 px-6 text-[0.75rem] font-semibold uppercase tracking-[0.2em] transition-all duration-300";
export const btn = {
  primary: cn(base, "bg-primary text-primary-foreground hover:bg-foreground hover:text-background"),
  outline: cn(
    base,
    "border border-hairline text-foreground hover:border-foreground hover:bg-foreground hover:text-background",
  ),
  ghost: cn(base, "px-0 text-foreground hover:text-primary"),
};

type To =
  | "/"
  | "/book"
  | "/fleet"
  | "/corporate-mobility"
  | "/india-tours"
  | "/destinations"
  | "/about"
  | "/contact";

export function CTALink({
  to,
  children,
  variant = "primary",
  className,
  search,
}: {
  to: To;
  children: ReactNode;
  variant?: keyof typeof btn;
  className?: string;
  search?: Record<string, string>;
}) {
  return (
    <Link to={to} search={search as never} className={cn(btn[variant], className)}>
      {children}
      <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  className,
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <Reveal className={cn("max-w-4xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && (
        <p
          className={cn(
            "eyebrow mb-6 flex items-center gap-3",
            align === "center" && "justify-center",
          )}
        >
          <span className="h-px w-8 bg-primary" />
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-4xl font-bold uppercase sm:text-6xl lg:text-7xl">{title}</h2>
      {intro && (
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">{intro}</p>
      )}
    </Reveal>
  );
}

export function PageHero({
  eyebrow,
  title,
  intro,
  image,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  intro: string;
  image: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative flex min-h-[88svh] items-end overflow-hidden">
      <img
        src={image}
        alt=""
        className="animate-slow-zoom absolute inset-0 size-full object-cover"
      />
      <div className="bg-scrim absolute inset-0" />
      <div className="bg-scrim-side absolute inset-0" />
      <div className="container-x relative pb-16 pt-40 md:pb-24">
        <Reveal>
          <p className="eyebrow mb-6 flex items-center gap-3 text-foreground/80">
            <span className="h-px w-8 bg-primary" />
            {eyebrow}
          </p>
          <h1 className="font-display max-w-5xl text-5xl font-bold uppercase sm:text-7xl lg:text-8xl">
            {title}
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-foreground/75">{intro}</p>
          {children && <div className="mt-10 flex flex-wrap gap-4">{children}</div>}
        </Reveal>
      </div>
    </section>
  );
}

export function ClosingCTA({
  title = (
    <>
      Ready when <br /> your guests land.
    </>
  ),
  body = "Tell us the brief — cities, dates, guests. We'll coordinate the rest across India and key international destinations.",
}: {
  title?: ReactNode;
  body?: string;
}) {
  return (
    <section className="border-t border-border bg-charcoal py-24 md:py-36">
      <div className="container-x grid gap-12 md:grid-cols-[1.4fr_1fr] md:items-end">
        <Reveal>
          <h2 className="font-display text-5xl font-bold uppercase sm:text-7xl">{title}</h2>
        </Reveal>
        <Reveal delay={150}>
          <p className="text-lg leading-relaxed text-muted-foreground">{body}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <CTALink to="/book">Plan your journey</CTALink>
            <CTALink to="/contact" search={{ type: "B2B / DMC Partnership" }} variant="outline">
              Partner with us
            </CTALink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
