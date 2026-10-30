import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "@/assets/dc-cabs-logo.png";
import { contact, nav } from "@/content/site";
import { cn } from "@/lib/utils";
import { btn } from "./ui";

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={logo}
      alt="DC Cabs"
      width={402}
      height={132}
      className={cn("h-auto w-full", className)}
    />
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <>
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        open ? "border-b border-border bg-background" : scrolled ? "border-b border-border bg-background/85 backdrop-blur-xl" : "bg-transparent",
      )}
    >
      <div className={cn("container-x flex items-center justify-between transition-all duration-500", scrolled ? "h-16" : "h-24")}>
        <Link to="/" aria-label="DC Cabs home" className={cn("block transition-all duration-500", scrolled ? "w-32" : "w-40 md:w-44")}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 xl:flex" aria-label="Main">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="relative text-[0.8rem] font-medium text-foreground/70 transition-colors hover:text-foreground data-[status=active]:text-foreground"
              activeProps={{ "data-status": "active" } as never}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/contact" search={{ type: "B2B / DMC Partnership" } as never} className={cn(btn.primary, "hidden min-h-10 sm:inline-flex")}>
            Partner with us
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="grid size-11 place-items-center border border-hairline xl:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

    </header>
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-[45] top-16 bg-background transition-all duration-500 xl:hidden",
          scrolled ? "top-16" : "top-24",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
      >
        <nav className="container-x flex h-full flex-col justify-between gap-10 overflow-y-auto py-8" aria-label="Mobile">
          <ul className="space-y-1">
            {nav.map((n, i) => (
              <li key={n.to} className={cn("transition-all duration-500", open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")} style={{ transitionDelay: `${i * 40}ms` }}>
                <Link to={n.to} className="font-display block py-2.5 text-3xl !leading-tight sm:text-4xl font-bold uppercase text-foreground/80 hover:text-primary">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3">
            <Link to="/contact" search={{ type: "B2B / DMC Partnership" } as never} className={btn.primary}>Partner with us</Link>
            <a href={contact.whatsappHref} target="_blank" rel="noreferrer" className={btn.outline}>Chat on WhatsApp</a>
          </div>
        </nav>
      </div>
    </>
  );
}
