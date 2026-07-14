import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Pause, Play, CheckCircle2, Trash2, Sparkles, Warehouse, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PillButton } from "@/components/PillButton";
import { deleteAnuncioPhotos } from "@/lib/storage";
import { AnuncioPhoto } from "@/components/AnuncioCard";
import { formatPrice, type CambioRow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { MarkAsSoldDialog } from "@/components/MarkAsSoldDialog";
import { DestaqueBuyDialog } from "@/components/DestaqueBuyDialog";
import { EstoquePanel } from "@/components/EstoquePanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/vender/")({ component: SellPage });

type AnuncioRow = {
  id: string;
  titulo: string;
  produto: string;
  status: "ativo" | "pausado" | "vendido";
  preco: number;
  moeda: "BRL" | "USD" | "EUR";
  preco_unidade_id: string;
  quantidade_disponivel: number;
  quantidade_unidade_id: string;
  fotos: string[];
  updated_at: string;
  estado: string | null;
  cidade: string | null;
  destaque_ate: string | null;
  tipo_oferta: "produto" | "servico" | null;

};

function PhotoThumb({ path, productLabel }: { path: string | null | undefined; productLabel: string }) {
  return (
    <div className="group h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
      <AnuncioPhoto path={path} productLabel={productLabel} compact />
    </div>
  );
}

function statusClass(status: AnuncioRow["status"]) {
  if (status === "ativo") return "bg-primary/15 text-primary";
  if (status === "pausado") return "bg-yellow-500/15 text-yellow-500";
  return "bg-muted text-muted-foreground";
}

function SellPage() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [soldDialog, setSoldDialog] = useState<AnuncioRow | null>(null);
  const [soldToast, setSoldToast] = useState<string | null>(null);
  const [destaqueDialog, setDestaqueDialog] = useState<AnuncioRow | null>(null);
  const [estoqueDialog, setEstoqueDialog] = useState<AnuncioRow | null>(null);

  const { data: anuncios, isLoading } = useQuery({
    queryKey: ["my_anuncios", user?.id],
    queryFn: async () =>
      (
        await supabase
          .from("anuncios")
          .select("*")
          .eq("vendedor_id", user!.id)
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
      ).data ?? [],
    enabled: !!user,
  });

  const { data: cotacoes } = useQuery({
    queryKey: ["cotacoes_dolar"],
    queryFn: async () => (await supabase.from("cotacoes_dolar").select("tipo, valor_brl")).data ?? [],
    staleTime: 1000 * 60 * 30,
  });

  const { data: unidades } = useQuery({
    queryKey: ["unidades_all"],
    queryFn: async () =>
      (await supabase.from("unidades").select("*").is("deleted_at", null)).data ?? [],
    staleTime: 1000 * 60 * 30,
  });

  const updateStatus = async (id: string, status: "ativo" | "pausado" | "vendido") => {
    setBusyId(id);
    setActionError(null);
    const { error } = await supabase.from("anuncios").update({ status }).eq("id", id);
    setBusyId(null);
    if (error) setActionError(t("sell.actionError"));
    else qc.invalidateQueries({ queryKey: ["my_anuncios", user?.id] });
  };

  const softDelete = async (id: string, fotos: string[]) => {
    if (!confirm(t("sell.confirmDelete"))) return;
    setBusyId(id);
    setActionError(null);
    const { error } = await supabase.from("anuncios").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    setBusyId(null);
    if (error) {
      setActionError(t("sell.actionError"));
      return;
    }
    // Best-effort: clean up storage
    deleteAnuncioPhotos(fotos).catch(() => undefined);
    qc.invalidateQueries({ queryKey: ["my_anuncios", user?.id] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold md:text-3xl">{t("sell.title")}</h1>
        <PillButton onClick={() => navigate({ to: "/vender/novo" })}>
          <Plus className="h-4 w-4" />
          {t("sell.newListing")}
        </PillButton>
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !anuncios || anuncios.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">{t("sell.noListings")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {(anuncios as AnuncioRow[]).map((a) => {
            const unit = unidades?.find((u) => u.id === a.preco_unidade_id);
            const price = formatMoney(
              a.preco,
              profile?.moeda_preferida ?? "BRL",
              profile?.tipo_dolar_preferido ?? "comercial",
              cotacoes ?? [],
              i18n.language,
            );
            const statusLabel =
              a.status === "ativo"
                ? t("sell.statusActive")
                : a.status === "pausado"
                  ? t("sell.statusPaused")
                  : t("sell.statusSold");
            const destaqueAtivo = a.destaque_ate && new Date(a.destaque_ate) > new Date();
            const isProduto = (a.tipo_oferta ?? "produto") === "produto";
            return (
              <li
                key={a.id}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                {/* CONTEÚDO */}
                <div className="flex gap-4 p-4">
                  <PhotoThumb path={a.fotos?.[0]} productLabel={a.produto} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", statusClass(a.status))}>
                        {statusLabel}
                      </span>
                      {destaqueAtivo && (
                        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {t("sell.destaqueAteShort", { data: new Date(a.destaque_ate!).toLocaleDateString(i18n.language, { day: "2-digit", month: "2-digit" }) })}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1.5 truncate font-display text-base font-bold">{a.produto}</h2>
                    <p className="truncate text-xs text-muted-foreground">{a.titulo}</p>
                    <p className="mt-1 flex items-baseline gap-2 overflow-hidden whitespace-nowrap text-sm font-semibold text-primary">
                      <span className="truncate">
                        {price} {unit ? `/ ${t(`units.${unit.nome_chave}`)}` : ""}
                      </span>
                      <span className="shrink-0 text-[10px] font-normal text-muted-foreground">
                        · {t("sell.updatedAt")} {new Date(a.updated_at).toLocaleDateString(i18n.language, { day: "2-digit", month: "2-digit" })}
                      </span>
                    </p>
                  </div>
                </div>

                {/* FOOTER de ações */}
                <div className="flex flex-wrap items-center gap-2 border-t border-border bg-background/30 px-3 py-2">
                  <Link
                    to="/anuncio/$id"
                    params={{ id: a.id }}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
                    aria-label="↗"
                  >
                    ↗
                  </Link>
                  <Link
                    to="/vender/editar/$id"
                    params={{ id: a.id }}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    <Pencil className="h-3 w-3" />
                    {t("sell.edit")}
                  </Link>
                  {isProduto && (
                    <button
                      type="button"
                      onClick={() => setEstoqueDialog(a)}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
                    >
                      <Warehouse className="h-3 w-3" />
                      {t("sell.estoqueBtn")}
                    </button>
                  )}
                  {a.status === "ativo" && (
                    <button
                      type="button"
                      onClick={() => setDestaqueDialog(a)}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                    >
                      <Sparkles className="h-3 w-3" />
                      {t("detail.destaque.buyCta")}
                    </button>
                  )}
                  <div className="ml-auto">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={t("sell.moreActions")}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        {a.status !== "vendido" && (
                          <DropdownMenuItem
                            disabled={busyId === a.id}
                            onSelect={() => updateStatus(a.id, a.status === "ativo" ? "pausado" : "ativo")}
                          >
                            {a.status === "ativo" ? <Pause className="mr-2 h-3.5 w-3.5" /> : <Play className="mr-2 h-3.5 w-3.5" />}
                            {a.status === "ativo" ? t("sell.pause") : t("sell.activate")}
                          </DropdownMenuItem>
                        )}
                        {a.status !== "vendido" && (
                          <DropdownMenuItem
                            disabled={busyId === a.id}
                            onSelect={() => setSoldDialog(a)}
                          >
                            <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                            {t("sell.markSold")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={busyId === a.id}
                          onSelect={() => softDelete(a.id, a.fotos)}
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          {t("sell.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {soldToast && (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full border border-primary/40 bg-primary/15 px-4 py-2 text-xs font-medium text-primary backdrop-blur md:bottom-6">
          {soldToast}
        </div>
      )}

      {soldDialog && (
        <MarkAsSoldDialog
          open={!!soldDialog}
          anuncio={soldDialog}
          onClose={() => setSoldDialog(null)}
          onSuccess={() => {
            setSoldToast(t("sell.markSoldDialog.success"));
            window.setTimeout(() => setSoldToast(null), 3000);
          }}
        />
      )}
      {destaqueDialog && (
        <DestaqueBuyDialog
          open={!!destaqueDialog}
          anuncioId={destaqueDialog.id}
          destaqueAte={destaqueDialog.destaque_ate}
          onClose={() => setDestaqueDialog(null)}
        />
      )}
      {estoqueDialog && (
        <EstoqueDialog
          anuncio={estoqueDialog}
          unidades={unidades ?? []}
          onClose={() => setEstoqueDialog(null)}
        />
      )}
    </div>
  );
}

function EstoqueDialog({
  anuncio,
  unidades,
  onClose,
}: {
  anuncio: AnuncioRow;
  unidades: Array<{ id: string; nome_chave: string }>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const unidadeChave =
    unidades.find((u) => u.id === anuncio.quantidade_unidade_id)?.nome_chave ?? null;

  const { data: centros, isLoading } = useQuery({
    queryKey: ["anuncio_centros_full", anuncio.id],
    queryFn: async () => {
      const { data: links } = await supabase
        .from("anuncio_centros")
        .select("centro_id")
        .eq("anuncio_id", anuncio.id);
      const ids = (links ?? []).map((l) => l.centro_id);
      if (ids.length === 0) return [];
      const { data: cds } = await supabase
        .from("centros_distribuicao")
        .select("id, nome, cidade, estado")
        .in("id", ids)
        .is("deleted_at", null);
      return cds ?? [];
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("sell.estoqueDialog.title", { produto: anuncio.produto })}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : !centros || centros.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("sell.estoqueDialog.noCd")}</p>
            <PillButton
              onClick={() => {
                onClose();
                navigate({ to: "/vender/editar/$id", params: { id: anuncio.id } });
              }}
            >
              {t("sell.estoqueDialog.linkCta")}
            </PillButton>
          </div>
        ) : (
          <div className="space-y-4">
            {centros.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border bg-card/60 p-4">
                <p className="mb-3 font-display text-sm font-semibold text-foreground">
                  {c.nome}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    · {[c.cidade, c.estado].filter(Boolean).join(" / ") || "—"}
                  </span>
                </p>
                <EstoquePanel
                  anuncioId={anuncio.id}
                  centroId={c.id}
                  unidadeChave={unidadeChave}
                />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
