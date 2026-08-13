// Shared currency detection + formatting for the Calculator and Benchmark tools.
// Rates are rough, static approximations (not live) — fine for a directional
// marketing tool, not for anything claiming precision.
export const CURRENCIES = {
  AUD: { code: "AUD", symbol: "A$", label: "Australia (AUD)", rate: 1 },
  NZD: { code: "NZD", symbol: "NZ$", label: "New Zealand (NZD)", rate: 1.08 },
  GBP: { code: "GBP", symbol: "£", label: "United Kingdom (GBP)", rate: 0.52 },
  USD: { code: "USD", symbol: "US$", label: "United States / other (USD)", rate: 0.65 },
};
export const CURRENCY_ORDER = ["AUD", "NZD", "GBP", "USD"];

const COUNTRY_TO_CURRENCY = [
  [/australia/i, "AUD"],
  [/new zealand/i, "NZD"],
  [/united kingdom|^uk$|great britain|england|scotland|wales|northern ireland/i, "GBP"],
];

// Reads ?currency= (explicit override, e.g. from the Campaign Copy blob) first,
// then ?country= (HubSpot's free-text country property, passed straight through
// by the personalization blob). A recognised-but-unmapped country (US and
// everywhere else) becomes USD; an unrecognised/missing country falls back to
// AUD, the brand default, rather than guessing.
export function detectCurrency() {
  if (typeof window === "undefined") return "AUD";
  const params = new URLSearchParams(window.location.search);
  const explicit = (params.get("currency") || "").toUpperCase().trim();
  if (CURRENCIES[explicit]) return explicit;
  const country = (params.get("country") || "").trim();
  if (!country) return "AUD";
  for (const [re, code] of COUNTRY_TO_CURRENCY) if (re.test(country)) return code;
  return "USD";
}

// Converts an AUD-anchored default (industry benchmark figures, hourly rates,
// job values) into the target currency. Only meant for flat constants — a
// prospect's own revenue/rate inputs, once entered, are already in their own
// currency and should never be run back through this.
export const fx = (value, code) => value * (CURRENCIES[code]?.rate ?? 1);

export function fmtCurrency(value, code) {
  const c = CURRENCIES[code] || CURRENCIES.AUD;
  const v = Math.round(value);
  const abs = Math.abs(v);
  if (abs >= 1000000) return `${c.symbol}${(v / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${c.symbol}${Math.round(v / 1000).toLocaleString("en-AU")}K`;
  return `${c.symbol}${v.toLocaleString("en-AU")}`;
}
