// Idempotently ensures a Stripe webhook endpoint exists pointing at our
// stripe-webhook function, and stores the whsec_ signing secret in Vault.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/stripe-webhook`;
const EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function stripe(path: string, form?: Record<string, string>, method = "POST") {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (form) init.body = new URLSearchParams(form).toString();
  const res = await fetch(`https://api.stripe.com/v1${path}`, init);
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe ${method} ${path}: ${JSON.stringify(json)}`);
  return json;
}

async function stripeGet(path: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe GET ${path}: ${JSON.stringify(json)}`);
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const list = await stripeGet("/webhook_endpoints?limit=100");
    let endpoint = (list.data || []).find(
      (e: { url: string }) => e.url === WEBHOOK_URL,
    );

    let created = false;
    let secret: string | null = null;

    if (endpoint) {
      // Ensure events cover our set; if not, update
      const missing = EVENTS.filter((ev) => !endpoint.enabled_events.includes(ev));
      if (missing.length) {
        const form: Record<string, string> = {};
        EVENTS.forEach((ev, i) => (form[`enabled_events[${i}]`] = ev));
        endpoint = await stripe(`/webhook_endpoints/${endpoint.id}`, form);
      }
    } else {
      const form: Record<string, string> = { url: WEBHOOK_URL };
      EVENTS.forEach((ev, i) => (form[`enabled_events[${i}]`] = ev));
      endpoint = await stripe("/webhook_endpoints", form);
      created = true;
      secret = endpoint.secret; // whsec_... only returned on create
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let stored = false;
    if (secret) {
      const { error } = await admin.rpc("set_stripe_webhook_secret", { p_secret: secret });
      if (error) throw new Error(`vault store failed: ${error.message}`);
      stored = true;
    } else {
      // Check whether a secret already exists in Vault
      const { data: existing } = await admin.rpc("get_stripe_webhook_secret");
      stored = !!existing;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        created,
        endpoint_id: endpoint.id,
        url: endpoint.url,
        events: endpoint.enabled_events,
        secret_stored_in_vault: stored,
        note: created
          ? "Signing secret generated and stored in Vault."
          : "Endpoint already existed; if Vault has no secret, delete the endpoint in Stripe and re-run.",
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
