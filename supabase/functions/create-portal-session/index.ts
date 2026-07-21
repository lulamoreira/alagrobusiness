// User-scoped: opens a Stripe Billing Portal session for the currently signed-in
// user. verify_jwt=true — only the authenticated user can open their own portal.
// Idempotently ensures a Billing Portal Configuration with: cancel subscription,
// update payment method and invoice history enabled.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PORTAL_LOOKUP = "agrobusiness_portal_v1";

async function stripeCall(path: string, form?: Record<string, string>, method: "GET" | "POST" = form ? "POST" : "GET") {
  const url = `https://api.stripe.com/v1${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe ${path}: ${JSON.stringify(json)}`);
  return json;
}

async function ensurePortalConfiguration(): Promise<string> {
  // List portal configurations and try to find our lookup metadata.
  const list = await stripeCall(`/billing_portal/configurations?limit=100&active=true`);
  const existing = (list.data ?? []).find(
    (c: { metadata?: Record<string, string> }) => c.metadata?.lookup === PORTAL_LOOKUP,
  );
  if (existing) return existing.id as string;

  const form: Record<string, string> = {
    "metadata[lookup]": PORTAL_LOOKUP,
    "business_profile[headline]": "Entreposto Virtual",
    "features[customer_update][enabled]": "true",
    "features[customer_update][allowed_updates][0]": "email",
    "features[customer_update][allowed_updates][1]": "tax_id",
    "features[customer_update][allowed_updates][2]": "address",
    "features[customer_update][allowed_updates][3]": "phone",
    "features[payment_method_update][enabled]": "true",
    "features[invoice_history][enabled]": "true",
    "features[subscription_cancel][enabled]": "true",
    "features[subscription_cancel][mode]": "at_period_end",
    "features[subscription_cancel][cancellation_reason][enabled]": "true",
    "features[subscription_cancel][cancellation_reason][options][0]": "too_expensive",
    "features[subscription_cancel][cancellation_reason][options][1]": "missing_features",
    "features[subscription_cancel][cancellation_reason][options][2]": "switched_service",
    "features[subscription_cancel][cancellation_reason][options][3]": "unused",
    "features[subscription_cancel][cancellation_reason][options][4]": "other",
  };
  const created = await stripeCall(`/billing_portal/configurations`, form);
  return created.id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supa.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: assin } = await admin
      .from("assinaturas")
      .select("stripe_customer_id, origem, status")
      .eq("usuario_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const customerId = assin?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      return new Response(JSON.stringify({ error: "no_stripe_customer" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const configurationId = await ensurePortalConfiguration();

    const originHeader = req.headers.get("origin") ?? req.headers.get("referer") ?? "";
    const originClean = originHeader.replace(/\/$/, "");
    const origin = /^https?:\/\//.test(originClean) ? originClean : "https://entrepostovirtual.lovable.app";
    const returnUrl = `${origin}/planos`;

    const session = await stripeCall(`/billing_portal/sessions`, {
      customer: customerId,
      return_url: returnUrl,
      configuration: configurationId,
      locale: "pt-BR",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-portal-session error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
