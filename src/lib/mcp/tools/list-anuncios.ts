import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_anuncios",
  title: "List marketplace listings",
  description: "List active public marketplace ads (anúncios) on Entreposto Virtual.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many ads to return (1-50)."),
    categoria: z.string().optional().describe("Optional category filter (e.g. fruta, grao, legumes, vegetal)."),
    produto: z.string().optional().describe("Optional product name filter (case-insensitive contains)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, categoria, produto }) => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let q = supabase
      .from("anuncios")
      .select("id, titulo, produto, categoria, preco, moeda, unidade, quantidade, estado, cidade, created_at")
      .is("deleted_at", null)
      .eq("status", "ativo")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (categoria) q = q.eq("categoria", categoria);
    if (produto) q = q.ilike("produto", `%${produto}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { items: data ?? [] },
    };
  },
});
