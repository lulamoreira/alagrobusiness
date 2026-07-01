// User-scoped: creates a Stripe Checkout Session (mode=subscription) for the
// currently signed-in user. verify_jwt=true (see supabase/config.toml).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function stripeForm(path: string, form: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form).toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe ${path}: ${JSON.stringify(json)}`);
  return json;
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

    const body = await req.json().catch(() => ({}));
    const periodo: "mensal" | "anual" = body?.periodo === "anual" ? "anual" : "mensal";

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load Pro plan + price
    const { data: plano, error: planoErr } = await admin
      .from("planos")
      .select("id, codigo, stripe_price_id_mensal, stripe_price_id_anual")
      .eq("codigo", "pro")
      .is("deleted_at", null)
      .maybeSingle();
    if (planoErr || !plano) throw new Error("Plano Pro não encontrado");
    const priceId = periodo === "anual" ? plano.stripe_price_id_anual : plano.stripe_price_id_mensal;
    if (!priceId) throw new Error(`Price ID (${periodo}) não configurado — rode stripe-setup.`);

    // Reuse or create Stripe customer
    const { data: assin } = await admin
      .from("assinaturas")
      .select("id, stripe_customer_id")
      .eq("usuario_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let customerId = assin?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripeForm("/customers", {
        email: user.email ?? "",
        "metadata[usuario_id]": user.id,
      });
      customerId = customer.id;
      if (assin?.id) {
        await admin.from("assinaturas").update({ stripe_customer_id: customerId }).eq("id", assin.id);
      }
    }

    const origin = req.headers.get("origin") ?? req.headers.get("referer")?.replace(/\/$/, "") ?? "";
    const successUrl = `${origin}/planos?status=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/planos?status=cancel`;

    const session = await stripeForm("/checkout/sessions", {
      mode: "subscription",
      customer: customerId!,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "payment_method_types[0]": "card",
      client_reference_id: user.id,
      "metadata[usuario_id]": user.id,
      "metadata[plano_codigo]": "pro",
      "metadata[periodo]": periodo,
      "subscription_data[metadata][usuario_id]": user.id,
      "subscription_data[metadata][plano_codigo]": "pro",
      "subscription_data[metadata][periodo]": periodo,
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: "pt-BR",
      allow_promotion_codes: "true",
    });

    return new Response(JSON.stringify({ url: session.url, id: session.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
