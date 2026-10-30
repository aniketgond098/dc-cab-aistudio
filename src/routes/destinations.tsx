import { createFileRoute } from "@tanstack/react-router";
import dubai from "@/assets/dest-dubai.jpg";
import { Reveal } from "@/components/site/Reveal";
import { ClosingCTA, CTALink, PageHero, SectionHeading } from "@/components/site/ui";
import { RegionGrid, WorldNetwork } from "@/components/site/sections";

export const Route = createFileRoute("/destinations")({
  head: () => ({
    meta: [
      { title: "International Destinations — Wherever Business Takes You | DC Cabs" },
      { name: "description", content: "Mobility across India and international destinations including Dubai, Abu Dhabi, Europe, Thailand, Bali, USA, Australia, South Africa and Mauritius." },
      { property: "og:title", content: "DC Cabs International Destinations" },
      { property: "og:description", content: "One trusted mobility partner wherever your journey takes you." },
    ],
  }),
  component: Destinations,
});

function Destinations() {
  return (
    <>
      <PageHero
        eyebrow="Destinations"
        title={<>Wherever business <br /><span className="text-foreground/40">takes you.</span></>}
        intro="From the streets of Mumbai to the skylines of Dubai and the landscapes of Switzerland, DC Cabs helps coordinate seamless mobility across India and international destinations."
        image={dubai}
      >
        <CTALink to="/contact" search={{ type: "International Destination Mobility" }}>Plan international mobility</CTALink>
      </PageHero>

      <section className="py-24 md:py-36">
        <div className="container-x">
          <SectionHeading eyebrow="The network" title={<>Move beyond borders.</>} intro="Our mobility network extends across India and key international destinations." />
          <Reveal delay={100} className="mt-16 overflow-x-auto">
            <div className="min-w-[720px]"><WorldNetwork /></div>
          </Reveal>
        </div>
      </section>

      <section className="pb-24 md:pb-36">
        <div className="container-x">
          <RegionGrid />
        </div>
      </section>

      <ClosingCTA title={<>One partner. <br /><span className="text-foreground/40">Multiple destinations.</span></>} body="Whether your clients are traveling across India or exploring international destinations, DC Cabs provides a single point of coordination for ground mobility." />
    </>
  );
}
