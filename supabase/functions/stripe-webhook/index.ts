// Stripe webhook receiver — verifies signature using STRIPE_WEBHOOK_SECRET
// and activates/updates/cancels subscriptions in `assinaturas` via service_role.
// verify_jwt = false (Stripe calls without a user JWT); authenticity comes from
// the Stripe-Signature HMAC check below.
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function log(...args: unknown[]) {
  console.log("[stripe-webhook]", ...args);
}

async function getPlanoIdByCodigo(codigo: string): Promise<string | null> {
  const { data, error } = await admin
    .from("planos")
    .select("id")
    .eq("codigo", codigo)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    log("planos lookup error", error.message);
    return null;
  }
  return data?.id ?? null;
}

interface UpsertPayload {
  usuario_id: string;
  plano_id: string;
  status: "ativa" | "cancelada" | "expirada" | "trial";
  periodo?: string | null;
  inicio?: string | null;
  fim?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  origem?: "stripe" | "admin_cortesia" | "trial";
}

async function upsertAssinatura(p: UpsertPayload) {
  const { data: existing } = await admin
    .from("assinaturas")
    .select("id")
    .eq("usuario_id", p.usuario_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from("assinaturas")
      .update({
        plano_id: p.plano_id,
        status: p.status,
        periodo: p.periodo ?? null,
        inicio: p.inicio ?? new Date().toISOString(),
        fim: p.fim ?? null,
        stripe_customer_id: p.stripe_customer_id ?? null,
        stripe_subscription_id: p.stripe_subscription_id ?? null,
        origem: p.origem ?? "stripe",
        trial_ate: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw error;
    log("assinatura atualizada", existing.id);
  } else {
    const { error } = await admin.from("assinaturas").insert({
      usuario_id: p.usuario_id,
      plano_id: p.plano_id,
      status: p.status,
      periodo: p.periodo ?? null,
      inicio: p.inicio ?? new Date().toISOString(),
      fim: p.fim ?? null,
      stripe_customer_id: p.stripe_customer_id ?? null,
      stripe_subscription_id: p.stripe_subscription_id ?? null,
      origem: p.origem ?? "stripe",
    });
    if (error) throw error;
    log("assinatura criada para", p.usuario_id);
  }
}

async function findByStripeIds(opts: {
  subscription_id?: string | null;
  customer_id?: string | null;
}): Promise<{ id: string; usuario_id: string } | null> {
  let q = admin.from("assinaturas").select("id, usuario_id").is("deleted_at", null);
  if (opts.subscription_id) {
    q = q.eq("stripe_subscription_id", opts.subscription_id);
  } else if (opts.customer_id) {
    q = q.eq("stripe_customer_id", opts.customer_id);
  } else {
    return null;
  }
  const { data } = await q.maybeSingle();
  return data ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    log("missing signature");
    return new Response(JSON.stringify({ error: "missing_signature" }), { status: 400 });
  }

  const rawBody = await req.text();

  let webhookSecret: string;
  try {
    const { data, error } = await admin.rpc("get_stripe_webhook_secret");
    if (error) throw error;
    if (!data) throw new Error("stripe_webhook_secret ausente no Vault (rode stripe-webhook-setup)");
    webhookSecret = data as string;
  } catch (err) {
    log("vault fetch failed:", (err as Error).message);
    return new Response(JSON.stringify({ error: "webhook_secret_unavailable" }), { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    log("signature verification failed:", (err as Error).message);
    return new Response(JSON.stringify({ error: "invalid_signature" }), { status: 400 });
  }

  // Idempotência
  const { data: seen } = await admin
    .from("stripe_events_processados")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();
  if (seen) {
    log("evento já processado:", event.id);
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const usuario_id =
          (session.metadata?.usuario_id as string | undefined) ??
          (session.client_reference_id as string | undefined);
        const plano_codigo = (session.metadata?.plano_codigo as string | undefined) ?? "pro";
        const periodo = (session.metadata?.periodo as string | undefined) ?? null;
        if (!usuario_id) throw new Error("usuario_id ausente no metadata");
        const plano_id = await getPlanoIdByCodigo(plano_codigo);
        if (!plano_id) throw new Error(`plano ${plano_codigo} não encontrado`);

        let fim: string | null = null;
        let subId: string | null = null;
        if (session.subscription) {
          subId = session.subscription as string;
          const sub = await stripe.subscriptions.retrieve(subId);
          if (sub.current_period_end) {
            fim = new Date(sub.current_period_end * 1000).toISOString();
          }
        }

        await upsertAssinatura({
          usuario_id,
          plano_id,
          status: "ativa",
          periodo,
          inicio: new Date().toISOString(),
          fim,
          stripe_customer_id: (session.customer as string | null) ?? null,
          stripe_subscription_id: subId,
          origem: "stripe",
        });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const usuario_id = (sub.metadata?.usuario_id as string | undefined) ?? null;
        const plano_codigo = (sub.metadata?.plano_codigo as string | undefined) ?? "pro";
        const periodo = (sub.metadata?.periodo as string | undefined) ?? null;
        const fim = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        const stripeStatus = sub.status;
        const status: UpsertPayload["status"] =
          stripeStatus === "active" || stripeStatus === "trialing"
            ? "ativa"
            : stripeStatus === "canceled" || stripeStatus === "unpaid" || stripeStatus === "incomplete_expired"
              ? "cancelada"
              : "expirada";

        if (usuario_id) {
          const plano_id = await getPlanoIdByCodigo(plano_codigo);
          if (!plano_id) throw new Error(`plano ${plano_codigo} não encontrado`);
          await upsertAssinatura({
            usuario_id,
            plano_id,
            status,
            periodo,
            inicio: new Date().toISOString(),
            fim,
            stripe_customer_id: sub.customer as string,
            stripe_subscription_id: sub.id,
            origem: "stripe",
          });
        } else {
          const row = await findByStripeIds({
            subscription_id: sub.id,
            customer_id: sub.customer as string,
          });
          if (row) {
            const { error } = await admin
              .from("assinaturas")
              .update({
                status,
                fim,
                stripe_subscription_id: sub.id,
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.id);
            if (error) throw error;
          } else {
            log("subscription.updated sem match local, ignorando", sub.id);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const row = await findByStripeIds({
          subscription_id: sub.id,
          customer_id: sub.customer as string,
        });
        if (row) {
          const { error } = await admin
            .from("assinaturas")
            .update({
              status: "cancelada",
              fim: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          if (error) throw error;
          log("assinatura cancelada", row.id);
        } else {
          log("subscription.deleted sem match local", sub.id);
        }
        break;
      }

      default:
        log("evento ignorado:", event.type);
    }

    await admin.from("stripe_events_processados").insert({
      event_id: event.id,
      tipo: event.type,
      payload: event as unknown as Record<string, unknown>,
    });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    log("erro processando evento", event.id, event.type, (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
