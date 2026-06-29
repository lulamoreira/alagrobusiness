// Lê feeds RSS do agro, faz parse e upsert em noticias (link único parcial).
// Soft-delete de notícias com publicado_em > 60 dias.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEEDS: { fonte: string; url: string }[] = [
  { fonte: "Canal Rural", url: "https://www.canalrural.com.br/feed/" },
  { fonte: "Globo Rural", url: "https://g1.globo.com/rss/g1/economia/agronegocios/" },
  { fonte: "Campo & Negócios", url: "https://revistacampoenegocios.com.br/feed/" },
];

const TEMAS: { key: string; words: string[] }[] = [
  { key: "soja", words: ["soja"] },
  { key: "cafe", words: ["café", "cafe"] },
  { key: "milho", words: ["milho"] },
  { key: "clima", words: ["clima", "chuva", "seca", "tempo", "geada"] },
  { key: "mercado", words: ["mercado", "preço", "preco", "cotação", "cotacao", "dólar", "dolar", "exportação", "exportacao"] },
  { key: "tecnologia", words: ["tecnologia", "agtech", "drone", "ia ", "inteligência artificial", "inovação", "inovacao"] },
  { key: "pecuaria", words: ["pecuária", "pecuaria", "boi", "gado", "bovino", "frigorífico", "frigorifico"] },
  { key: "trigo", words: ["trigo"] },
  { key: "algodao", words: ["algodão", "algodao"] },
];

function derivarTema(titulo: string, resumo: string): string {
  const txt = `${titulo} ${resumo}`.toLowerCase();
  for (const t of TEMAS) {
    if (t.words.some((w) => txt.includes(w))) return t.key;
  }
  return "geral";
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function pick(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? decodeEntities(m[1]) : null;
}

function parseRSS(xml: string): { titulo: string; link: string; resumo: string; publicado_em: string | null }[] {
  const items: { titulo: string; link: string; resumo: string; publicado_em: string | null }[] = [];
  const itemRe = /<item[\s\S]*?<\/item>/gi;
  const matches = xml.match(itemRe) ?? [];
  for (const block of matches) {
    const titulo = pick(block, "title") ?? "";
    const link = pick(block, "link") ?? "";
    const resumo = pick(block, "description") ?? "";
    const pub = pick(block, "pubDate");
    let publicado_em: string | null = null;
    if (pub) {
      const d = new Date(pub);
      if (!isNaN(d.getTime())) publicado_em = d.toISOString();
    }
    if (titulo && link) items.push({ titulo, link, resumo: resumo.slice(0, 500), publicado_em });
  }
  return items;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const summary: Record<string, unknown> = { feeds: [], inserted: 0, softDeleted: 0, errors: [] };

  for (const feed of FEEDS) {
    try {
      const resp = await fetch(feed.url, {
        headers: { "User-Agent": "ALAGROBUSINESS/1.0 (+rss-bot)" },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const xml = await resp.text();
      const items = parseRSS(xml);
      const rows = items.map((it) => ({
        titulo: it.titulo,
        link: it.link,
        resumo: it.resumo || null,
        fonte: feed.fonte,
        tema: derivarTema(it.titulo, it.resumo),
        publicado_em: it.publicado_em,
      }));
      if (rows.length === 0) {
        (summary.feeds as unknown[]).push({ fonte: feed.fonte, count: 0, note: "0 items parsed" });
        continue;
      }
      // Manual upsert: índice único é PARCIAL (WHERE deleted_at IS NULL),
      // que PostgREST ON CONFLICT não aceita. Fazemos select+diff+insert/update.
      // Chunk para não estourar tamanho da URL.
      const links = rows.map((r) => r.link);
      const existingMap = new Map<string, string>();
      const CHUNK = 15;
      for (let i = 0; i < links.length; i += CHUNK) {
        const slice = links.slice(i, i + CHUNK);
        const { data: existing, error: selErr } = await supabase
          .from("noticias")
          .select("id, link")
          .in("link", slice)
          .is("deleted_at", null);
        if (selErr) throw selErr;
        for (const e of existing ?? []) existingMap.set(e.link as string, e.id as string);
      }
      const toInsert = rows.filter((r) => !existingMap.has(r.link));
      const toUpdate = rows.filter((r) => existingMap.has(r.link));
      let inserted = 0;
      if (toInsert.length > 0) {
        const { data: ins, error: insErr } = await supabase
          .from("noticias")
          .insert(toInsert)
          .select("id");
        if (insErr) throw insErr;
        inserted = ins?.length ?? 0;
      }
      for (const r of toUpdate) {
        const id = existingMap.get(r.link);
        await supabase
          .from("noticias")
          .update({ titulo: r.titulo, resumo: r.resumo, tema: r.tema, publicado_em: r.publicado_em })
          .eq("id", id!);
      }
      (summary.feeds as unknown[]).push({ fonte: feed.fonte, inserted, updated: toUpdate.length });
      summary.inserted = (summary.inserted as number) + inserted;
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error(`feed ${feed.fonte} falhou:`, msg);
      (summary.errors as unknown[]).push({ fonte: feed.fonte, error: msg });
    }
  }

  // Soft-delete > 60 dias
  try {
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("noticias")
      .update({ deleted_at: new Date().toISOString() })
      .lt("publicado_em", cutoff)
      .is("deleted_at", null)
      .select("id");
    if (error) throw error;
    summary.softDeleted = data?.length ?? 0;
  } catch (err) {
    console.error("soft-delete falhou:", err);
    (summary.errors as unknown[]).push({ stage: "soft-delete", error: String(err) });
  }

  return new Response(JSON.stringify({ ok: true, summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
