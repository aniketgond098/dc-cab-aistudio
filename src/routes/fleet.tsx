import { createFileRoute } from "@tanstack/react-router";
import luxury from "@/assets/fleet-luxury.jpg";
import { Reveal } from "@/components/site/Reveal";
import { ClosingCTA, CTALink, PageHero } from "@/components/site/ui";
import { fleet } from "@/content/site";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fleet")({
  head: () => ({
    meta: [
      { title: "Fleet — Executive Sedans to Luxury Coaches | DC Cabs" },
      { name: "description", content: "Executive sedans, SUVs & MUVs, premium luxury cars and group coaches for corporate travel, VIP transfers and tours." },
      { property: "og:title", content: "The DC Cabs Fleet" },
      { property: "og:description", content: "Executive sedans, SUVs, premium luxury and group coaches — matched to every journey." },
    ],
  }),
  component: FleetPage,
});

function FleetPage() {
  return (
    <>
      <PageHero eyebrow="The collection" title={<>The fleet. <br /><span className="text-foreground/40">Matched to the moment.</span></>} intro="Four categories, one standard — from single-guest airport transfers to full MICE delegations." image={luxury} />
      <section className="py-16 md:py-24">
        {fleet.map((c, i) => (
          <article key={c.id} id={c.id} className="border-b border-border py-16 md:py-24">
            <div className={cn("container-x grid items-center gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-20", i % 2 === 1 && "lg:grid-cols-[1fr_1.4fr]")}>
              <Reveal className={cn("group overflow-hidden bg-charcoal", i % 2 === 1 && "lg:order-2")}>
                <img src={c.image} alt={c.name} loading={i ? "lazy" : "eager"} className="aspect-[16/10] w-full object-cover transition-transform duration-[1400ms] group-hover:scale-105" />
              </Reveal>
              <Reveal delay={150}>
                <p className="eyebrow">Category 0{i + 1}</p>
                <h2 className="font-display mt-4 text-5xl font-bold uppercase md:text-6xl">{c.name}</h2>
                <ul className="mt-8 border-t border-border">
                  {c.models.map((m) => (
                    <li key={m} className="border-b border-border py-3 text-lg">{m}</li>
                  ))}
                </ul>
                <p className="eyebrow mt-8 text-primary-tint">Ideal for</p>
                <p className="mt-2 text-muted-foreground">{c.use}</p>
                <CTALink to="/contact" search={{ type: "Other", vehicle: c.name }} variant="outline" className="mt-10">Enquire for this category</CTALink>
              </Reveal>
            </div>
          </article>
        ))}
      </section>
      <ClosingCTA />
    </>
  );
}
