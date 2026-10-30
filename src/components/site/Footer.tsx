import { Link } from "@tanstack/react-router";
import { contact, footerDestinations, nav } from "@/content/site";
import { Logo } from "./Navbar";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container-x grid gap-14 py-20 md:grid-cols-12">
        <div className="md:col-span-5">
          <Logo className="w-52" />
          <p className="font-display mt-6 max-w-sm text-2xl font-bold uppercase">
            Pan-India & International <br />
            <span className="text-muted-foreground">Corporate Mobility & Travel Solutions</span>
          </p>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">{footerDestinations}</p>
        </div>

        <div className="md:col-span-3">
          <p className="eyebrow mb-5">Explore</p>
          <ul className="space-y-3 text-sm">
            {nav.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className="text-foreground/75 transition-colors hover:text-primary">{n.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-4">
          <p className="eyebrow mb-5">Contact</p>
          <ul className="space-y-3 text-sm">
            <li className="text-foreground">{contact.person}<span className="block text-muted-foreground">{contact.role}</span></li>
            <li><a href={contact.phoneHref} className="text-foreground/75 hover:text-primary">{contact.phoneDisplay}</a></li>
            <li><a href={contact.whatsappHref} target="_blank" rel="noreferrer" className="text-foreground/75 hover:text-primary">WhatsApp</a></li>
            <li><a href={`mailto:${contact.email}`} className="text-foreground/75 hover:text-primary">{contact.email}</a></li>
            <li className="text-foreground/75">45+ cities across India</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-x flex flex-col justify-between gap-2 py-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} DC Cabs. All rights reserved.</p>
          <p>{contact.website}</p>
        </div>
      </div>
    </footer>
  );
}

export function WhatsAppFab() {
  return (
    <a
      href={contact.whatsappHref}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with DC Cabs on WhatsApp"
      className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-whatsapp text-foreground shadow-2xl transition-transform duration-300 hover:scale-105"
    >
      <svg viewBox="0 0 24 24" className="size-7 fill-current" aria-hidden>
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.47 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.01c0-5.2 4.23-9.43 9.43-9.43a9.37 9.37 0 0 1 9.43 9.44c0 5.2-4.24 9.42-9.44 9.42m8.02-17.44A11.27 11.27 0 0 0 12.05.75C5.8.75.72 5.83.72 12.08c0 2 .52 3.95 1.52 5.66L.62 23.25l5.65-1.48a11.3 11.3 0 0 0 5.78 1.47c6.25 0 11.33-5.08 11.33-11.33 0-3.03-1.18-5.87-3.32-8.01" />
      </svg>
    </a>
  );
}
