// Admin-only: idempotently ensure Stripe (TEST) product + prices for Pro plan,
// then persist price IDs into public.planos. Safe to re-run.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PRODUCT_NAME = "Entreposto Virtual Pro";
const PRODUCT_LOOKUP = "agrobusiness_pro";
const PRICE_MENSAL_LOOKUP = "agrobusiness_pro_mensal";
const PRICE_ANUAL_LOOKUP = "agrobusiness_pro_anual";
const AMOUNT_MENSAL = 7990; // R$ 79,90
const AMOUNT_ANUAL = 79900; // R$ 799,00

async function stripe(path: string, init: RequestInit = {}, form?: Record<string, string>) {
  const body = form
    ? new URLSearchParams(form).toString()
    : (init.body as string | undefined);
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    ...init,
    body,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(init.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${path} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function ensureProduct(): Promise<string> {
  // Search by metadata lookup key
  const search = await stripe(
    `/products/search?query=${encodeURIComponent(`metadata['lookup']:'${PRODUCT_LOOKUP}'`)}`,
    { method: "GET" },
  );
  if (search.data?.length) return search.data[0].id;
  const created = await stripe("/products", { method: "POST" }, {
    name: PRODUCT_NAME,
    "metadata[lookup]": PRODUCT_LOOKUP,
  });
  return created.id;
}

async function ensurePrice(
  productId: string,
  lookupKey: string,
  amount: number,
  interval: "month" | "year",
): Promise<string> {
  const list = await stripe(
    `/prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&active=true&limit=1`,
    { method: "GET" },
  );
  if (list.data?.length) {
    const p = list.data[0];
    if (
      p.unit_amount === amount &&
      p.currency === "brl" &&
      p.recurring?.interval === interval &&
      p.product === productId
    ) {
      return p.id;
    }
    // Deactivate mismatched price so we can recreate with same lookup key
    await stripe(`/prices/${p.id}`, { method: "POST" }, { active: "false", lookup_key: "" });
  }
  const created = await stripe("/prices", { method: "POST" }, {
    product: productId,
    currency: "brl",
    unit_amount: String(amount),
    "recurring[interval]": interval,
    lookup_key: lookupKey,
    "metadata[lookup]": lookupKey,
  });
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Require an authenticated admin caller.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supa.auth.getUser();
    if (!userData?.user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const { data: isAdmin } = await supa.rpc("is_admin", { _user_id: userData.user.id });
    if (!isAdmin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

    const productId = await ensureProduct();
    const priceMensal = await ensurePrice(productId, PRICE_MENSAL_LOOKUP, AMOUNT_MENSAL, "month");
    const priceAnual = await ensurePrice(productId, PRICE_ANUAL_LOOKUP, AMOUNT_ANUAL, "year");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error: updErr } = await admin
      .from("planos")
      .update({
        stripe_price_id_mensal: priceMensal,
        stripe_price_id_anual: priceAnual,
      })
      .eq("codigo", "pro");
    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({
        product_id: productId,
        price_id_mensal: priceMensal,
        price_id_anual: priceAnual,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
