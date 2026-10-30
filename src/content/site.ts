import sedan from "@/assets/fleet-sedan.jpg";
import suv from "@/assets/fleet-suv.jpg";
import luxury from "@/assets/fleet-luxury.jpg";
import coach from "@/assets/fleet-coach.jpg";
import corporate from "@/assets/corporate.jpg";
import taj from "@/assets/tour-taj.jpg";
import kerala from "@/assets/tour-kerala.jpg";
import dubai from "@/assets/dest-dubai.jpg";
import europe from "@/assets/dest-europe.jpg";
import asia from "@/assets/dest-asia.jpg";
import hero from "@/assets/hero.jpg";

export const contact = {
  person: "Kunal Suri",
  role: "Manager – Operations & Sales",
  phoneDisplay: "+91 99871 17974",
  phoneHref: "tel:+919987117974",
  whatsappHref: "https://wa.me/919987117974",
  email: "bookings@dccab.in",
  website: "www.dccab.in",
};

export const whatsappWith = (text: string) =>
  `${contact.whatsappHref}?text=${encodeURIComponent(text)}`;

export const tagline = "Pan-India & International Corporate Mobility & Travel Solutions";

export const nav = [
  { to: "/", label: "Home" },
  { to: "/fleet", label: "Fleet" },
  { to: "/corporate-mobility", label: "Corporate Mobility" },
  { to: "/india-tours", label: "India Tours" },
  { to: "/destinations", label: "Destinations" },
  { to: "/book", label: "Book online" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export const stats = [
  { value: 45, suffix: "+", label: "Indian cities" },
  { text: "Global", label: "Destination network" },
  { text: "24/7", label: "Operations support" },
  { text: "Verified", label: "Chauffeurs" },
];

export const services: { title: string; body: string; image?: string }[] = [
  { title: "Executive Airport Transfers", body: "Met on arrival, moved without friction — punctual pickups timed to every flight.", },
  { title: "Chauffeur-Driven Mobility", body: "Trained, uniformed, English-speaking chauffeurs for every hour of the itinerary.", image: luxury },
  { title: "Corporate Travel", body: "Daily corporate movement and outstation travel, coordinated with real-time dispatch.", image: corporate },
  { title: "VIP & Luxury Transportation", body: "Premium sedans and SUVs for C-suite executives, dignitaries and high-profile guests.", image: hero },
  { title: "MICE & Delegation Mobility", body: "Group transfers, coaches and event logistics for conferences and delegations.", image: coach },
  { title: "Customized Tours", body: "Tailor-made India itineraries and international destination mobility, end to end.", image: taj },
];

export const fleet = [
  {
    id: "sedans",
    name: "Executive Sedans",
    models: ["Maruti Dzire", "Hyundai Aura", "Honda City", "Maruti Ciaz"],
    use: "Airport transfers, daily corporate travel, single-guest city travel",
    image: sedan,
  },
  {
    id: "suvs",
    name: "SUVs & MUVs",
    models: ["Toyota Innova Crysta", "Innova Hycross", "Maruti Ertiga", "Kia Carens"],
    use: "Delegation transfers, small family tours, outstation trips",
    image: suv,
  },
  {
    id: "luxury",
    name: "Premium & Luxury",
    models: ["Toyota Fortuner", "Camry Hybrid", "Mercedes E-Class", "BMW 5 Series"],
    use: "VIP airport transfers, C-suite executive travel, luxury tours",
    image: luxury,
  },
  {
    id: "groups",
    name: "Group & Coaches",
    models: ["Kia Carnival", "Force Urbania (17-Seater)", "Luxury Tourist Coaches"],
    use: "Corporate events, MICE delegations, group sightseeing tours",
    image: coach,
  },
];

export const keyHubs = [
  "Delhi (NCR)", "Mumbai", "Bengaluru", "Chennai", "Kolkata", "Hyderabad",
  "Pune", "Ahmedabad", "Jaipur", "Agra", "Goa", "Kochi / Kerala",
];

export const extendedNetwork = [
  "Surat", "Chandigarh", "Indore", "Lucknow", "Coimbatore", "Visakhapatnam",
  "Guwahati", "Jammu", "Srinagar", "Varanasi", "Amritsar", "Udaipur",
];

/** [lon, lat] for map plotting */
export const indiaCities: { name: string; at: [number, number]; hub?: boolean }[] = [
  { name: "Delhi", at: [77.2, 28.6], hub: true },
  { name: "Mumbai", at: [72.88, 19.08], hub: true },
  { name: "Bengaluru", at: [77.59, 12.97], hub: true },
  { name: "Chennai", at: [80.27, 13.08], hub: true },
  { name: "Kolkata", at: [88.36, 22.57], hub: true },
  { name: "Hyderabad", at: [78.49, 17.39], hub: true },
  { name: "Pune", at: [73.86, 18.52], hub: true },
  { name: "Ahmedabad", at: [72.57, 23.02], hub: true },
  { name: "Jaipur", at: [75.79, 26.91], hub: true },
  { name: "Agra", at: [78.01, 27.18], hub: true },
  { name: "Goa", at: [73.83, 15.49], hub: true },
  { name: "Kochi", at: [76.27, 9.93], hub: true },
  { name: "Surat", at: [72.83, 21.17] },
  { name: "Chandigarh", at: [76.78, 30.73] },
  { name: "Indore", at: [75.86, 22.72] },
  { name: "Lucknow", at: [80.95, 26.85] },
  { name: "Coimbatore", at: [76.96, 11.02] },
  { name: "Visakhapatnam", at: [83.3, 17.69] },
  { name: "Guwahati", at: [91.74, 26.14] },
  { name: "Jammu", at: [74.86, 32.73] },
  { name: "Srinagar", at: [74.8, 34.08] },
  { name: "Varanasi", at: [82.97, 25.32] },
  { name: "Amritsar", at: [74.87, 31.63] },
  { name: "Udaipur", at: [73.71, 24.58] },
];

export const worldDestinations: { name: string; at: [number, number] }[] = [
  { name: "Dubai", at: [55.27, 25.2] },
  { name: "Abu Dhabi", at: [54.37, 24.45] },
  { name: "Azerbaijan", at: [49.87, 40.41] },
  { name: "Thailand", at: [100.5, 13.75] },
  { name: "Bali", at: [115.19, -8.41] },
  { name: "USA", at: [-74, 40.7] },
  { name: "Germany", at: [13.4, 52.52] },
  { name: "Australia", at: [151.2, -33.87] },
  { name: "France", at: [2.35, 48.86] },
  { name: "Spain", at: [-3.7, 40.42] },
  { name: "Switzerland", at: [8.54, 47.37] },
  { name: "Russia", at: [37.62, 55.75] },
  { name: "Poland", at: [21.01, 52.23] },
  { name: "South Africa", at: [18.42, -33.92] },
  { name: "Sri Lanka", at: [79.86, 6.93] },
  { name: "Mauritius", at: [57.55, -20.16] },
];

export const regions = [
  { name: "India", places: ["45+ cities across the country"], image: taj },
  { name: "Middle East", places: ["Dubai", "Abu Dhabi"], image: dubai },
  { name: "Europe", places: ["Azerbaijan", "Germany", "France", "Spain", "Switzerland", "Russia", "Poland"], image: europe },
  { name: "Asia", places: ["Thailand", "Bali", "Sri Lanka"], image: asia },
  { name: "North America", places: ["USA"] },
  { name: "Oceania", places: ["Australia"] },
  { name: "Africa & Indian Ocean", places: ["South Africa", "Mauritius"] },
];

export const footerDestinations =
  "India · Dubai · Abu Dhabi · Azerbaijan · Thailand · Bali · USA · Germany · Australia · France · Spain · Switzerland · Russia · Poland · South Africa · Sri Lanka · Mauritius";

export const differentiators = [
  { title: "Custom India Tour Packages", body: "Tailor-made leisure, Golden Triangle, corporate retreats and holiday itineraries designed to showcase the best of India to international guests." },
  { title: "Pan-India Presence", body: "Seamless service across 45+ cities, including key hubs like Delhi (NCR), Mumbai, Bengaluru, Jaipur, Agra, Goa, Kerala and Hyderabad." },
  { title: "Specialized & Verified Chauffeurs", body: "Professionally trained, uniformed, English-speaking and background-checked chauffeurs skilled in handling international travelers with care." },
  { title: "Modern Tech-Enabled Fleet", body: "GPS tracking, 24/7 operations support, real-time dispatch and automated billing for punctual, transparent movements." },
];

export const tours: { title: string; body: string; image?: string }[] = [
  { title: "Golden Triangle", body: "Delhi, Agra and Jaipur — India's classic circuit, paced around your guests.", image: taj },
  { title: "Leisure Journeys", body: "Unhurried travel through coastlines, hill stations and backwaters.", image: kerala },
  { title: "Corporate Retreats", body: "Offsites and incentive travel with every transfer coordinated.", image: coach },
  { title: "Holiday Itineraries", body: "Family and group holidays shaped around the way you like to travel.", image: hero },
  { title: "Sightseeing", body: "City and heritage sightseeing with chauffeurs who know the route.", },
  { title: "Customized Itineraries", body: "Tell us the brief. We design the journey, end to end.", image: europe },
];

export const requirementTypes = [
  "Airport Transfer",
  "Corporate Travel",
  "VIP / Luxury Transportation",
  "MICE & Delegation",
  "India Tour Package",
  "International Destination Mobility",
  "B2B / DMC Partnership",
  "Other",
];
