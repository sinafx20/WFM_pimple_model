// Branded, client-side results PDF for the WorkflowMAX content tools.
// One generic generator used by all three pieces (Health Check, Calculator,
// Benchmark). Each tool maps its results into the `cfg` shape below and calls
// downloadResultsPdf(cfg) — no backend involved; the file is built and saved in
// the prospect's browser.
//
// cfg = {
//   tool:        "Profit Leak Calculator",        // appears in the header + filename
//   industry:    "Engineering Consultancy",
//   meta:        "$10.0M revenue · 45 staff",      // sub-line under the title
//   hero:        { label, value, sub, accent },    // the headline number
//   itemsTitle:  "Where it adds up",
//   items:       [{ label, value, note }],         // breakdown rows
//   highlights:  [{ title, body }],                // "what to do" callouts
//   footerNote:  "…optional extra disclaimer…",
// }

// jsPDF is loaded on demand (inside downloadResultsPdf) so it never weighs down
// the initial tool bundle — it only downloads when a prospect clicks "Download".

/* ─── Brand tokens (mirrors src/styles/tokens.js) ─── */
const C = {
  evergreen: "#0A2F28",
  moneytree: "#63DB94",
  leaf: "#0D8D5C",
  ink: "#384250",
  grey: "#6C737F",
  faint: "#9DA4AE",
  red: "#b42318",
  redSoft: "#EC5F60",
  cardBg: "#F9FAFB",
  border: "#E5E7EB",
  white: "#FFFFFF",
};

const rgb = (hex) => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/* The WFM wordmark, dark-on-transparent. Rendered to PNG at runtime and placed
   in a white chip on the evergreen header, and directly in the footer. */
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="134" height="40" viewBox="0 0 134 40" fill="none"><g clip-path="url(#pdflogo)">
<path d="M13.845 14.0233L12.563 19.2264C12.4393 19.7471 12.3414 20.2456 12.2601 20.7053C12.164 20.2326 12.0421 19.7194 11.8925 19.1858L10.4867 14.0233H7.15617L5.82432 19.1968C5.69132 19.7323 5.58233 20.2474 5.49367 20.7256C5.40315 20.2567 5.29047 19.7489 5.15377 19.2171L3.79791 14.0233H0L3.31024 25.9638H7.33905L8.52497 21.2703C8.62472 20.866 8.70969 20.4745 8.78174 20.1089C8.85747 20.4727 8.94614 20.8604 9.05328 21.2574L10.3648 25.962H14.4139L17.569 14.0214H13.845V14.0233Z" fill="#0A2F28"/>
<path d="M23.1717 13.7592C19.6121 13.7592 17.4878 16.0727 17.4878 19.9464C17.4878 23.8201 19.6657 26.2537 23.1717 26.2537C26.6778 26.2537 28.8557 23.8368 28.8557 19.9464C28.8557 16.0561 26.7313 13.7592 23.1717 13.7592ZM25.2148 19.9704C25.2148 22.8249 24.123 23.1924 23.1717 23.1924C22.2204 23.1924 21.1527 22.8249 21.1527 19.9704C21.1527 17.1159 22.2315 16.8925 23.1717 16.8925C24.112 16.8925 25.2148 17.2415 25.2148 19.9704Z" fill="#0A2F28"/>
<path d="M33.3814 15.7533L33.1893 14.0251H29.929V25.9657H33.6179V20.2844C33.6179 18.3346 34.922 17.6403 36.143 17.6403C36.542 17.6403 36.845 17.6773 37.1923 17.7714L37.6633 17.897L38.0365 13.8072L37.6079 13.7851C35.6277 13.6817 34.2108 14.3427 33.3814 15.7533Z" fill="#0A2F28"/>
<path d="M50.1302 14.0233H45.7042L42.6175 18.1869V9.06573H38.9268V25.9657H42.6175V21.2482H42.6674L46.0368 25.9657H50.4646L45.732 19.616L50.1302 14.0233Z" fill="#0A2F28"/>
<path d="M62.8559 22.8545C62.54 22.8545 62.2832 22.596 62.2832 22.2803V9.0122L61.9193 9.05651C60.6078 9.21899 59.2815 9.15991 57.9773 8.95311C57.6337 8.89772 57.2791 8.87372 56.8874 8.87372C53.9171 8.87372 52.1419 10.6112 52.1419 13.5211V14.0233H50.5034V17.0846H52.1419V25.9638H55.8308V17.0846H57.4546V14.0233H55.8308V13.425C55.8308 12.3929 56.2668 11.9129 57.1996 11.9129C57.7002 11.9129 58.1306 12.0218 58.5684 12.2637V23.0742C58.5684 24.9908 59.843 26.1817 61.8934 26.1817C62.4439 26.1817 62.9981 26.0949 63.6908 25.9029L63.9753 25.8217L64.1452 22.4446L63.5301 22.7234C63.3287 22.8157 63.1219 22.8545 62.8559 22.8545Z" fill="#0A2F28"/>
<path d="M70.3426 13.7592C66.783 13.7592 64.6587 16.0727 64.6587 19.9464C64.6587 23.8201 66.8366 26.2537 70.3426 26.2537C73.8487 26.2537 76.0266 23.8368 76.0266 19.9464C76.0266 16.0561 73.9022 13.7592 70.3426 13.7592ZM72.3875 19.9704C72.3875 22.8249 71.2939 23.1924 70.3445 23.1924C69.395 23.1924 68.3236 22.8249 68.3236 19.9704C68.3236 17.1159 69.4024 16.8925 70.3445 16.8925C71.2866 16.8925 72.3875 17.2415 72.3875 19.9704Z" fill="#0A2F28"/>
<path d="M89.7035 14.0233L88.4215 19.2264C88.2996 19.7471 88.1999 20.2474 88.1204 20.7072C88.0225 20.2326 87.9006 19.7194 87.7528 19.1858L86.3471 14.0233H83.0165L81.6847 19.1968C81.5517 19.7323 81.4427 20.2474 81.354 20.7256C81.2635 20.2567 81.1508 19.7489 81.0141 19.2171L79.6583 14.0233H75.8604L79.1706 25.9638H83.1994L84.3853 21.2703C84.4851 20.866 84.57 20.4745 84.6421 20.1089C84.7178 20.4727 84.8065 20.8604 84.9136 21.2574L86.2252 25.962H90.2743L93.4294 14.0214H89.7072L89.7035 14.0233Z" fill="#0A2F28"/>
<path d="M133.999 20C133.999 21.3626 133.865 22.7013 133.606 23.979C133.471 24.6658 133.299 25.3287 133.091 25.9786C130.549 34.1063 122.958 40 113.99 40C105.022 40 97.4316 34.1063 94.8898 25.9786C94.3005 24.1008 93.981 22.0864 93.981 20C93.981 17.9136 94.3005 15.8992 94.8898 14.0214C97.4316 5.89365 105.024 0 113.99 0C122.957 0 130.549 5.89365 133.091 14.0214C133.288 14.6473 133.458 15.3102 133.593 15.973C133.865 17.2729 133.999 18.6115 133.999 20Z" fill="#63DB94"/>
<path d="M103.581 14.0086L100.313 19.0326L97.0326 14.0086H94.8825C94.2914 15.8882 93.9736 17.9026 93.9736 19.989C93.9736 22.0754 94.2932 24.0916 94.8825 25.9713H97.548V21.9166L99.9568 25.9713H100.657L103.066 21.9166V25.9713H107.427V14.0067H103.581V14.0086Z" fill="#0A2F28"/>
<path d="M117.567 14.0085H110.992L108.018 25.9712H112.738L112.984 24.5975H115.958L116.279 25.9712H120.777L117.57 14.0085H117.567ZM113.597 21.1319L114.199 17.6182H114.347L115.145 21.1319H113.597Z" fill="#0A2F28"/>
<path d="M131.257 19.9779L133.604 15.962C133.47 15.2992 133.298 14.6345 133.1 14.0085H129.781L128.222 16.8704L126.722 14.0085H121.339L124.841 19.989L121.278 25.9712H126.622L127.9 23.4029L129.265 25.9712H133.1C133.309 25.3195 133.481 24.6566 133.615 23.9679L131.257 19.976V19.9779Z" fill="#0A2F28"/>
</g><defs><clipPath id="pdflogo"><rect width="134" height="40" fill="white"/></clipPath></defs></svg>`;

/* Rasterise the inline SVG logo to a PNG data URL (4x for crisp print). */
function svgToPng(svg) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = 4;
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: canvas.toDataURL("image/png"), ratio: img.width / img.height });
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

const slug = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function downloadResultsPdf(cfg) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const PAGE_W = 210;
  const PAGE_H = 297;
  const M = 16;                // page margin
  const CW = PAGE_W - M * 2;   // content width
  const fill = (hex) => doc.setFillColor(...rgb(hex));
  const stroke = (hex) => doc.setDrawColor(...rgb(hex));
  const ink = (hex) => doc.setTextColor(...rgb(hex));

  let logo = null;
  try { logo = await svgToPng(LOGO_SVG); } catch { /* logo optional — text header still renders */ }

  /* ── Header band ── */
  fill(C.evergreen);
  doc.rect(0, 0, PAGE_W, 40, "F");
  // white logo chip
  if (logo) {
    fill(C.white);
    doc.roundedRect(M, 11, 44, 18, 2.5, 2.5, "F");
    const lh = 9.5, lw = lh * logo.ratio;
    doc.addImage(logo.dataUrl, "PNG", M + (44 - lw) / 2, 11 + (18 - lh) / 2, lw, lh);
  }
  ink(C.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(cfg.tool || "Your Results", M + 50, 21);
  ink(C.moneytree);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const dateStr = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  doc.text(`Personalised results · ${dateStr}`, M + 50, 28);

  let y = 52;

  /* ── Meta line ── */
  if (cfg.industry || cfg.meta) {
    ink(C.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    if (cfg.industry) { doc.text(cfg.industry, M, y); y += 5.5; }
    if (cfg.meta) {
      ink(C.grey);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(cfg.meta, M, y);
      y += 4;
    }
    y += 5;
  }

  /* ── Hero number ── */
  if (cfg.hero) {
    const hH = 30;
    fill(C.evergreen);
    doc.roundedRect(M, y, CW, hH, 3, 3, "F");
    ink(C.faint);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text((cfg.hero.label || "").toUpperCase(), M + 8, y + 9);
    ink(cfg.hero.accent || C.redSoft);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text(String(cfg.hero.value), M + 8, y + 21);
    if (cfg.hero.sub) {
      ink(C.faint);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(cfg.hero.sub, M + 8, y + 27);
    }
    y += hH + 10;
  }

  const ensure = (need) => {
    if (y + need > PAGE_H - 24) { doc.addPage(); y = 20; }
  };

  /* ── Breakdown items ── */
  if (cfg.items && cfg.items.length) {
    ensure(12);
    ink(C.evergreen);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(cfg.itemsTitle || "Breakdown", M, y);
    y += 7;

    cfg.items.forEach((it) => {
      const noteLines = it.note ? doc.splitTextToSize(it.note, CW - 38) : [];
      const rowH = 8 + noteLines.length * 4 + 4;
      ensure(rowH);
      // label
      ink(C.evergreen);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text(it.label, M, y + 2);
      // value (right)
      if (it.value != null) {
        ink(cfg.itemValueColor || C.red);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(String(it.value), PAGE_W - M, y + 2, { align: "right" });
      }
      // note
      if (noteLines.length) {
        ink(C.grey);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(noteLines, M, y + 7);
      }
      y += rowH;
      stroke(C.border);
      doc.setLineWidth(0.2);
      doc.line(M, y - 2, PAGE_W - M, y - 2);
    });
    y += 6;
  }

  /* ── Highlights / what to do ── */
  if (cfg.highlights && cfg.highlights.length) {
    ensure(12);
    ink(C.evergreen);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(cfg.highlightsTitle || "What to do with this", M, y);
    y += 7;

    cfg.highlights.forEach((h) => {
      const bodyLines = doc.splitTextToSize(h.body || "", CW - 12);
      const boxH = 9 + bodyLines.length * 4.4 + 5;
      ensure(boxH + 3);
      fill(C.cardBg);
      stroke(C.border);
      doc.setLineWidth(0.2);
      doc.roundedRect(M, y, CW, boxH, 2.5, 2.5, "FD");
      ink(C.leaf);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(h.title || "", M + 6, y + 7);
      ink(C.ink);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(bodyLines, M + 6, y + 13);
      y += boxH + 5;
    });
    y += 2;
  }

  /* ── Footer (every page) ── */
  const drawFooter = (note) => {
    const fy = PAGE_H - 18;
    stroke(C.border);
    doc.setLineWidth(0.2);
    doc.line(M, fy, PAGE_W - M, fy);
    if (logo) {
      const lh = 5, lw = lh * logo.ratio;
      doc.addImage(logo.dataUrl, "PNG", M, fy + 3, lw, lh);
    }
    ink(C.faint);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const disclaimer = note ||
      "Figures are estimates based on your inputs and independent industry research (SPI Research, ABS, Gartner, APQC, Master Builders Australia). All amounts in AUD.";
    doc.text(doc.splitTextToSize(disclaimer, CW - 34), M + 34, fy + 5);
    ink(C.grey);
    doc.setFontSize(7.5);
    doc.text("© 2026 WorkflowMAX", PAGE_W - M, fy + 14, { align: "right" });
  };

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    drawFooter(cfg.footerNote);
  }

  const filename = `WorkflowMAX-${slug(cfg.tool) || "results"}-${slug(cfg.industry) || "firm"}.pdf`;
  doc.save(filename);
}
