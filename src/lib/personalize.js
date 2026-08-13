// Firm identity that Clay drops onto each personalised campaign link, read the
// same way the tools already read ?industry= / ?email=. The new bits are the
// logo: pass ?logo= (a logo image URL Clay enriches) and/or ?domain=. When only
// a domain is present we derive a logo from DuckDuckGo's icon service, which
// returns real transparent PNGs with no API key (Clearbit's free logo API is
// dead and logo.dev needs a token, so neither is usable here). SSR-safe;
// values are trimmed.
//
// Example links:
//   /app?tool=tp2&industry=architecture&company=Acme%20Architects&logo=https://cdn.example/acme.png
//   /app?tool=tp2&industry=architecture&company=Acme%20Architects&domain=acme.com

const qs = () =>
  typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);

const param = (...names) => {
  const q = qs();
  for (const n of names) {
    const v = (q.get(n) || "").trim();
    if (v) return v;
  }
  return "";
};

// Only trust http(s) image URLs so a stray ?logo= value can't point anywhere odd.
const safeLogo = (url) => (/^https?:\/\/\S+$/i.test(url) ? url : "");

// Strip protocol/path/www so ?domain= is tolerant of "https://www.acme.com/x".
const cleanDomain = (raw) =>
  raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].trim();

// Derive a logo from a bare domain via DuckDuckGo's icon service (real
// transparent PNGs, no API key). Used only when no explicit ?logo= is given.
const logoFromDomain = (domain) =>
  domain && /\.[a-z]{2,}$/i.test(domain) ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : "";

// Returns { company, logo, firstName }; any field is "" when the link omits it.
// logo prefers an explicit ?logo=, then falls back to ?domain= → DuckDuckGo.
export function getFirm() {
  const domain = cleanDomain(param("domain", "website", "url"));
  return {
    company: param("company", "company_name", "firm"),
    logo: safeLogo(param("logo", "logo_url")) || logoFromDomain(domain),
    firstName: param("firstname", "first_name", "fname"),
  };
}

// The AE actually running this contact's outreach (?ae_name=/?ae_title=/
// ?booking=, written into every campaign link by heygen-studio's /api/writeback
// from PRESENTER_META). Used so the results email is signed by, and merge-field
// personalised as, whichever AE the prospect has actually been hearing from.
export function getAe() {
  return {
    name: param("ae_name"),
    title: param("ae_title"),
    bookingLink: param("booking"),
  };
}
