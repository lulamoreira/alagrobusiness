// Creates a Stripe Checkout Session (mode=payment) to purchase an ad highlight.
// Reuses STRIPE_SECRET_KEY. verify_jwt = true (see supabase/config.toml).
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
    const anuncio_id = String(body?.anuncio_id ?? "");
    const pacote_id = String(body?.pacote_id ?? "");
    if (!anuncio_id || !pacote_id) {
      return new Response(JSON.stringify({ error: "invalid_input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Check ownership or admin
    const { data: anuncio } = await admin
      .from("anuncios")
      .select("id, vendedor_id, titulo")
      .eq("id", anuncio_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!anuncio) {
      return new Response(JSON.stringify({ error: "anuncio_nao_encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdminRow } = await admin.rpc("is_admin", { _user_id: user.id });
    const isAdmin = Boolean(isAdminRow);
    if (anuncio.vendedor_id !== user.id && !isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pacote } = await admin
      .from("destaque_pacotes")
      .select("id, dias, preco_centavos, ativo")
      .eq("id", pacote_id)
      .maybeSingle();
    if (!pacote || !pacote.ativo) {
      return new Response(JSON.stringify({ error: "pacote_invalido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const originHeader = req.headers.get("origin") ?? req.headers.get("referer") ?? "";
    const originClean = originHeader.replace(/\/$/, "");
    const origin = /^https?:\/\//.test(originClean) ? originClean : "https://agrobusiness.lovable.app";
    const successUrl = `${origin}/anuncio/${anuncio_id}?destaque=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/anuncio/${anuncio_id}?destaque=cancel`;

    const session = await stripeForm("/checkout/sessions", {
      mode: "payment",
      "line_items[0][price_data][currency]": "brl",
      "line_items[0][price_data][unit_amount]": String(pacote.preco_centavos),
      "line_items[0][price_data][product_data][name]": `Destaque ${pacote.dias} dias`,
      "line_items[0][quantity]": "1",
      "payment_method_types[0]": "card",
      client_reference_id: user.id,
      customer_email: user.email ?? "",
      "metadata[tipo]": "destaque",
      "metadata[anuncio_id]": anuncio_id,
      "metadata[pacote_id]": pacote_id,
      "metadata[dias]": String(pacote.dias),
      "metadata[valor_centavos]": String(pacote.preco_centavos),
      "metadata[usuario_id]": user.id,
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: "pt-BR",
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
