export type BookableJourneyLocation = {
  id?: string;
  bookable: boolean;
};

export function canContinueJourney({
  pickup,
  destination,
  pickupAt,
  categoriesError,
}: {
  pickup: BookableJourneyLocation | null;
  destination: BookableJourneyLocation | null;
  pickupAt: string;
  categoriesError: string;
}): boolean {
  return Boolean(
    pickup?.id &&
    pickup.bookable &&
    destination?.id &&
    destination.bookable &&
    pickupAt &&
    Date.parse(pickupAt) > Date.now() &&
    !categoriesError,
  );
}
