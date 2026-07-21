import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_noticias",
  title: "List agro news",
  description: "List the latest Brazilian agribusiness news collected by Entreposto Virtual.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many news items to return (1-50)."),
    tema: z.string().optional().describe("Optional theme filter (e.g. soja, milho, cafe, boi)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, tema }) => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let q = supabase
      .from("noticias")
      .select("titulo, resumo, link, fonte, tema, publicado_em")
      .is("deleted_at", null)
      .order("publicado_em", { ascending: false })
      .limit(limit);
    if (tema) q = q.eq("tema", tema);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { items: data ?? [] },
    };
  },
});
