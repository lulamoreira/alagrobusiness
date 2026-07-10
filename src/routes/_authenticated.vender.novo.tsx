import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { AnuncioForm } from "@/components/AnuncioForm";

const searchSchema = z.object({
  tipo: fallback(z.string(), "").default(""),
  canal: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/vender/novo")({
  validateSearch: zodValidator(searchSchema),
  component: NovoAnuncioPage,
});

function NovoAnuncioPage() {
  const { tipo, canal } = Route.useSearch();
  const defaultTipoOferta = tipo === "servico" ? "servico" : tipo === "produto" ? "produto" : undefined;
  return (
    <AnuncioForm
      mode="create"
      defaultTipoOferta={defaultTipoOferta}
      canalStartups={canal === "startups"}
    />
  );
}
