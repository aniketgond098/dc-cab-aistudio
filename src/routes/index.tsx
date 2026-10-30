import { createFileRoute, Link } from "@tanstack/react-router";
import hero from "@/assets/hero.jpg";
import { JourneyTrace } from "@/components/site/JourneyTrace";
import { Reveal } from "@/components/site/Reveal";
import { ClosingCTA, CTALink, SectionHeading } from "@/components/site/ui";
import {
  Differentiators,
  FleetPreview,
  IndiaNetwork,
  ServiceList,
  StatsSection,
  WorldNetwork,
} from "@/components/site/sections";
import { extendedNetwork, keyHubs, tours } from "@/content/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DC Cabs — From India. To the World." },
      {
        name: "description",
        content:
          "Premium corporate mobility, chauffeur-driven transportation and customized travel across 45+ Indian cities and key international destinations.",
      },
      { property: "og:title", content: "DC Cabs — From India. To the World." },
      {
        property: "og:description",
        content:
          "Pan-India & international corporate mobility, chauffeur-driven travel and bespoke journeys.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <>
      {/* HERO */}
      <section className="relative flex min-h-svh items-end overflow-hidden">
        <img
          src={hero}
          alt="Black executive sedan on Mumbai's Marine Drive at dusk"
          width={1920}
          height={1088}
          className="animate-slow-zoom absolute inset-0 size-full object-cover object-[70%_center]"
        />
        <div className="bg-scrim absolute inset-0" />
        <div className="bg-scrim-side absolute inset-0" />
        <div className="container-x relative pb-16 pt-40 md:pb-24">
          <Reveal>
            <p className="eyebrow mb-8 flex items-center gap-3 text-foreground/80">
              <span className="h-px w-8 bg-primary" /> Pan-India & International Mobility
            </p>
            <h1 className="font-display text-[clamp(3.2rem,11vw,10rem)] font-extrabold uppercase">
              From India.
              <br />
              <span className="text-foreground/40">To the world.</span>
            </h1>
          </Reveal>
          <Reveal delay={200} className="mt-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <p className="max-w-lg text-lg leading-relaxed text-foreground/80">
              Premium corporate mobility, chauffeur-driven transportation and customized travel
              solutions across India and key international destinations.
            </p>
            <div className="flex flex-wrap gap-4">
              <CTALink to="/book">Plan your journey</CTALink>
              <CTALink to="/fleet" variant="outline">
                Explore our fleet
              </CTALink>
            </div>
          </Reveal>
        </div>
      </section>

      <StatsSection />

      {/* INTRO */}
      <section className="py-24 md:py-40">
        <div className="container-x grid items-center gap-14 lg:grid-cols-2 lg:gap-24">
          <div>
            <SectionHeading
              eyebrow="Who we are"
              title={
                <>
                  One mobility partner. <span className="text-foreground/40">Across India.</span>
                </>
              }
              intro="DC Cabs delivers reliable ground transportation and customized tour solutions across 45+ major Indian cities — and coordinates seamless mobility in key international destinations. Executive airport transfers, chauffeur-driven fleets and complete itineraries, managed by one trusted in-destination partner."
            />
            <Reveal delay={150} className="mt-10">
              <CTALink to="/about" variant="ghost">
                About DC Cabs
              </CTALink>
            </Reveal>
          </div>
          <Reveal delay={100} className="aspect-[4/5]">
            <JourneyTrace />
          </Reveal>
        </div>
      </section>

      {/* SERVICES */}
      <section className="border-t border-border bg-charcoal py-24 md:py-36">
        <div className="container-x">
          <SectionHeading
            eyebrow="Services"
            title={
              <>
                Every movement, <br />
                considered.
              </>
            }
            className="mb-16"
          />
          <ServiceList />
        </div>
      </section>

      {/* FLEET */}
      <section className="py-24 md:py-36">
        <div className="container-x">
          <div className="mb-16 flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <SectionHeading
              eyebrow="The fleet"
              title={
                <>
                  Chosen for <br />
                  the journey.
                </>
              }
            />
            <Reveal className="max-w-sm text-muted-foreground">
              From executive sedans to luxury coaches — a fleet matched to every guest, group and
              occasion.
            </Reveal>
          </div>
          <FleetPreview />
        </div>
      </section>

      {/* INDIA NETWORK */}
      <section className="border-t border-border bg-charcoal py-24 md:py-36">
        <div className="container-x grid items-center gap-16 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHeading
              eyebrow="Pan-India presence"
              title={
                <>
                  45+ cities. <span className="text-foreground/40">One connected network.</span>
                </>
              }
            />
            <Reveal delay={150} className="mt-12">
              <p className="eyebrow mb-4 text-primary-tint">Key service hubs</p>
              <p className="text-xl leading-relaxed text-foreground">{keyHubs.join(" · ")}</p>
              <p className="eyebrow mb-4 mt-10">Extended network</p>
              <p className="leading-relaxed text-muted-foreground">
                {extendedNetwork.join(" · ")} · +20 more locations
              </p>
            </Reveal>
          </div>
          <Reveal delay={100}>
            <IndiaNetwork />
          </Reveal>
        </div>
      </section>

      {/* WORLD */}
      <section className="py-24 md:py-36">
        <div className="container-x">
          <SectionHeading
            eyebrow="Global reach"
            title={
              <>
                India to <span className="text-primary">the world.</span>
              </>
            }
            intro="With a strong Pan-India presence and an expanding international mobility network, DC Cabs connects travelers, corporate teams and global travel partners with reliable ground transportation across key destinations."
          />
          <Reveal delay={100} className="mt-16 overflow-x-auto">
            <div className="min-w-[720px]">
              <WorldNetwork />
            </div>
          </Reveal>
          <Reveal className="mt-12">
            <CTALink to="/destinations" variant="outline">
              Explore destinations
            </CTALink>
          </Reveal>
        </div>
      </section>

      {/* WHY */}
      <section className="border-t border-border bg-charcoal py-24 md:py-36">
        <div className="container-x">
          <SectionHeading
            eyebrow="Why DC Cabs"
            title={
              <>
                Why partners <br />
                choose us.
              </>
            }
            className="mb-16"
          />
          <Differentiators />
        </div>
      </section>

      {/* TOURS */}
      <section className="py-24 md:py-36">
        <div className="container-x">
          <div className="mb-16 flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <SectionHeading
              eyebrow="India tours"
              title={
                <>
                  India, <br />
                  your way.
                </>
              }
            />
            <Reveal>
              <CTALink to="/india-tours">Design your journey</CTALink>
            </Reveal>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {tours.slice(0, 3).map((t, i) => (
              <Reveal key={t.title} delay={i * 100} className="group">
                <Link to="/india-tours" className="block">
                  <div className="aspect-[3/4] overflow-hidden">
                    <img
                      src={t.image ?? ""}
                      alt={t.title}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-[1400ms] group-hover:scale-105"
                    />
                  </div>
                  <h3 className="font-display mt-6 text-2xl font-bold uppercase">{t.title}</h3>
                  <p className="mt-2 text-muted-foreground">{t.body}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <ClosingCTA
        title={
          <>
            One partner. <br />
            <span className="text-foreground/40">Multiple destinations.</span>
          </>
        }
        body="Whether your clients are traveling across India or exploring international destinations, DC Cabs provides a single point of coordination for ground mobility and customized travel."
      />
    </>
  );
}
