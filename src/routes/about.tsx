import { createFileRoute } from "@tanstack/react-router";
import hero from "@/assets/hero.jpg";
import { JourneyTrace } from "@/components/site/JourneyTrace";
import { Reveal } from "@/components/site/Reveal";
import { ClosingCTA, PageHero, SectionHeading } from "@/components/site/ui";
import { Differentiators, IndiaNetwork, StatsSection } from "@/components/site/sections";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About DC Cabs — Pan-India & International Mobility Partner" },
      { name: "description", content: "DC Cabs is a pan-India and international corporate mobility and travel solutions provider serving 45+ Indian cities and key global destinations." },
      { property: "og:title", content: "About DC Cabs" },
      { property: "og:description", content: "A Pan-India & International mobility partner for travelers, corporates and global travel partners." },
    ],
  }),
  component: About,
});

const pillars = [
  { k: "Pan-India presence", v: "Ground transportation across 45+ major Indian cities." },
  { k: "International network", v: "Mobility solutions in key international destinations." },
  { k: "Corporate mobility", v: "Airport transfers, executive and daily corporate travel." },
  { k: "International travelers", v: "Chauffeurs skilled in caring for overseas guests." },
  { k: "Verified chauffeurs", v: "Trained, uniformed, English-speaking, background-checked." },
  { k: "Tech-enabled fleet", v: "GPS, real-time dispatch, 24/7 support, automated billing." },
];

function About() {
  return (
    <>
      <PageHero eyebrow="About DC Cabs" title={<>45+ cities. <br /><span className="text-foreground/40">One mobility partner.</span></>} intro="A Pan-India & International mobility partner, delivering seamless ground transportation and customized travel for international travelers, corporates and global travel partners." image={hero} />
      <StatsSection />
      <section className="py-24 md:py-36">
        <div className="container-x grid items-center gap-16 lg:grid-cols-2">
          <Reveal className="aspect-[4/5]">
            <JourneyTrace />
          </Reveal>
          <div>
            <SectionHeading
              eyebrow="Our role"
              title="Your trusted in-destination partner."
              intro="Whether you need executive airport transfers, chauffeur-driven luxury fleets, or complete sightseeing and tour itineraries for your clients, DC Cabs serves as a high-reliability partner — across India and in key international destinations."
            />
            <dl className="mt-12 grid gap-px bg-border sm:grid-cols-2">
              {pillars.map((p) => (
                <div key={p.k} className="bg-background py-6 pr-6">
                  <dt className="font-semibold text-foreground">{p.k}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{p.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
      <section className="border-t border-border bg-charcoal py-24 md:py-36">
        <div className="container-x grid items-center gap-16 lg:grid-cols-2">
          <SectionHeading eyebrow="Coverage" title={<>A network built <br />city by city.</>} intro="Key hubs including Delhi (NCR), Mumbai, Bengaluru, Jaipur, Agra, Goa, Kerala and Hyderabad — and an extended network of 45+ locations." />
          <Reveal><IndiaNetwork /></Reveal>
        </div>
      </section>
      <section className="py-24 md:py-36">
        <div className="container-x">
          <SectionHeading eyebrow="What sets us apart" title="Four commitments." className="mb-16" />
          <Differentiators />
        </div>
      </section>
      <ClosingCTA />
    </>
  );
}
