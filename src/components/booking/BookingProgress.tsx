import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { BookingButton } from "./BookingButton";

export function BookingProgress({
  step,
  onStep,
}: {
  step: number;
  onStep: (step: number) => void;
}) {
  const bookingSteps = [
    "Route & schedule",
    "Vehicle",
    "Fare",
    "Guest details",
    "Review",
    "Payment",
  ];

  return (
    <nav aria-label="Booking progress" className="mb-10 border-y border-border py-5">
      <ol className="grid grid-cols-3 gap-x-4 gap-y-5 md:grid-cols-6">
        {bookingSteps.map((label, index) => (
          <li key={label}>
            <BookingButton
              type="button"
              variant="ghost"
              disabled={index > step}
              aria-current={index === step ? "step" : undefined}
              onClick={() => onStep(index)}
              className={cn(
                "w-full justify-start gap-2 rounded-none p-0 text-left hover:bg-transparent hover:text-primary-tint",
                index === step ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center border text-[10px]",
                  index === step && "border-primary bg-primary text-primary-foreground",
                  index < step && "border-primary text-primary-tint",
                )}
              >
                {index < step ? <Check className="size-3" /> : `0${index + 1}`}
              </span>
              <span className="whitespace-normal text-[11px] leading-tight">{label}</span>
            </BookingButton>
          </li>
        ))}
      </ol>
    </nav>
  );
}
