import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export function BookingButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      {...props}
      className={cn(
        "min-h-12 h-auto whitespace-normal rounded-sm px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em]",
        className,
      )}
    />
  );
}
