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

export type ContactPhone = {
  raw: string;
  display: string;
  telHref?: string;
  whatsappHref: string;
  allowCall?: boolean;
};

export type LeadershipContact = {
  name: string;
  role: string;
  phones: ContactPhone[];
  linkedin?: {
    href: string;
    label: string;
  };
};

export const leadershipContacts: LeadershipContact[] = [
  {
    name: "Kunal Suri",
    role: "Co-Founder & Manager – Operations",
    phones: [
      {
        raw: "+91 9987117974",
        display: "+91 99871 17974",
        telHref: "tel:+919987117974",
        whatsappHref: "https://wa.me/919987117974",
        allowCall: true,
      },
      {
        raw: "+91 8446173577",
        display: "+91 84461 73577",
        whatsappHref: "https://wa.me/918446173577",
        allowCall: false,
      },
    ],
    linkedin: {
      href: "https://linkedin.com/in/kunal-suri-569224408",
      label: "LinkedIn Profile",
    },
  },
  {
    name: "Suresh Mahto",
    role: "Founder",
    phones: [
      {
        raw: "+91 8779728005",
        display: "+91 87797 28005",
        telHref: "tel:+918779728005",
        whatsappHref: "https://wa.me/918779728005",
        allowCall: true,
      },
      {
        raw: "+91 9870821082",
        display: "+91 98708 21082",
        telHref: "tel:+919870821082",
        whatsappHref: "https://wa.me/919870821082",
        allowCall: true,
      },
    ],
  },
];

export const contact = {
  person: "Kunal Suri",
  role: "Co-Founder & Manager – Operations",
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
export const indiaCities: { name: string; at: [number, number]; hub?: boolean; state?: string }[] = [
  { name: "Delhi", at: [77.2, 28.6], hub: true, state: "Delhi NCR" },
  { name: "Mumbai", at: [72.88, 19.08], hub: true, state: "Maharashtra" },
  { name: "Bengaluru", at: [77.59, 12.97], hub: true, state: "Karnataka" },
  { name: "Chennai", at: [80.27, 13.08], hub: true, state: "Tamil Nadu" },
  { name: "Kolkata", at: [88.36, 22.57], hub: true, state: "West Bengal" },
  { name: "Hyderabad", at: [78.49, 17.39], hub: true, state: "Telangana" },
  { name: "Pune", at: [73.86, 18.52], hub: true, state: "Maharashtra" },
  { name: "Ahmedabad", at: [72.57, 23.02], hub: true, state: "Gujarat" },
  { name: "Jaipur", at: [75.79, 26.91], hub: true, state: "Rajasthan" },
  { name: "Chandigarh", at: [76.78, 30.73], hub: true, state: "Punjab / Haryana" },
  { name: "Lucknow", at: [80.95, 26.85], hub: true, state: "Uttar Pradesh" },
  { name: "Kochi", at: [76.27, 9.93], hub: true, state: "Kerala" },
  { name: "Goa", at: [73.83, 15.49], hub: true, state: "Goa" },
  { name: "Agra", at: [78.01, 27.18], state: "Uttar Pradesh" },
  { name: "Surat", at: [72.83, 21.17], state: "Gujarat" },
  { name: "Indore", at: [75.86, 22.72], state: "Madhya Pradesh" },
  { name: "Bhopal", at: [77.41, 23.25], state: "Madhya Pradesh" },
  { name: "Nagpur", at: [79.08, 21.14], state: "Maharashtra" },
  { name: "Coimbatore", at: [76.96, 11.02], state: "Tamil Nadu" },
  { name: "Visakhapatnam", at: [83.3, 17.69], state: "Andhra Pradesh" },
  { name: "Vijayawada", at: [80.64, 16.50], state: "Andhra Pradesh" },
  { name: "Vadodara", at: [73.18, 22.30], state: "Gujarat" },
  { name: "Rajkot", at: [70.80, 22.30], state: "Gujarat" },
  { name: "Patna", at: [85.13, 25.59], state: "Bihar" },
  { name: "Bhubaneswar", at: [85.82, 20.29], state: "Odisha" },
  { name: "Guwahati", at: [91.74, 26.14], state: "Assam" },
  { name: "Varanasi", at: [82.97, 25.32], state: "Uttar Pradesh" },
  { name: "Amritsar", at: [74.87, 31.63], state: "Punjab" },
  { name: "Jalandhar", at: [75.57, 31.32], state: "Punjab" },
  { name: "Ludhiana", at: [75.85, 30.90], state: "Punjab" },
  { name: "Udaipur", at: [73.71, 24.58], state: "Rajasthan" },
  { name: "Jodhpur", at: [73.02, 26.23], state: "Rajasthan" },
  { name: "Dehradun", at: [78.03, 30.31], state: "Uttarakhand" },
  { name: "Haridwar / Rishikesh", at: [78.16, 29.94], state: "Uttarakhand" },
  { name: "Shimla", at: [77.17, 31.10], state: "Himachal Pradesh" },
  { name: "Srinagar", at: [74.8, 34.08], state: "Jammu & Kashmir" },
  { name: "Jammu", at: [74.86, 32.73], state: "Jammu & Kashmir" },
  { name: "Thiruvananthapuram", at: [76.93, 8.52], state: "Kerala" },
  { name: "Mangalore", at: [74.85, 12.91], state: "Karnataka" },
  { name: "Mysuru", at: [76.63, 12.29], state: "Karnataka" },
  { name: "Nashik", at: [73.78, 19.99], state: "Maharashtra" },
  { name: "Aurangabad", at: [75.34, 19.87], state: "Maharashtra" },
  { name: "Madurai", at: [78.11, 9.92], state: "Tamil Nadu" },
  { name: "Tiruchirappalli", at: [78.70, 10.79], state: "Tamil Nadu" },
  { name: "Raipur", at: [81.62, 21.25], state: "Chhattisgarh" },
  { name: "Ranchi", at: [85.33, 23.34], state: "Jharkhand" },
  { name: "Kanpur", at: [80.33, 26.44], state: "Uttar Pradesh" },
  { name: "Prayagraj", at: [81.84, 25.43], state: "Uttar Pradesh" },
  { name: "Gwalior", at: [78.18, 26.21], state: "Madhya Pradesh" },
  { name: "Jabalpur", at: [79.98, 23.18], state: "Madhya Pradesh" },
  { name: "Noida / Greater Noida", at: [77.39, 28.53], state: "Uttar Pradesh" },
  { name: "Gurugram (Gurgaon)", at: [77.03, 28.46], state: "Haryana" },
];

const CITY_ID_OVERRIDES: Record<string, string> = {
  Mumbai: "a0000000-0000-4000-8000-000000000003",
  Pune: "a0000000-0000-4000-8000-000000000004",
};

export const clientCities = indiaCities.map((city, index) => ({
  id:
    CITY_ID_OVERRIDES[city.name] ??
    `a0000000-0000-4000-8000-${String(20 + index).padStart(12, "0")}`,
  name: city.name,
  state: city.state,
}));

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
