// Creates a Stripe Checkout session for either a booking DEPOSIT or a
// syndicate MEMBERSHIP. Amounts are always recomputed server-side from the
// database row — never trust the amount sent by the browser.
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const body = JSON.parse(event.body || "{}");
    const site = process.env.SITE_URL || `https://${event.headers.host}`;

    if (body.type === "membership") {
      const { data: m, error } = await supabase
        .from("memberships").select("*").eq("id", body.membership_id).single();
      if (error || !m) return json(404, { error: "Membership not found" });
      if (m.payment_status === "paid") return json(400, { error: "Already paid" });
      const session = await stripe.checkout.sessions.create({
        mode: "payment", customer_email: m.email,
        line_items: [{ quantity: 1, price_data: { currency: "gbp", unit_amount: Math.round(m.price * 100),
          product_data: { name: `Syndicate membership — ${m.ticket}`, description: `The Barham Lakes · ${m.season_year}` } } }],
        metadata: { type: "membership", membership_id: m.id },
        success_url: `${site}/syndicate.html?joined=1`,
        cancel_url: `${site}/account.html`
      });
      return json(200, { url: session.url });
    }

    // default: booking deposit
    const { data: bk, error } = await supabase
      .from("bookings").select("*").eq("id", body.booking_id).single();
    if (error || !bk) return json(404, { error: "Booking not found" });
    if (bk.payment_status === "deposit_paid") return json(400, { error: "Deposit already paid" });
    const session = await stripe.checkout.sessions.create({
      mode: "payment", customer_email: bk.email,
      line_items: [{ quantity: 1, price_data: { currency: "gbp", unit_amount: Math.round(bk.deposit * 100),
        product_data: { name: "Booking deposit — The Barham Lakes",
          description: `${bk.water} · ${bk.check_in} → ${bk.check_out} · ${bk.nights} nights` } } }],
      metadata: { type: "booking", booking_id: bk.id },
      success_url: `${site}/bookings.html?paid=1&booking=${bk.id}`,
      cancel_url: `${site}/account.html`
    });
    return json(200, { url: session.url });
  } catch (e) {
    return json(500, { error: e.message });
  }
};

const json = (statusCode, body) => ({
  statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
});
