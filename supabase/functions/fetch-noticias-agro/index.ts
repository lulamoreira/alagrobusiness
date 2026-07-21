// Lê feeds RSS do agro, faz parse e upsert em noticias (link único parcial).
// Soft-delete de notícias com publicado_em > 60 dias.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

async function checkCronAuth(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<Response | null> {
  const provided = req.headers.get("x-cron-secret");
  if (!provided) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: expected, error } = await supabase.rpc("get_cron_secret");
  if (error || !expected) {
    return new Response(JSON.stringify({ error: "Server auth not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

const FEEDS: { fonte: string; url: string }[] = [
  { fonte: "Canal Rural", url: "https://www.canalrural.com.br/feed/" },
  { fonte: "Globo Rural", url: "https://g1.globo.com/rss/g1/economia/agronegocios/" },
  { fonte: "Campo & Negócios", url: "https://revistacampoenegocios.com.br/feed/" },
];

// Ordem importa: temas mais específicos vêm ANTES dos genéricos (derivarTema
// retorna a primeira ocorrência). Cobre categorias de topo do catálogo agro
// + temas transversais (clima, mercado, tecnologia).
const TEMAS: { key: string; words: string[] }[] = [
  // Culturas específicas
  { key: "soja", words: ["soja"] },
  { key: "milho", words: ["milho"] },
  { key: "trigo", words: ["trigo"] },
  { key: "algodao", words: ["algodão", "algodao"] },
  { key: "cafe", words: ["café", "cafe", "cacau", "chá ", " cha "] },
  // Categorias de topo (agro)
  { key: "graos_cereais", words: ["grão", "grao", "grãos", "graos", "cereais", "cevada", "aveia", "arroz", "sorgo", "centeio"] },
  { key: "oleaginosas", words: ["oleaginosa", "girassol", "canola", "amendoim", "gergelim", "mamona"] },
  { key: "frutas", words: ["fruta", "frutas", "laranja", "banana", "manga", "uva", "maçã", "maca", "melancia", "abacaxi", "limão", "limao", "mamão", "mamao", "citros", "citrus"] },
  { key: "hortalicas", words: ["hortaliça", "hortalica", "hortaliças", "hortalicas", "legume", "verdura", "tomate", "alface", "cebola", "cenoura", "batata"] },
  { key: "raizes_tuberculos", words: ["mandioca", "tubérculo", "tuberculo", "raiz", "raízes", "raizes", "batata-doce", "inhame"] },
  { key: "cana_acucar", words: ["cana", "cana-de-açúcar", "cana de açucar", "açúcar", "acucar", "etanol", "usina", "sucroenergético", "sucroenergetico"] },
  { key: "aves", words: ["aves", "frango", "avicultura", "avícola", "avicola", "poedeira", "ovo", "ovos"] },
  { key: "aquicultura", words: ["aquicultura", "peixe", "peixes", "pesca", "tilápia", "tilapia", "camarão", "camarao", "piscicultura"] },
  { key: "leite_derivados", words: ["leite", "laticínio", "laticinio", "laticínios", "laticinios", "queijo", "iogurte", "manteiga", "lácteo", "lacteo"] },
  { key: "apicultura", words: ["apicultura", "abelha", "abelhas", "mel", "própolis", "propolis"] },
  { key: "flores_plantas", words: ["flor", "flores", "floricultura", "planta ornamental", "ornamentais", "jardinagem", "muda", "mudas"] },
  { key: "fibras_florestal", words: ["fibra", "fibras", "sisal", "juta", "florestal", "eucalipto", "pinus", "madeira", "reflorestamento", "silvicultura", "celulose"] },
  { key: "insumos", words: ["fertilizante", "adubo", "defensivo", "agroquímico", "agroquimico", "semente", "sementes", "insumo", "insumos", "calcário", "calcario", "herbicida", "fungicida", "inseticida"] },
  { key: "maquinas", words: ["máquina", "maquina", "máquinas", "maquinas", "implemento", "trator", "colheitadeira", "pulverizador", "plantadeira"] },
  { key: "pecuaria", words: ["pecuária", "pecuaria", "boi", "gado", "bovino", "frigorífico", "frigorifico", "suíno", "suino", "suinocultura", "caprino", "ovino"] },
  // Transversais
  { key: "clima", words: ["clima", "chuva", "seca", "tempo", "geada", "estiagem", "temperatura"] },
  { key: "mercado", words: ["mercado", "preço", "preco", "cotação", "cotacao", "dólar", "dolar", "exportação", "exportacao", "safra", "colheita"] },
  { key: "tecnologia", words: ["tecnologia", "agtech", "drone", "ia ", "inteligência artificial", "inovação", "inovacao", "digital"] },
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

  const authErr = await checkCronAuth(req, supabase);
  if (authErr) return authErr;

  const summary: Record<string, unknown> = { feeds: [], inserted: 0, softDeleted: 0, errors: [] };

  for (const feed of FEEDS) {
    try {
      const resp = await fetch(feed.url, {
        headers: { "User-Agent": "EntrepostoVirtual/1.0 (+rss-bot)" },
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
