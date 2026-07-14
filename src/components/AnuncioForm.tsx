import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DarkInput } from "@/components/DarkInput";
import { PillButton } from "@/components/PillButton";
import { PhotoDropzone, type PhotoItem } from "@/components/PhotoDropzone";
import { uploadAnuncioPhoto, getSignedUrls } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { handlePaywallError } from "@/components/PlanStatus";
import { CatalogoCascade } from "@/components/CatalogoCascade";
import { fetchCatalogoAll, catalogoRootSegmento, catalogoHabilitaCd } from "@/lib/catalogo";
import { CdSelfRegisterDialog } from "@/components/CdSelfRegisterDialog";
import { Warehouse, Globe } from "lucide-react";
import { INCOTERMS, listCountries, type Incoterm } from "@/lib/countries";




const DELIVERY_MODES = ["retirada", "entrega", "ambos"] as const;
const CURRENCIES = ["BRL", "USD", "EUR"] as const;
const CERTIFICATIONS = ["organico", "globalgap", "livre_agrotoxico", "rainforest"] as const;
const OFFER_TYPES = ["produto", "servico"] as const;
const SERVICE_BILLING = ["hora", "projeto", "mensal"] as const;

type DeliveryMode = (typeof DELIVERY_MODES)[number];
type Currency = (typeof CURRENCIES)[number];
type OfferType = (typeof OFFER_TYPES)[number];
type ServiceBilling = (typeof SERVICE_BILLING)[number];

export interface AnuncioFormInitial {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: "fruta" | "grao" | "legumes" | "vegetal" | null;
  catalogo_item_id: string | null;
  produto: string;
  qualidade: string | null;
  data_colheita: string | null;
  preco: number;
  moeda: Currency;
  preco_unidade_id: string;
  quantidade_disponivel: number;
  quantidade_unidade_id: string;
  aceita_permuta: boolean;
  permuta_descricao: string | null;
  modalidade_entrega: DeliveryMode;
  raio_entrega_km: number | null;
  certificacoes: string[];
  estado: string | null;
  cidade: string | null;
  cep: string | null;
  fotos: string[];
  centro_ids?: string[];
  tipo_oferta?: OfferType | null;
  servico_modelo_cobranca?: ServiceBilling | null;
  servico_area_atuacao?: string | null;
  servico_prazo?: string | null;
  para_exportacao?: boolean | null;
  incoterm?: Incoterm | null;
  paises_destino?: string[] | null;
}


interface AnuncioFormProps {
  mode: "create" | "edit";
  initial?: AnuncioFormInitial;
  defaultTipoOferta?: OfferType;
  canalStartups?: boolean;
}


function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition-all",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function AnuncioForm({ mode, initial, defaultTipoOferta, canalStartups }: AnuncioFormProps) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const { data: unidades } = useQuery({
    queryKey: ["unidades_all"],
    queryFn: async () =>
      (await supabase.from("unidades").select("*").is("deleted_at", null).order("nome_chave")).data ?? [],
  });

  const { data: cds } = useQuery({
    queryKey: ["cds_ativos_form", user?.id],
    queryFn: async () =>
      (await supabase
        .from("centros_distribuicao")
        .select("id, nome, cidade, estado, aprovado, created_by")
        .eq("ativo", true)
        .is("deleted_at", null)
        .or(user ? `aprovado.eq.true,created_by.eq.${user.id}` : "aprovado.eq.true")
        .order("nome")).data ?? [],
    staleTime: 1000 * 60 * 5,
  });

  const [titulo, setTitulo] = useState(initial?.titulo ?? "");
  const [descricao, setDescricao] = useState(initial?.descricao ?? "");
  // Legacy `categoria` (enum) preserved as-is on edit; new anuncios leave it null.
  const legacyCategoria = initial?.categoria ?? null;
  const [catalogoItemId, setCatalogoItemId] = useState<string | null>(initial?.catalogo_item_id ?? null);

  const [produto, setProduto] = useState(initial?.produto ?? "");
  const [qualidade, setQualidade] = useState(initial?.qualidade ?? "");
  const [dataColheita, setDataColheita] = useState(initial?.data_colheita ?? "");
  const [preco, setPreco] = useState<string>(initial?.preco != null ? String(initial.preco) : "");
  const [moeda, setMoeda] = useState<Currency>(initial?.moeda ?? "BRL");
  const [precoUnidadeId, setPrecoUnidadeId] = useState<string>(initial?.preco_unidade_id ?? "");
  const [quantidade, setQuantidade] = useState<string>(
    initial?.quantidade_disponivel != null ? String(initial.quantidade_disponivel) : "",
  );
  const [quantidadeUnidadeId, setQuantidadeUnidadeId] = useState<string>(initial?.quantidade_unidade_id ?? "");
  const [aceitaPermuta, setAceitaPermuta] = useState(initial?.aceita_permuta ?? false);
  const [permutaDescricao, setPermutaDescricao] = useState(initial?.permuta_descricao ?? "");
  const [modalidade, setModalidade] = useState<DeliveryMode>(initial?.modalidade_entrega ?? "retirada");
  const [raioKm, setRaioKm] = useState<string>(initial?.raio_entrega_km != null ? String(initial.raio_entrega_km) : "");
  const [certs, setCerts] = useState<string[]>(initial?.certificacoes ?? []);
  const [estado, setEstado] = useState(initial?.estado ?? profile?.estado ?? "");
  const [cidade, setCidade] = useState(initial?.cidade ?? profile?.cidade ?? "");
  const [cep, setCep] = useState(initial?.cep ?? profile?.cep ?? "");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [centroIds, setCentroIds] = useState<string[]>(initial?.centro_ids ?? []);
  const [cdDialogOpen, setCdDialogOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const forcarServico = canalStartups === true || profile?.tipo_perfil === "startup_pme";
  const [tipoOferta, setTipoOferta] = useState<OfferType>(
    forcarServico ? "servico" : (initial?.tipo_oferta ?? defaultTipoOferta ?? "produto"),
  );
  useEffect(() => {
    if (forcarServico && tipoOferta !== "servico") setTipoOferta("servico");
  }, [forcarServico, tipoOferta]);
  const [servicoModelo, setServicoModelo] = useState<ServiceBilling>(
    (initial?.servico_modelo_cobranca as ServiceBilling) ?? "projeto",
  );
  const [servicoArea, setServicoArea] = useState(initial?.servico_area_atuacao ?? "");
  const [servicoPrazo, setServicoPrazo] = useState(initial?.servico_prazo ?? "");
  const [paraExportacao, setParaExportacao] = useState<boolean>(initial?.para_exportacao ?? false);
  const [incoterm, setIncoterm] = useState<Incoterm | "">((initial?.incoterm as Incoterm | null) ?? "");
  const [paisesDestino, setPaisesDestino] = useState<string[]>(initial?.paises_destino ?? []);
  const isServico = tipoOferta === "servico";

  const { data: catalogoNodes } = useQuery({
    queryKey: ["catalogo_all_active"],
    queryFn: () => fetchCatalogoAll(false),
    staleTime: 1000 * 60 * 10,
  });
  const isIndustrial =
    !isServico && catalogoRootSegmento(catalogoNodes ?? [], catalogoItemId) === "industrial";

  // Defaults for units once loaded
  useEffect(() => {
    if (!unidades || unidades.length === 0) return;
    const preferPrice = isIndustrial ? "caixa" : "saca_60";
    const preferQty = isIndustrial ? "caixa" : "tonelada";
    if (!precoUnidadeId)
      setPrecoUnidadeId(unidades.find((u) => u.nome_chave === preferPrice)?.id ?? unidades[0].id);
    if (!quantidadeUnidadeId)
      setQuantidadeUnidadeId(unidades.find((u) => u.nome_chave === preferQty)?.id ?? unidades[0].id);
  }, [unidades, precoUnidadeId, quantidadeUnidadeId, isIndustrial]);

  // When switching to industrial, swap agro-only units to "caixa" automatically.
  // Leaves custom user choices (e.g. "quilo") untouched.
  useEffect(() => {
    if (!isIndustrial || !unidades || unidades.length === 0) return;
    const agroKeys = new Set(["saca_60", "saca_50", "tonelada", "arroba"]);
    const caixa = unidades.find((u) => u.nome_chave === "caixa");
    if (!caixa) return;
    const currentPrice = unidades.find((u) => u.id === precoUnidadeId);
    const currentQty = unidades.find((u) => u.id === quantidadeUnidadeId);
    if (currentPrice && agroKeys.has(currentPrice.nome_chave)) setPrecoUnidadeId(caixa.id);
    if (currentQty && agroKeys.has(currentQty.nome_chave)) setQuantidadeUnidadeId(caixa.id);
  }, [isIndustrial, unidades, precoUnidadeId, quantidadeUnidadeId]);


  // Hydrate existing photos as signed URLs once
  useEffect(() => {
    let mounted = true;
    if (initial?.fotos && initial.fotos.length > 0 && photos.length === 0) {
      getSignedUrls(initial.fotos).then((urls) => {
        if (!mounted) return;
        setPhotos(initial.fotos.map((path, i) => ({ previewUrl: urls[i] ?? "", storagePath: path })));
      });
    }
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.fotos]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const schema = z
    .object({
      titulo: z.string().trim().min(1),
      produto: z.string().trim().min(1),
      preco: z.coerce.number().positive(),
      quantidade: z.coerce.number().positive(),
      precoUnidadeId: z.string().uuid(),
      quantidadeUnidadeId: z.string().uuid(),
      photosLen: z.number().min(1),
    });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!titulo.trim()) e.titulo = "validation.required";
    if (!produto.trim()) e.produto = "validation.required";
    if (!Number(preco) || Number(preco) <= 0) e.preco = "validation.positiveNumber";
    if (!precoUnidadeId) e.precoUnidadeId = "validation.required";
    if (!isServico) {
      if (!Number(quantidade) || Number(quantidade) <= 0) e.quantidade = "validation.positiveNumber";
      if (!quantidadeUnidadeId) e.quantidadeUnidadeId = "validation.required";
    }
    if (photos.length === 0) e.photos = "validation.minOnePhoto";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    if (!validate() || !user) return;
    // Defensive zod parse for type safety on numbers (zod errors mirrored already)
    schema.safeParse({
      titulo,
      produto,
      preco,
      quantidade,
      precoUnidadeId,
      quantidadeUnidadeId,
      photosLen: photos.length,
    });

    setSubmitting(true);
    try {
      // Upload new files
      const finalPaths: string[] = [];
      for (const p of photos) {
        if (p.storagePath) {
          finalPaths.push(p.storagePath);
        } else if (p.file) {
          const path = await uploadAnuncioPhoto(p.file, user.id);
          finalPaths.push(path);
        }
      }

      const payload = {
        vendedor_id: user.id,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        categoria: legacyCategoria,
        catalogo_item_id: catalogoItemId,
        tipo_oferta: tipoOferta,

        produto: produto.trim(),
        qualidade: isServico ? null : (qualidade.trim() || null),
        data_colheita: isServico || isIndustrial ? null : (dataColheita || null),

        preco: Number(preco),
        moeda,
        preco_unidade_id: precoUnidadeId,
        quantidade_disponivel: isServico ? 1 : Number(quantidade),
        quantidade_unidade_id: isServico ? precoUnidadeId : quantidadeUnidadeId,
        aceita_permuta: isServico ? false : aceitaPermuta,
        permuta_descricao: isServico ? null : (aceitaPermuta ? permutaDescricao.trim() || null : null),
        modalidade_entrega: isServico ? "retirada" : modalidade,
        raio_entrega_km: isServico ? null : (modalidade === "retirada" ? null : raioKm ? Number(raioKm) : null),
        certificacoes: isServico || isIndustrial ? [] : certs,
        estado: estado.trim() || null,
        cidade: cidade.trim() || null,
        cep: cep.trim() || null,
        fotos: finalPaths,
        servico_modelo_cobranca: isServico ? servicoModelo : null,
        servico_area_atuacao: isServico ? (servicoArea.trim() || null) : null,
        servico_prazo: isServico ? (servicoPrazo.trim() || null) : null,
      };

      let anuncioId: string | null = initial?.id ?? null;
      if (mode === "create") {
        const insertPayload = { ...payload, em_startups: canalStartups === true };
        const { data: inserted, error } = await supabase
          .from("anuncios")
          .insert(insertPayload)
          .select("id")
          .single();
        if (error) throw error;
        anuncioId = inserted.id;
      } else if (initial) {
        const { error } = await supabase.from("anuncios").update(payload).eq("id", initial.id);
        if (error) throw error;
      }

      // Sync distribution center links (products only; services never have CDs)
      if (anuncioId && !isServico) {
        const desired = new Set(centroIds);
        const existing = mode === "edit" ? new Set(initial?.centro_ids ?? []) : new Set<string>();
        const toAdd = [...desired].filter((c) => !existing.has(c));
        const toRemove = [...existing].filter((c) => !desired.has(c));
        if (toAdd.length > 0) {
          const { error: addErr } = await supabase
            .from("anuncio_centros")
            .insert(toAdd.map((centro_id) => ({ anuncio_id: anuncioId!, centro_id })));
          if (addErr) throw addErr;
        }
        if (toRemove.length > 0) {
          const { error: delErr } = await supabase
            .from("anuncio_centros")
            .delete()
            .eq("anuncio_id", anuncioId)
            .in("centro_id", toRemove);
          if (delErr) throw delErr;
        }
      }

      navigate({ to: "/vender" });
    } catch (err) {
      console.error(err);
      if (handlePaywallError(err, t)) {
        // friendly toast was shown
      } else {
        setServerError(t("form.error"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          {mode === "create" ? t("form.createTitle") : t("form.editTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("form.subtitle")}</p>
      </div>

      {!forcarServico && (
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">{t("offer.type")}</label>
          <div className="flex flex-wrap gap-2">
            {OFFER_TYPES.map((o) => (
              <Pill
                key={o}
                active={tipoOferta === o}
                onClick={() => {
                  if (tipoOferta !== o) {
                    setTipoOferta(o);
                    setCatalogoItemId(null);
                  }
                }}
              >
                {t(`offer.${o}`)}
              </Pill>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <DarkInput
          label={t("form.title")}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder={t("form.titlePh")}
          error={errors.titulo ? t(errors.titulo) : undefined}
        />
        <DarkInput
          label={t("form.product")}
          value={produto}
          onChange={(e) => setProduto(e.target.value)}
          placeholder={t("form.productPh")}
          error={errors.produto ? t(errors.produto) : undefined}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("form.description")}</label>
        <textarea
          rows={4}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder={t("form.descriptionPh")}
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <CatalogoCascade
          label={t("form.category")}
          value={catalogoItemId}
          onChange={setCatalogoItemId}
          tipoFilter={tipoOferta}
        />
        <p className="mt-2 text-[11px] text-muted-foreground">{t("form.catalogoHint")}</p>
      </div>

      {catalogoHabilitaCd(catalogoNodes ?? [], catalogoItemId) && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15 text-primary">
              <Warehouse className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-sm font-bold text-foreground">
                {t("cdSelf.ctaFormTitle")}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("cdSelf.ctaFormDesc")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCdDialogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-110"
            >
              {t("cdSelf.ctaBtn")}
            </button>
          </div>
        </div>
      )}

      <CdSelfRegisterDialog open={cdDialogOpen} onOpenChange={setCdDialogOpen} />


      {!isServico && (
        <div className="grid gap-4 md:grid-cols-2">
          <DarkInput
            label={t("form.quality")}
            value={qualidade}
            onChange={(e) => setQualidade(e.target.value)}
            placeholder={t("form.qualityPh")}
          />
          {!isIndustrial && (
            <DarkInput
              type="date"
              label={t("form.harvestDate")}
              value={dataColheita}
              onChange={(e) => setDataColheita(e.target.value)}
            />
          )}
        </div>
      )}




      <div>
        <label className="mb-2 block text-xs font-medium text-muted-foreground">{t("form.photos")}</label>
        <PhotoDropzone
          items={photos}
          onChange={setPhotos}
          error={errors.photos ? t(errors.photos) : undefined}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <DarkInput
          label={t("form.price")}
          type="number"
          step="0.01"
          min="0"
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
          error={errors.preco ? t(errors.preco) : undefined}
        />
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">{t("form.priceUnit")}</label>
          <div className="flex flex-wrap gap-2">
            {(unidades ?? []).map((u) => (
              <Pill
                key={u.id}
                active={precoUnidadeId === u.id}
                onClick={() => setPrecoUnidadeId(u.id)}
              >
                {t(`units.${u.nome_chave}`)}
              </Pill>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">{t("form.currency")}</label>
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map((c) => (
              <Pill key={c} active={moeda === c} onClick={() => setMoeda(c)}>
                {c}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      {!isServico && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <DarkInput
              label={t("form.quantity")}
              type="number"
              step="0.01"
              min="0"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              error={errors.quantidade ? t(errors.quantidade) : undefined}
            />
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">{t("form.quantityUnit")}</label>
              <div className="flex flex-wrap gap-2">
                {(unidades ?? []).map((u) => (
                  <Pill
                    key={u.id}
                    active={quantidadeUnidadeId === u.id}
                    onClick={() => setQuantidadeUnidadeId(u.id)}
                  >
                    {t(`units.${u.nome_chave}`)}
                  </Pill>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-card/40 p-4">
            <label className="flex items-center gap-3 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={aceitaPermuta}
                onChange={(e) => setAceitaPermuta(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              {t("form.acceptBarter")}
            </label>
            {aceitaPermuta && (
              <DarkInput
                value={permutaDescricao}
                onChange={(e) => setPermutaDescricao(e.target.value)}
                placeholder={t("form.barterDescription")}
              />
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">{t("form.deliveryMode")}</label>
              <div className="flex flex-wrap gap-2">
                {DELIVERY_MODES.map((m) => (
                  <Pill key={m} active={modalidade === m} onClick={() => setModalidade(m)}>
                    {t(`delivery.${m}`)}
                  </Pill>
                ))}
              </div>
            </div>
            {(modalidade === "entrega" || modalidade === "ambos") && (
              <DarkInput
                label={t("form.deliveryRadius")}
                type="number"
                min="0"
                value={raioKm}
                onChange={(e) => setRaioKm(e.target.value)}
              />
            )}
          </div>

          {!isIndustrial && (
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">{t("form.certifications")}</label>
              <div className="flex flex-wrap gap-2">
                {CERTIFICATIONS.map((c) => (
                  <Pill key={c} active={certs.includes(c)} onClick={() => setCerts((s) => toggle(s, c))}>
                    {t(`cert.${c}`)}
                  </Pill>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card/40 p-4">
            <label className="mb-1 block text-sm font-medium text-foreground">{t("form.distributionCenters")}</label>
            <p className="mb-3 text-[11px] text-muted-foreground">{t("form.distributionCentersHint")}</p>
            {(cds ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("form.distributionCentersEmpty")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(cds ?? []).map((c) => (
                  <Pill
                    key={c.id}
                    active={centroIds.includes(c.id)}
                    onClick={() => setCentroIds((s) => toggle(s, c.id))}
                  >
                    {c.nome}
                    {(c.cidade || c.estado) && (
                      <span className="ml-1 opacity-70">· {[c.cidade, c.estado].filter(Boolean).join("/")}</span>
                    )}
                  </Pill>
                ))}
              </div>
            )}
          </div>

        </>
      )}

      {isServico && (
        <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">{t("service.billingModel")}</label>
            <div className="flex flex-wrap gap-2">
              {SERVICE_BILLING.map((b) => (
                <Pill key={b} active={servicoModelo === b} onClick={() => setServicoModelo(b)}>
                  {t(`service.billing.${b}`)}
                </Pill>
              ))}
            </div>
          </div>
          <DarkInput
            label={t("service.area")}
            value={servicoArea}
            onChange={(e) => setServicoArea(e.target.value)}
            placeholder={t("service.areaPh")}
          />
          <DarkInput
            label={t("service.lead")}
            value={servicoPrazo}
            onChange={(e) => setServicoPrazo(e.target.value)}
            placeholder={t("service.leadPh")}
          />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <DarkInput label={t("form.state")} value={estado} onChange={(e) => setEstado(e.target.value)} />
        <DarkInput label={t("form.city")} value={cidade} onChange={(e) => setCidade(e.target.value)} />
        <DarkInput label={t("form.zip")} value={cep} onChange={(e) => setCep(e.target.value)} />
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-end">
        <PillButton type="button" variant="secondary" onClick={() => navigate({ to: "/vender" })}>
          {t("common.cancel")}
        </PillButton>
        <PillButton type="submit" disabled={submitting}>
          {submitting ? t("form.submitting") : mode === "create" ? t("form.submit") : t("form.update")}
        </PillButton>
      </div>
    </form>
  );
}
