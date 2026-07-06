import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "get_cotacao_dolar",
  title: "Get USD/BRL quote",
  description: "Get the latest USD/BRL exchange rate tracked by ALAGROBUSINESS.",
  inputSchema: {
    tipo: z
      .enum(["comercial", "turismo", "paralelo"])
      .default("comercial")
      .describe("Which USD quote type to fetch."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tipo }) => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("cotacoes_dolar")
      .select("tipo, valor_brl, atualizado_em")
      .is("deleted_at", null)
      .eq("tipo", tipo)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: `No quote available for ${tipo}` }] };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: data,
    };
  },
});
