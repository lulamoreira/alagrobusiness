import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ShieldCheck,
  Search,
  Eye,
  PauseCircle,
  PlayCircle,
  Trash2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatPrice(value: number, moeda: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: moeda }).format(value);
  } catch {
    return `${value} ${moeda}`;
  }
}
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/moderacao")({
  component: AdminModeracaoPage,
});

type AdStatus = "ativo" | "pausado" | "vendido";
type AdAction = "pausar" | "reativar" | "remover";
type Categoria = "fruta" | "grao" | "legumes" | "vegetal";

interface AdRow {
  id: string;
  titulo: string;
  produto: string;
  categoria: Categoria;
  status: AdStatus;
  preco: number;
  moeda: string;
  descricao: string | null;
  fotos: string[] | null;
  created_at: string;
  vendedor_id: string;
  destaque_ate: string | null;
  destaque_origem: string | null;
  vendedor?: { nome_completo: string | null; email: string | null } | null;
}

function AdminModeracaoPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AdStatus>("all");
  const [categoriaFilter, setCategoriaFilter] = useState<"all" | Categoria>("all");
  const [detail, setDetail] = useState<AdRow | null>(null);
  const [pending, setPending] = useState<{ ad: AdRow; action: AdAction } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  const isAdmin = profile?.tipo_perfil === "admin";

  useEffect(() => {
    if (profile && !isAdmin) navigate({ to: "/painel" });
  }, [profile, isAdmin, navigate]);

  const { data: ads = [], isLoading } = useQuery({
    queryKey: ["admin_ads", statusFilter, categoriaFilter],
    enabled: !!isAdmin,
    queryFn: async (): Promise<AdRow[]> => {
      let q = supabase
        .from("anuncios")
        .select(
          "id, titulo, produto, categoria, status, preco, moeda, descricao, fotos, created_at, vendedor_id, destaque_ate, destaque_origem, vendedor:profiles!anuncios_vendedor_id_fkey(nome_completo, email)",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (categoriaFilter !== "all") q = q.eq("categoria", categoriaFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AdRow[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return ads;
    return ads.filter(
      (a) =>
        a.titulo.toLowerCase().includes(s) ||
        a.produto.toLowerCase().includes(s),
    );
  }, [ads, search]);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { day: "2-digit", month: "2-digit", year: "numeric" }),
    [i18n.language],
  );

  const openConfirm = (ad: AdRow, action: AdAction) => {
    setPending({ ad, action });
    setMotivo("");
  };

  const submit = async () => {
    if (!pending) return;
    const motivoTrim = motivo.trim();
    if (!motivoTrim) {
      toast.error(t("adminModeracao.action.motivoRequired"));
      return;
    }
    setBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("admin_moderar_anuncio", {
        p_anuncio_id: pending.ad.id,
        p_acao: pending.action,
        p_motivo: motivoTrim,
      });
      if (error) throw error;
      toast.success(t(`adminModeracao.action.${pending.action}Success`));
      setPending(null);
      setMotivo("");
      await qc.invalidateQueries({ queryKey: ["admin_ads"] });
    } catch (e) {
      const msg = (e as { message?: string }).message ?? String(e);
      toast.error(t("adminModeracao.action.error", { detail: msg }));
    } finally {
      setBusy(false);
    }
  };

  if (profile && !isAdmin) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
        {t("adminModeracao.onlyAdmin")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">
            {t("adminModeracao.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("adminModeracao.subtitle")}</p>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card/60 p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <Label className="text-xs">{t("adminModeracao.searchLabel")}</Label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("adminModeracao.searchPlaceholder")}
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-full md:w-52">
            <Label className="text-xs">{t("adminModeracao.filterStatus")}</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("adminModeracao.filterAll")}</SelectItem>
                <SelectItem value="ativo">{t("adminModeracao.status.ativo")}</SelectItem>
                <SelectItem value="pausado">{t("adminModeracao.status.pausado")}</SelectItem>
                <SelectItem value="vendido">{t("adminModeracao.status.vendido")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-52">
            <Label className="text-xs">{t("adminModeracao.filterCategoria")}</Label>
            <Select
              value={categoriaFilter}
              onValueChange={(v) => setCategoriaFilter(v as typeof categoriaFilter)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("adminModeracao.filterAll")}</SelectItem>
                <SelectItem value="fruta">{t("adminModeracao.categoria.fruta")}</SelectItem>
                <SelectItem value="grao">{t("adminModeracao.categoria.grao")}</SelectItem>
                <SelectItem value="legumes">{t("adminModeracao.categoria.legumes")}</SelectItem>
                <SelectItem value="vegetal">{t("adminModeracao.categoria.vegetal")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("adminModeracao.loading")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t("adminModeracao.empty")}
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <ul className="space-y-3 md:hidden">
              {filtered.map((ad) => (
                <li key={ad.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{ad.titulo}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {ad.produto} · {t(`adminModeracao.categoria.${ad.categoria}`)}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        ad.status === "ativo" && "bg-primary/15 text-primary",
                        ad.status === "pausado" && "bg-muted text-muted-foreground",
                        ad.status === "vendido" && "bg-secondary/40 text-secondary-foreground",
                      )}
                    >
                      {t(`adminModeracao.status.${ad.status}`)}
                    </span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">{t("adminModeracao.columns.vendedor")}</dt>
                    <dd className="min-w-0 truncate text-right">{ad.vendedor?.nome_completo ?? "—"}</dd>
                    <dt className="text-muted-foreground">{t("adminModeracao.columns.preco")}</dt>
                    <dd className="text-right font-mono">{formatPrice(ad.preco, ad.moeda, i18n.language)}</dd>
                    <dt className="text-muted-foreground">{t("adminModeracao.columns.data")}</dt>
                    <dd className="text-right text-muted-foreground">{dateFmt.format(new Date(ad.created_at))}</dd>
                  </dl>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setDetail(ad)} title={t("adminModeracao.action.ver")}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {ad.status !== "pausado" && (
                      <Button size="sm" variant="outline" onClick={() => openConfirm(ad, "pausar")}>
                        <PauseCircle className="mr-1 h-4 w-4" />
                        {t("adminModeracao.action.pausar")}
                      </Button>
                    )}
                    {ad.status === "pausado" && (
                      <Button size="sm" variant="outline" onClick={() => openConfirm(ad, "reativar")}>
                        <PlayCircle className="mr-1 h-4 w-4" />
                        {t("adminModeracao.action.reativar")}
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => openConfirm(ad, "remover")}>
                      <Trash2 className="mr-1 h-4 w-4" />
                      {t("adminModeracao.action.remover")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">{t("adminModeracao.columns.titulo")}</th>
                    <th className="px-3 py-2 text-left">{t("adminModeracao.columns.vendedor")}</th>
                    <th className="px-3 py-2 text-right">{t("adminModeracao.columns.preco")}</th>
                    <th className="px-3 py-2 text-left">{t("adminModeracao.columns.status")}</th>
                    <th className="px-3 py-2 text-left">{t("adminModeracao.columns.data")}</th>
                    <th className="px-3 py-2 text-right">{t("adminModeracao.columns.acoes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ad) => (
                    <tr key={ad.id} className="border-t border-border/60">
                      <td className="px-3 py-2">
                        <div className="font-medium">{ad.titulo}</div>
                        <div className="text-xs text-muted-foreground">
                          {ad.produto} · {t(`adminModeracao.categoria.${ad.categoria}`)}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{ad.vendedor?.nome_completo ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{ad.vendedor?.email ?? ""}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatPrice(ad.preco, ad.moeda, i18n.language)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            ad.status === "ativo" && "bg-primary/15 text-primary",
                            ad.status === "pausado" && "bg-muted text-muted-foreground",
                            ad.status === "vendido" && "bg-secondary/40 text-secondary-foreground",
                          )}
                        >
                          {t(`adminModeracao.status.${ad.status}`)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {dateFmt.format(new Date(ad.created_at))}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setDetail(ad)} title={t("adminModeracao.action.ver")}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {ad.status !== "pausado" && (
                            <Button size="sm" variant="outline" onClick={() => openConfirm(ad, "pausar")}>
                              <PauseCircle className="mr-1 h-4 w-4" />
                              {t("adminModeracao.action.pausar")}
                            </Button>
                          )}
                          {ad.status === "pausado" && (
                            <Button size="sm" variant="outline" onClick={() => openConfirm(ad, "reativar")}>
                              <PlayCircle className="mr-1 h-4 w-4" />
                              {t("adminModeracao.action.reativar")}
                            </Button>
                          )}
                          <Button size="sm" variant="destructive" onClick={() => openConfirm(ad, "remover")}>
                            <Trash2 className="mr-1 h-4 w-4" />
                            {t("adminModeracao.action.remover")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>

        )}
      </section>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.titulo ?? t("adminModeracao.detail.title")}</DialogTitle>
            <DialogDescription>
              {detail ? `${detail.produto} · ${t(`adminModeracao.categoria.${detail.categoria}`)}` : ""}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("adminModeracao.detail.descricao")}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {detail.descricao?.trim() || t("adminModeracao.detail.sem_descricao")}
                </p>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("adminModeracao.detail.fotos")}
                </div>
                {detail.fotos && detail.fotos.length > 0 ? (
                  <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                    {detail.fotos.map((url, i) => (
                      <img
                        key={`${url}-${i}`}
                        src={url}
                        alt=""
                        className="h-32 w-full rounded-lg object-cover"
                        loading="lazy"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("adminModeracao.detail.sem_fotos")}
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>
              {t("adminModeracao.detail.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm + motivo */}
      <Dialog
        open={!!pending}
        onOpenChange={(o) => {
          if (!o && !busy) {
            setPending(null);
            setMotivo("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending ? t(`adminModeracao.action.${pending.action}ConfirmTitle`) : ""}
            </DialogTitle>
            <DialogDescription>
              {pending
                ? t(`adminModeracao.action.${pending.action}ConfirmDesc`, {
                    titulo: pending.ad.titulo,
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo" className="text-xs">
              {t("adminModeracao.action.motivoLabel")}
            </Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={t("adminModeracao.action.motivoPlaceholder")}
              rows={3}
              disabled={busy}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPending(null);
                setMotivo("");
              }}
              disabled={busy}
            >
              {t("adminModeracao.action.cancel")}
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("adminModeracao.action.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
