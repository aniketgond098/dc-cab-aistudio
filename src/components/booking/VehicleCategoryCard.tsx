import { ArrowUpRight, Briefcase, Check, Users } from "lucide-react";
import fallbackSedan from "@/assets/fleet-sedan.jpg";
import fallbackSuv from "@/assets/fleet-suv.jpg";
import fallbackLuxury from "@/assets/fleet-luxury.jpg";
import fallbackCoach from "@/assets/fleet-coach.jpg";

import dzireImg from "@/assets/images/mumbai_sedan_dzire_1793629725655.jpg";
import ertigaImg from "@/assets/images/mumbai_suv_ertiga_1793629726349.jpg";
import crystaImg from "@/assets/images/mumbai_innova_crysta_1793629725904.jpg";
import hycrossImg from "@/assets/images/mumbai_innova_hycross_1793629726794.jpg";
import fortunerImg from "@/assets/images/mumbai_exclusive_fortuner_1793629727557.jpg";
import camryImg from "@/assets/images/mumbai_camry_sedan_1793629728073.jpg";
import mercedesImg from "@/assets/images/mumbai_luxury_mercedes_1793629728611.jpg";
import vellfireImg from "@/assets/images/mumbai_luxury_vellfire_1793629728585.jpg";
import urbaniaImg from "@/assets/images/mumbai_urbania_coach_1793629729539.jpg";

export type Category = {
  id: string;
  code: string;
  name: string;
  passenger_capacity: number;
  luggage_capacity: number | null;
  models?: string[];
  pricing_type?: "fixed" | "price_on_request";
  display_order?: number;
  is_active?: boolean;
};

export function categoryImage(category: Category): string {
  const code = (category.code || "").toUpperCase();
  const name = category.name.toLowerCase();
  const models = (category.models || []).join(" ").toLowerCase();
  const text = `${name} ${models}`;

  // 1. Dedicated vehicle category matches
  if (code === "MUMBAI_HYCROSS_INVICTO" || /hycross|invicto/.test(text)) {
    return hycrossImg;
  }
  if (code === "MUMBAI_PREMIUM_SUV" || /crysta/.test(text)) {
    return crystaImg;
  }
  if (code === "MUMBAI_EXCLUSIVE_SUV" || /fortuner|carnival/.test(text)) {
    return fortunerImg;
  }
  if (code === "MUMBAI_LUXURY_VAN" || /vellfire|v-class|gle 350|luxury van/.test(text)) {
    return vellfireImg;
  }
  if (code === "MUMBAI_PREMIUM_SEDAN" || /camry/.test(text)) {
    return camryImg;
  }
  if (code === "MUMBAI_LUXURY_SEDAN" || /bmw|audi|mercedes|luxury sedan/.test(text)) {
    return mercedesImg;
  }
  if (code === "MUMBAI_GROUP_COACH" || /urbania|bharatbenz|volvo|coach|bus|group/.test(text)) {
    return urbaniaImg;
  }
  if (code === "MUMBAI_SUV" || /ertiga|rumion/.test(text)) {
    return ertigaImg;
  }
  if (code === "MUMBAI_SEDAN" || /dzire|alma/.test(text)) {
    return dzireImg;
  }

  // Fallbacks for general/non-Mumbai categories
  if (/coach|bus|group/.test(text)) return fallbackCoach;
  if (/luxury|premium|executive/.test(text)) return fallbackLuxury;
  if (/suv|muv/.test(text)) return fallbackSuv;
  return fallbackSedan;
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
  const isPriceOnRequest = category.pricing_type === "price_on_request";

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`group flex h-full w-full flex-col overflow-hidden border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected ? "border-primary bg-surface" : "border-border bg-charcoal hover:border-foreground/40"}`}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        <img
          src={categoryImage(category)}
          alt={category.name}
          referrerPolicy="no-referrer"
          className="size-full object-cover opacity-85 transition duration-700 group-hover:scale-105 group-hover:opacity-100"
          loading="lazy"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
        <span className="eyebrow absolute bottom-4 left-4 text-foreground/90">
          Chauffeur category
        </span>
        {isPriceOnRequest ? (
          <span className="absolute top-3 left-3 border border-primary/60 bg-background/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            Price on Request
          </span>
        ) : null}
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
        {category.models && category.models.length > 0 ? (
          <p className="mt-1.5 text-xs font-medium text-foreground/90">
            {category.models.join(" · ")}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="size-4" /> Up to {category.passenger_capacity} passengers
          </span>
          {category.luggage_capacity !== null && (
            <span className="inline-flex items-center gap-1">
              <Briefcase className="size-4" /> {category.luggage_capacity} luggage
            </span>
          )}
          {isPriceOnRequest ? (
            <span className="border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-tint">
              Custom Quote
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Fixed Rate Card
            </span>
          )}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {isPriceOnRequest
            ? "Specialized high-capacity or luxury vehicle with tailored quotation from DC Cabs."
            : "Chauffeur-driven category configured with standard server rate card pricing."}
        </p>
        <span className="mt-auto pt-5 text-xs font-semibold">
          {selected
            ? "Selected"
            : isPriceOnRequest
              ? "Select for quotation"
              : "Select category"}
        </span>
      </div>
    </button>
  );
}
