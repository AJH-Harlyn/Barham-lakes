/* ============================================================
   THE BARHAM LAKES — booking config
   Edit the values below. Loaded by bookings.html, account.html
   and admin-bookings.html. Safe to expose: the ANON key is a
   public key protected by Row Level Security (see schema.sql).
   ============================================================ */

/* 1. Supabase project — from Supabase → Project Settings → API */
window.BARHAM_SUPABASE_URL      = "https://aastgbmsgyqbumjnsofk.supabase.co";
window.BARHAM_SUPABASE_ANON_KEY = "sb_publishable_IeS6rFMuhN6e81gls8R7UQ_5kJqZ4B8";

/* 2. Bookable waters. Add more objects to offer more exclusive waters. */
window.BARHAM_WATERS = {
  "brook-pool": {
    name: "Brook Pool + Lodge",
    blurb: "Exclusive hire of Brook Pool with the lakeside lodge.",
    includedAnglers: 4,        // price includes up to this many
    maxAnglers: 8,
    extraAnglerPerNight: 15,   // £ per extra angler per night
    minNights: 2
  }
  // "baileys-creek": { name:"Baileys Creek", includedAnglers:4, maxAnglers:6, extraAnglerPerNight:15, minNights:2 },
};

/* 3. Seasonal nightly rates (£ per night, whole party up to includedAnglers).
      Placeholder figures — Simon sets the real ones. These match the
      seasonal price list (peak 3-night ≈ £950). */
window.BARHAM_SEASONS = {
  "off-peak": { label: "Off-Peak", nightly: 215 },
  "shoulder": { label: "Shoulder", nightly: 283 },
  "peak":     { label: "Peak",     nightly: 317 },
  "festive":  { label: "Festive",  nightly: 400 }
};

window.BARHAM_DEPOSIT_PCT   = 0.30;   // deposit taken to secure a booking
window.BARHAM_WEEK_DISCOUNT = 0.05;   // 5% off stays of 7+ nights

/* 4. Syndicate membership tickets (£ per year/season). Placeholder prices. */
window.BARHAM_TICKETS = {
  "specimen-carp":    { name: "Specimen Carp",   price: 395, term: "Annual ticket",
                        scope: "Baileys Creek, Leia Lagoon & Blake Quarry — all year round.", featured: false },
  "complete-complex": { name: "Complete Complex", price: 595, term: "Annual ticket",
                        scope: "Every lake and the river, all year — the full Barham experience.", featured: true },
  "specimen-pike":    { name: "Specimen Pike",    price: 250, term: "Seasonal ticket",
                        scope: "Baileys Creek, Leia Lagoon & Blake Quarry — seasonal.", featured: false }
};

/* Bank-holiday dates are charged at Peak. Add YYYY-MM-DD strings as needed. */
window.BARHAM_BANK_HOLIDAYS = [
  "2026-04-03","2026-04-06","2026-05-04","2026-05-25","2026-08-31","2026-12-25","2026-12-28"
];

/* Nightly booking calendar — pick check-in & check-out nights.
   Brook Pool is priced by season (via BARHAM.quote); the others use a
   flat nightly rate. Placeholder rates — set the real ones. */
window.BARHAM_CAL_FACILITIES = {
  "brook-pool":    { name: "Brook Pool + Lodge", nightly: 317, minNights: 2 },
  "baileys-creek": { name: "Baileys Creek",       nightly: 35,  minNights: 1 },
  "leia-lagoon":   { name: "Leia Lagoon",         nightly: 35,  minNights: 1 },
  "blake-quarry":  { name: "Blake Quarry",        nightly: 35,  minNights: 1 },
  "the-river":     { name: "The River",           nightly: 30,  minNights: 1 }
};

/* ---------- shared helpers (used by public + admin pages) ---------- */
window.BARHAM = {
  season(dateStr) {
    if (window.BARHAM_BANK_HOLIDAYS.includes(dateStr)) return "peak";
    const d = new Date(dateStr + "T00:00:00");
    const m = d.getMonth() + 1, day = d.getDate();
    if ((m === 12 && day >= 23) || (m === 1 && day <= 2)) return "festive";
    if (m === 8 || (m === 7 && day >= 20)) return "peak";           // school summer holidays
    if ([4,5,6,9,10].includes(m)) return "shoulder";                 // spring / autumn
    return "off-peak";                                               // Nov–Mar
  },
  nights(checkIn, checkOut) {
    const a = new Date(checkIn + "T00:00:00"), b = new Date(checkOut + "T00:00:00");
    return Math.round((b - a) / 86400000);
  },
  /* Returns { nights, season, seasonLabel, price, deposit, balance } */
  quote(waterKey, checkIn, checkOut, anglers) {
    const w = window.BARHAM_WATERS[waterKey];
    const nights = this.nights(checkIn, checkOut);
    const season = this.season(checkIn);
    const nightly = window.BARHAM_SEASONS[season].nightly;
    let price = nightly * nights;
    if (nights >= 7) price = Math.round(price * (1 - window.BARHAM_WEEK_DISCOUNT));
    const extra = Math.max(0, (anglers || w.includedAnglers) - w.includedAnglers);
    price += extra * w.extraAnglerPerNight * nights;
    const deposit = Math.round(price * window.BARHAM_DEPOSIT_PCT);
    return { nights, season, seasonLabel: window.BARHAM_SEASONS[season].label,
             price, deposit, balance: price - deposit };
  },
  money(n) { return "£" + Number(n).toLocaleString("en-GB"); }
};
