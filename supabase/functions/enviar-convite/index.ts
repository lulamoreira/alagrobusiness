// Envia convite de cortesia por e-mail (Resend). Se não houver RESEND_API_KEY,
// retorna o link para envio manual, sem falhar.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  email: string;
  token?: string;
  plano?: string;
  dias?: number | null;
  origin?: string; // base URL do app
  lang?: string;
}

const SUBJECTS: Record<string, string> = {
  "pt-BR": "Você ganhou acesso Pro no Entreposto Virtual",
  en: "You've been granted Pro access on Entreposto Virtual",
  es: "Ganaste acceso Pro en Entreposto Virtual",
};

function bodyHtml(lang: string, link: string, dias: number | null | undefined) {
  const dur =
    dias == null
      ? {
          "pt-BR": "acesso Pro por tempo indefinido",
          en: "Pro access with no expiration",
          es: "acceso Pro por tiempo indefinido",
        }
      : {
          "pt-BR": `acesso Pro por ${dias} dias`,
          en: `Pro access for ${dias} days`,
          es: `acceso Pro durante ${dias} días`,
        };
  const t: Record<string, { title: string; p1: string; cta: string; foot: string }> = {
    "pt-BR": {
      title: "Cortesia Entreposto Virtual",
      p1: `Você recebeu <b>${dur["pt-BR"]}</b>. Crie sua conta com este mesmo e-mail para ativar automaticamente.`,
      cta: "Criar conta",
      foot: "Se você não esperava este convite, ignore esta mensagem.",
    },
    en: {
      title: "Entreposto Virtual courtesy",
      p1: `You received <b>${dur.en}</b>. Sign up with this same email to activate automatically.`,
      cta: "Create account",
      foot: "If you were not expecting this invite, ignore this message.",
    },
    es: {
      title: "Cortesía Entreposto Virtual",
      p1: `Recibiste <b>${dur.es}</b>. Crea tu cuenta con este mismo correo para activarla automáticamente.`,
      cta: "Crear cuenta",
      foot: "Si no esperabas esta invitación, ignora este mensaje.",
    },
  };
  const s = t[lang] ?? t["pt-BR"];
  return `<!doctype html><html><body style="font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0b0d10;color:#eaeef2;padding:24px">
    <div style="max-width:520px;margin:0 auto;background:#12161b;border:1px solid #212832;border-radius:16px;padding:28px">
      <h1 style="margin:0 0 12px;color:#22c55e;font-size:20px">${s.title}</h1>
      <p style="line-height:1.55;color:#c9d1d9">${s.p1}</p>
      <p style="text-align:center;margin:28px 0">
        <a href="${link}" style="background:#22c55e;color:#04120a;padding:12px 22px;border-radius:999px;font-weight:700;text-decoration:none">${s.cta}</a>
      </p>
      <p style="font-size:12px;color:#8b949e;word-break:break-all">${link}</p>
      <p style="font-size:12px;color:#6b7480;margin-top:24px">${s.foot}</p>
    </div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { email, token, dias, origin, lang }: Payload = await req.json();
    if (!email || !token) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base = (origin || "").replace(/\/+$/, "");
    const link = `${base}/cadastro?convite=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    const language = lang && SUBJECTS[lang] ? lang : "pt-BR";

    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) {
      return new Response(
        JSON.stringify({ sent: false, mode: "manual", link }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const from = Deno.env.get("RESEND_FROM") || "Entreposto Virtual <onboarding@resend.dev>";
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: SUBJECTS[language],
        html: bodyHtml(language, link, dias ?? null),
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return new Response(
        JSON.stringify({ sent: false, mode: "manual", link, error: detail }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ sent: true, mode: "email", link }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "internal", detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
