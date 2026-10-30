import { createFileRoute } from "@tanstack/react-router";
import corporate from "@/assets/corporate.jpg";
import luxury from "@/assets/fleet-luxury.jpg";
import coach from "@/assets/fleet-coach.jpg";
import hero from "@/assets/hero.jpg";
import dubai from "@/assets/dest-dubai.jpg";
import suv from "@/assets/fleet-suv.jpg";
import europe from "@/assets/dest-europe.jpg";
import { Reveal } from "@/components/site/Reveal";
import { ClosingCTA, CTALink, PageHero, SectionHeading } from "@/components/site/ui";
import { Differentiators, ServiceList } from "@/components/site/sections";

export const Route = createFileRoute("/corporate-mobility")({
  head: () => ({
    meta: [
      { title: "Corporate Mobility — Global Mobility, Local Expertise | DC Cabs" },
      { name: "description", content: "Airport transfers, executive travel, VIP transportation, MICE and international destination mobility for businesses, DMCs and travel partners." },
      { property: "og:title", content: "Corporate Mobility by DC Cabs" },
      { property: "og:description", content: "Dependable ground transportation for businesses, travelers and global travel partners." },
    ],
  }),
  component: Corporate,
});

const corpServices: { title: string; body: string; image?: string }[] = [
  { title: "Airport Transfers", body: "Executive meet-and-greet pickups and drops, timed to every arrival.", },
  { title: "Executive Travel", body: "C-suite and senior leadership movement in premium sedans and SUVs.", image: luxury },
  { title: "Corporate Daily Mobility", body: "Daily employee and guest travel with real-time dispatch and automated billing.", image: corporate },
  { title: "VIP Transportation", body: "Discreet, punctual movement for dignitaries and high-profile guests.", image: hero },
  { title: "MICE & Delegation Travel", body: "Coaches, MUVs and coordinated transfers for conferences and incentive groups.", image: coach },
  { title: "Outstation Corporate Travel", body: "Intercity business travel across our 45+ city network.", image: suv },
  { title: "International Destination Mobility", body: "Ground mobility coordinated across key international destinations.", image: dubai },
  { title: "Customized Travel", body: "Retreats, offsites and bespoke itineraries for corporate teams.", image: europe },
];

const audiences = ["International Tour Operators", "DMCs", "Corporate Travel Departments", "Travel Management Companies", "Global Travel Partners", "MICE Organizers"];

function Corporate() {
  return (
    <>
      <PageHero
        eyebrow="Corporate mobility"
        title={<>Global mobility. <br /><span className="text-foreground/40">Local expertise.</span></>}
        intro="From Pan-India corporate transportation to international destination mobility, DC Cabs provides dependable ground transportation for businesses, travelers and global travel partners."
        image={corporate}
      >
        <CTALink to="/contact" search={{ type: "Corporate Travel" }}>Discuss your requirement</CTALink>
      </PageHero>

      <section className="py-24 md:py-36">
        <div className="container-x">
          <SectionHeading eyebrow="Capabilities" title={<>Built for business. <br /><span className="text-foreground/40">Driven by reliability.</span></>} className="mb-16" />
          <ServiceList items={corpServices} />
        </div>
      </section>

      <section className="border-t border-border bg-charcoal py-24 md:py-36">
        <div className="container-x grid gap-16 lg:grid-cols-2">
          <SectionHeading
            eyebrow="B2B partnerships"
            title={<>Built for international partners.</>}
            intro="A high-reliability in-destination partner for operators and travel teams moving guests through India and beyond — one point of coordination for ground mobility and customized travel."
          />
          <Reveal delay={150}>
            <ul className="border-t border-border">
              {audiences.map((a, i) => (
                <li key={a} className="flex items-baseline gap-6 border-b border-border py-6">
                  <span className="text-xs tabular-nums text-muted-foreground">0{i + 1}</span>
                  <span className="font-display text-2xl font-bold uppercase md:text-3xl">{a}</span>
                </li>
              ))}
            </ul>
            <CTALink to="/contact" search={{ type: "B2B / DMC Partnership" }} className="mt-10">Partner with DC Cabs</CTALink>
          </Reveal>
        </div>
      </section>

      <section className="py-24 md:py-36">
        <div className="container-x">
          <SectionHeading eyebrow="The standard" title="What every booking includes." className="mb-16" />
          <Differentiators />
        </div>
      </section>

      <ClosingCTA />
    </>
  );
}
