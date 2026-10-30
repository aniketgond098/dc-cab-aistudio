import { useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { contact, requirementTypes, whatsappWith } from "@/content/site";
import { cn } from "@/lib/utils";
import { btn } from "./ui";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  company: z.string().trim().max(120).optional(),
  email: z.string().trim().email("Please enter a valid email").max(255),
  phone: z.string().trim().min(6, "Please enter a phone number").max(25),
  type: z.string().min(1, "Please choose a requirement"),
  route: z.string().trim().max(200).optional(),
  date: z.string().max(20).optional(),
  travelers: z.string().max(6).optional(),
  message: z.string().trim().max(1500).optional(),
});

const field =
  "w-full border-0 border-b border-hairline bg-transparent px-0 py-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-0";

function F({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="eyebrow">{label}</span>
      {children}
      {error && <span className="mt-2 block text-sm text-destructive">{error}</span>}
    </label>
  );
}

export function ContactForm({
  defaultType = "",
  defaultRoute = "",
  defaultDate = "",
  defaultTravelers = "",
  defaultMessage = "",
}: {
  defaultType?: string;
  defaultRoute?: string;
  defaultDate?: string;
  defaultTravelers?: string;
  defaultMessage?: string;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<string | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const r = schema.safeParse(data);
    if (!r.success) {
      const errs: Record<string, string> = {};
      r.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    const v = r.data;
    const text = [
      `New enquiry — DC Cabs`,
      `Name: ${v.name}`,
      v.company && `Company: ${v.company}`,
      `Email: ${v.email}`,
      `Phone: ${v.phone}`,
      `Requirement: ${v.type}`,
      v.route && `Pickup / Destination: ${v.route}`,
      v.date && `Travel date: ${v.date}`,
      v.travelers && `Travelers: ${v.travelers}`,
      v.message && `Message: ${v.message}`,
    ]
      .filter(Boolean)
      .join("\n");
    setSent(text);
    window.open(whatsappWith(text), "_blank", "noopener");
  };

  if (sent) {
    return (
      <div className="border border-hairline p-8 md:p-12">
        <p className="eyebrow text-primary-tint">Enquiry ready</p>
        <h3 className="font-display mt-4 text-4xl font-bold uppercase">Thank you.</h3>
        <p className="mt-4 max-w-md text-muted-foreground">
          We've opened WhatsApp with your enquiry filled in — just press send. Prefer email? Send
          the same details to our bookings desk.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <a href={whatsappWith(sent)} target="_blank" rel="noreferrer" className={btn.primary}>
            Open WhatsApp again
          </a>
          <a
            href={`mailto:${contact.email}?subject=${encodeURIComponent("Enquiry — DC Cabs")}&body=${encodeURIComponent(sent)}`}
            className={btn.outline}
          >
            Send by email
          </a>
        </div>
        <button
          type="button"
          onClick={() => setSent(null)}
          className="mt-8 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Start a new enquiry
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
      <F error={errors["name"]} label="Name *">
        <input name="name" autoComplete="name" className={field} placeholder="Your full name" />
      </F>
      <F error={errors["company"]} label="Company">
        <input
          name="company"
          autoComplete="organization"
          className={field}
          placeholder="Company / agency"
        />
      </F>
      <F error={errors["email"]} label="Email *">
        <input
          name="email"
          type="email"
          autoComplete="email"
          className={field}
          placeholder="you@company.com"
        />
      </F>
      <F error={errors["phone"]} label="Phone *">
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          className={field}
          placeholder="+91 / international"
        />
      </F>
      <F error={errors["type"]} label="Requirement type *" className="sm:col-span-2">
        <select
          name="type"
          defaultValue={requirementTypes.includes(defaultType) ? defaultType : ""}
          className={cn(field, "bg-background")}
        >
          <option value="" disabled>
            Select a requirement
          </option>
          {requirementTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </F>
      <F error={errors["route"]} label="Pickup / Destination" className="sm:col-span-2">
        <input
          name="route"
          defaultValue={defaultRoute}
          className={field}
          placeholder="e.g. Delhi airport → Agra → Jaipur, or Dubai"
        />
      </F>
      <F error={errors["date"]} label="Travel date">
        <input
          name="date"
          defaultValue={defaultDate}
          type="date"
          className={cn(field, "[color-scheme:dark]")}
        />
      </F>
      <F error={errors["travelers"]} label="Number of travelers">
        <input
          name="travelers"
          defaultValue={defaultTravelers}
          type="number"
          min={1}
          inputMode="numeric"
          className={field}
          placeholder="e.g. 12"
        />
      </F>
      <F error={errors["message"]} label="Message" className="sm:col-span-2">
        <textarea
          name="message"
          defaultValue={defaultMessage}
          rows={4}
          className={cn(field, "resize-none")}
          placeholder="Tell us about the journey, guests and any special requirements"
        />
      </F>
      <div className="sm:col-span-2">
        <button type="submit" className={cn(btn.primary, "w-full sm:w-auto")}>
          Send enquiry
        </button>
        <p className="mt-4 text-xs text-muted-foreground">
          Your enquiry opens in WhatsApp, addressed to our operations & sales team.
        </p>
      </div>
    </form>
  );
}
