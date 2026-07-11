import { DEMO_GID_PREFIX } from "./constants";

const FIRST_NAMES = [
  "Alex",
  "Jordan",
  "Taylor",
  "Morgan",
  "Casey",
  "Riley",
  "Avery",
  "Quinn",
  "Sage",
  "Rowan",
  "Emma",
  "Liam",
  "Olivia",
  "Noah",
  "Ava",
  "Ethan",
  "Mia",
  "Lucas",
  "Sophia",
  "Mason",
];

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Wilson",
  "Anderson",
  "Thomas",
  "Martinez",
  "Lee",
  "Walker",
  "Hall",
  "Young",
  "King",
  "Wright",
  "Scott",
  "Green",
];

export const DEMO_COUNTRIES = [
  { code: "US", tld: "com" },
  { code: "GB", tld: "co.uk" },
  { code: "DE", tld: "de" },
  { code: "FR", tld: "fr" },
  { code: "CA", tld: "ca" },
  { code: "AU", tld: "com.au" },
  { code: "NL", tld: "nl" },
  { code: "SE", tld: "se" },
  { code: "ES", tld: "es" },
  { code: "IT", tld: "it" },
] as const;

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomItem<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)]!;
}

export function randomFloat(min: number, max: number, decimals = 2): number {
  const value = Math.random() * (max - min) + min;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function randomDateWithinDays(days: number): Date {
  const now = Date.now();
  const offsetMs = randomInt(0, days * 86400000);
  return new Date(now - offsetMs);
}

export function randomPerson(): {
  firstName: string;
  lastName: string;
  countryCode: string;
  email: string;
} {
  const firstName = randomItem(FIRST_NAMES);
  const lastName = randomItem(LAST_NAMES);
  const country = randomItem(DEMO_COUNTRIES);
  const slug = `${firstName}.${lastName}.${country.code}`.toLowerCase();
  const suffix = randomInt(100, 9999);
  const email = `${slug}+${suffix}@demo.storepilot.${country.tld}`;
  return {
    firstName,
    lastName,
    countryCode: country.code,
    email,
  };
}

export function demoGid(kind: string, index: number): string {
  return `${DEMO_GID_PREFIX}${kind}/${index}-${crypto.randomUUID()}`;
}
