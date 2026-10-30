import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ContactForm } from "@/components/site/ContactForm";
import { Reveal } from "@/components/site/Reveal";
import { btn } from "@/components/site/ui";
import { contact } from "@/content/site";

export const Route = createFileRoute("/contact")({
  validateSearch: z.object({
    type: z.string().optional(),
    vehicle: z.string().optional(),
    route: z.string().optional(),
    date: z.string().optional(),
    travelers: z.string().optional(),
    message: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Contact & Partner With Us | DC Cabs" },
      {
        name: "description",
        content:
          "Partner with DC Cabs for customized mobility and travel solutions across India and international destinations. Call, WhatsApp or send an enquiry.",
      },
      { property: "og:title", content: "Let's move your clients — DC Cabs" },
      {
        property: "og:description",
        content: "Enquire about corporate mobility, tours and B2B partnerships.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { type, vehicle, route, date, travelers, message } = Route.useSearch();
  return (
    <section className="pb-24 pt-36 md:pb-36 md:pt-48">
      <div className="container-x">
        <Reveal>
          <p className="eyebrow mb-6 flex items-center gap-3">
            <span className="h-px w-8 bg-primary" /> Contact / Partner with us
          </p>
          <h1 className="font-display text-[clamp(3rem,9vw,8rem)] font-extrabold uppercase">
            Let's move <br />
            <span className="text-foreground/40">your clients.</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg text-muted-foreground">
            Partner with DC Cabs for customized mobility and travel solutions across India and
            international destinations.
          </p>
        </Reveal>

        <div className="mt-20 grid gap-16 lg:grid-cols-[1.5fr_1fr] lg:gap-24">
          <Reveal delay={100}>
            {vehicle && (
              <p className="mb-8 border-l-2 border-primary pl-4 text-sm text-muted-foreground">
                Enquiring about: <span className="text-foreground">{vehicle}</span>
              </p>
            )}
            <ContactForm
              key={`${type ?? ""}-${route ?? ""}`}
              defaultType={type ?? ""}
              defaultRoute={route ?? ""}
              defaultDate={date ?? ""}
              defaultTravelers={travelers ?? ""}
              defaultMessage={message ?? ""}
            />
          </Reveal>

          <Reveal delay={200} as="aside" className="lg:sticky lg:top-28 lg:self-start">
            <div className="border border-hairline p-8">
              <p className="eyebrow">Direct line</p>
              <p className="font-display mt-4 text-3xl font-bold uppercase">{contact.person}</p>
              <p className="text-sm text-muted-foreground">{contact.role}</p>
              <dl className="mt-8 space-y-5 text-sm">
                <div>
                  <dt className="eyebrow">Phone / WhatsApp</dt>
                  <dd className="mt-1 text-lg">
                    <a href={contact.phoneHref} className="hover:text-primary">
                      {contact.phoneDisplay}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Email</dt>
                  <dd className="mt-1 text-lg">
                    <a href={`mailto:${contact.email}`} className="hover:text-primary">
                      {contact.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Website</dt>
                  <dd className="mt-1 text-lg">{contact.website}</dd>
                </div>
              </dl>
              <div className="mt-10 grid gap-3">
                <a
                  href={contact.whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className={btn.primary}
                >
                  Chat on WhatsApp
                </a>
                <a href={contact.phoneHref} className={btn.outline}>
                  Call us
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
