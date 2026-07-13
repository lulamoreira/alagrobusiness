import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AnuncioForm, type AnuncioFormInitial } from "@/components/AnuncioForm";

export const Route = createFileRoute("/_authenticated/vender/editar/$id")({
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["anuncio_edit", id],
    queryFn: async () =>
      (await supabase.from("anuncios").select("*").eq("id", id).is("deleted_at", null).maybeSingle()).data,
  });

  const { data: centrosVinc } = useQuery({
    queryKey: ["anuncio_centros_edit", id],
    queryFn: async () =>
      (await supabase.from("anuncio_centros").select("centro_id").eq("anuncio_id", id)).data ?? [],
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">{t("detail.notFound")}</p>;

  const initial: AnuncioFormInitial = {
    id: data.id,
    titulo: data.titulo,
    descricao: data.descricao,
    categoria: data.categoria,
    catalogo_item_id: data.catalogo_item_id ?? null,

    produto: data.produto,
    qualidade: data.qualidade,
    data_colheita: data.data_colheita,
    preco: Number(data.preco),
    moeda: data.moeda,
    preco_unidade_id: data.preco_unidade_id,
    quantidade_disponivel: Number(data.quantidade_disponivel),
    quantidade_unidade_id: data.quantidade_unidade_id,
    aceita_permuta: data.aceita_permuta,
    permuta_descricao: data.permuta_descricao,
    modalidade_entrega: data.modalidade_entrega,
    raio_entrega_km: data.raio_entrega_km,
    certificacoes: data.certificacoes ?? [],
    estado: data.estado,
    cidade: data.cidade,
    cep: data.cep,
    fotos: data.fotos ?? [],
    tipo_oferta: (data.tipo_oferta ?? "produto") as "produto" | "servico",
    servico_modelo_cobranca: (data.servico_modelo_cobranca ?? null) as "hora" | "projeto" | "mensal" | null,
    servico_area_atuacao: data.servico_area_atuacao ?? null,
    servico_prazo: data.servico_prazo ?? null,
  };
  return <AnuncioForm mode="edit" initial={initial} />;
}
