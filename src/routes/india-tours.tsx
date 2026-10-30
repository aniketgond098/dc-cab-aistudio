import { createFileRoute } from "@tanstack/react-router";
import taj from "@/assets/tour-taj.jpg";
import { Reveal } from "@/components/site/Reveal";
import { ClosingCTA, CTALink, PageHero } from "@/components/site/ui";
import { tours } from "@/content/site";
import { IndiaNetwork } from "@/components/site/sections";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/india-tours")({
  head: () => ({
    meta: [
      { title: "India Tours — Golden Triangle & Custom Itineraries | DC Cabs" },
      { name: "description", content: "Tailor-made Golden Triangle, leisure, corporate retreat and holiday itineraries across India, with chauffeur-driven travel throughout." },
      { property: "og:title", content: "Discover India with DC Cabs" },
      { property: "og:description", content: "Customized India tour packages for international guests and corporate groups." },
    ],
  }),
  component: Tours,
});

function Tours() {
  return (
    <>
      <PageHero eyebrow="India tours" title={<>Discover India. <br /><span className="text-foreground/40">We'll handle the journey.</span></>} intro="End-to-end, tailor-made itineraries designed to showcase the best of India to international guests." image={taj}>
        <CTALink to="/contact" search={{ type: "India Tour Package" }}>Plan your tour</CTALink>
      </PageHero>

      {tours.map((t, i) => (
        <section key={t.title} className="border-b border-border">
          <div className={cn("grid lg:grid-cols-2", i % 2 === 1 && "lg:[&>*:first-child]:order-2")}>
            <div className="group relative aspect-[4/3] overflow-hidden lg:aspect-auto lg:min-h-[80vh]">
              {t.image ? (
                <img src={t.image} alt={t.title} loading={i ? "lazy" : "eager"} className="absolute inset-0 size-full object-cover transition-transform duration-[1600ms] group-hover:scale-105" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-charcoal p-8"><div className="w-full max-w-md"><IndiaNetwork /></div></div>
              )}
            </div>
            <div className="flex items-center px-5 py-16 md:px-16 lg:px-24">
              <Reveal>
                <p className="eyebrow">Experience 0{i + 1}</p>
                <h2 className="font-display mt-6 text-5xl font-bold uppercase md:text-7xl">{t.title}</h2>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">{t.body}</p>
                <CTALink to="/contact" search={{ type: "India Tour Package" }} variant="ghost" className="mt-8">Design this journey</CTALink>
              </Reveal>
            </div>
          </div>
        </section>
      ))}

      <ClosingCTA title={<>India, <br /><span className="text-foreground/40">your way.</span></>} body="Share your dates, cities and guest profile. We'll shape the itinerary and handle every transfer along the way." />
    </>
  );
}
