import { defineMcp } from "@lovable.dev/mcp-js";
import listNoticiasTool from "./tools/list-noticias";
import getDolarTool from "./tools/get-dolar";
import listAnunciosTool from "./tools/list-anuncios";

export default defineMcp({
  name: "agrobusiness-mcp",
  title: "Entreposto Virtual MCP",
  version: "0.1.0",
  instructions:
    "Public read-only tools for Entreposto Virtual: latest Brazilian agribusiness news, USD/BRL exchange rate, and active marketplace listings.",
  tools: [listNoticiasTool, getDolarTool, listAnunciosTool],
});
