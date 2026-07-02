// Stripe calls this after a successful deposit payment.
// It marks the booking as deposit_paid + confirmed. Configure the endpoint
// in Stripe → Developers → Webhooks:  https://YOUR-SITE/.netlify/functions/stripe-webhook
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers["stripe-signature"];
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;

  let evt;
  try {
    evt = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return { statusCode: 400, body: `Webhook signature failed: ${err.message}` };
  }

  if (evt.type === "checkout.session.completed") {
    const s = evt.data.object;
    const md = s.metadata || {};
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (md.type === "membership" && md.membership_id) {
      const expires = new Date(); expires.setFullYear(expires.getFullYear() + 1);
      await supabase.from("memberships")
        .update({ payment_status: "paid", status: "active", stripe_session: s.id,
                  expires_at: expires.toISOString().slice(0, 10) })
        .eq("id", md.membership_id);
    } else if (md.booking_id) {
      await supabase.from("bookings")
        .update({ payment_status: "deposit_paid", status: "confirmed", stripe_session: s.id })
        .eq("id", md.booking_id);
    }
  }
  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
