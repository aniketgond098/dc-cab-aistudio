import { ArrowUpRight, Briefcase, Check, Users } from "lucide-react";
import sedan from "@/assets/fleet-sedan.jpg";
import suv from "@/assets/fleet-suv.jpg";
import luxury from "@/assets/fleet-luxury.jpg";
import coach from "@/assets/fleet-coach.jpg";

export type Category = {
  id: string;
  code: string;
  name: string;
  passenger_capacity: number;
  luggage_capacity: number | null;
};

function categoryImage(name: string) {
  const value = name.toLowerCase();
  if (/coach|bus|group/.test(value)) return coach;
  if (/luxury|premium|executive/.test(value)) return luxury;
  if (/suv|muv/.test(value)) return suv;
  return sedan;
}

export function VehicleCategoryCard({
  category,
  selected,
  onSelect,
}: {
  category: Category;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`group flex h-full w-full flex-col overflow-hidden border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected ? "border-primary bg-surface" : "border-border bg-charcoal hover:border-foreground/40"}`}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        <img
          src={categoryImage(category.name)}
          alt=""
          className="size-full object-cover opacity-75 transition duration-700 group-hover:scale-105 group-hover:opacity-90"
          loading="lazy"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
        <span className="eyebrow absolute bottom-4 left-4 text-foreground/90">
          Chauffeur category
        </span>
        <span
          className="absolute right-3 top-3 grid size-8 place-items-center border border-hairline bg-background"
          aria-hidden="true"
        >
          {selected ? (
            <Check className="size-4 text-primary-tint" />
          ) : (
            <ArrowUpRight className="size-4" />
          )}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-2xl font-bold uppercase">{category.name}</h3>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="size-4" /> Up to {category.passenger_capacity} passengers
          </span>
          {category.luggage_capacity !== null && (
            <span className="inline-flex items-center gap-1">
              <Briefcase className="size-4" /> {category.luggage_capacity} luggage
            </span>
          )}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          A dedicated chauffeur-driven category selected from the DC Cabs fleet catalog.
        </p>
        <span className="mt-auto pt-5 text-xs">{selected ? "Selected" : "Select category"}</span>
      </div>
    </button>
  );
}
