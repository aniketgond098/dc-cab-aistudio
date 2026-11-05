import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Linkedin, MessageCircle, Phone } from "lucide-react";
import { z } from "zod";
import { ContactForm } from "@/components/site/ContactForm";
import { Reveal } from "@/components/site/Reveal";
import { leadershipContacts } from "@/content/site";

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
          "Partner with DC Cabs for customized mobility and travel solutions across India and international destinations. Direct phone and WhatsApp contacts for our leadership team.",
      },
      { property: "og:title", content: "Contact DC Cabs — Leadership & Operations" },
      {
        property: "og:description",
        content:
          "Direct mobile and WhatsApp lines for Suresh Mahto (Founder) and Kunal Suri (Co-Founder & Manager – Operations).",
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
            <div className="space-y-6">
              <div className="border-b border-border pb-3">
                <p className="eyebrow text-primary">Direct Contacts</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Connect directly with our leadership team for business enquiries, corporate
                  delegations, and operational assistance.
                </p>
              </div>

              {leadershipContacts.map((person) => (
                <div
                  key={person.name}
                  className="border border-border bg-charcoal/70 p-6 md:p-8 backdrop-blur-sm"
                >
                  <div className="border-b border-border/80 pb-4">
                    <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground md:text-3xl">
                      {person.name}
                    </h2>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-primary-tint">
                      {person.role}
                    </p>
                  </div>

                  <div className="mt-6 space-y-3.5">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      Phone &amp; WhatsApp
                    </p>
                    {person.phones.map((phone) => (
                      <div
                        key={phone.raw}
                        className="flex flex-col gap-3 border border-border/80 bg-background/60 p-3.5 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          {phone.allowCall !== false && phone.telHref ? (
                            <a
                              href={phone.telHref}
                              className="block font-sans text-base font-semibold tracking-wide text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                              aria-label={`Call ${person.name} at ${phone.display}`}
                            >
                              {phone.display}
                            </a>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span
                                className="block font-sans text-base font-semibold tracking-wide text-foreground"
                                aria-label={`${person.name}'s WhatsApp number ${phone.display}`}
                              >
                                {phone.display}
                              </span>
                              <span className="border border-emerald-500/30 bg-emerald-950/20 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-emerald-400">
                                WhatsApp
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {phone.allowCall !== false && phone.telHref ? (
                            <a
                              href={phone.telHref}
                              className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:border-foreground hover:bg-surface focus-visible:outline-none"
                              aria-label={`Call ${person.name} at ${phone.display}`}
                            >
                              <Phone className="size-3.5 text-primary" aria-hidden="true" />
                              <span>Call</span>
                            </a>
                          ) : null}
                          <a
                            href={phone.whatsappHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-950/25 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400 transition-colors hover:border-emerald-400 hover:bg-emerald-900/40 focus-visible:outline-none"
                            aria-label={`Open WhatsApp chat with ${person.name} at ${phone.display}`}
                          >
                            <MessageCircle className="size-3.5" aria-hidden="true" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>

                  {person.linkedin ? (
                    <div className="mt-6 border-t border-border/80 pt-4">
                      <a
                        href={person.linkedin.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:underline"
                        aria-label={`View ${person.name}'s LinkedIn profile`}
                      >
                        <Linkedin className="size-4 text-[#0a66c2]" aria-hidden="true" />
                        <span>{person.linkedin.label}</span>
                        <ExternalLink className="size-3 opacity-60" aria-hidden="true" />
                      </a>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
