import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  X,
  ArrowUp,
  ChevronRight,
  Lightbulb,
  Sparkles,
  LayoutDashboard,
  ShoppingCart,
  Rocket,
  Warehouse,
  Handshake,
  TrendingUp,
  GraduationCap,
  BookOpen,
  Globe,
  DollarSign,
  FileText,
  MapPin,
  Compass,
} from "lucide-react";


import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ajuda")({
  component: AjudaPage,
});

interface CategoryDef {
  id: string;
  icon: typeof LayoutDashboard;
  articles: string[];
}

const CATEGORIES: CategoryDef[] = [
  { id: "primeiros-passos", icon: LayoutDashboard, articles: ["painel", "navegacao", "conta-e-plano", "minha-localizacao", "preferencias"] },
  { id: "comprar-vender", icon: ShoppingCart, articles: ["comprar", "perto-de-mim", "criar-anuncio", "meus-anuncios"] },
  { id: "visibilidade", icon: Sparkles, articles: ["destaque", "startups-pmes"] },
  { id: "cds", icon: Warehouse, articles: ["o-que-e-cd", "cadastrar-meu-cd", "vincular-cd", "estoque"] },
  { id: "internacional", icon: Globe, articles: ["moedas", "exportacao", "canal-internacional", "incoterms", "meu-pais"] },
  { id: "negociar", icon: Handshake, articles: ["mensagens", "negociacoes-kanban"] },
  { id: "mercado", icon: TrendingUp, articles: ["cotacoes", "alertas-preco", "clima", "noticias"] },
  { id: "aprender", icon: GraduationCap, articles: ["cursos-certificados", "clube-vantagens"] },
];

const ARTICLE_ICONS: Record<string, typeof LayoutDashboard> = {
  painel: LayoutDashboard,
  navegacao: Compass,
  "conta-e-plano": BookOpen,
  "minha-localizacao": BookOpen,
  preferencias: BookOpen,
  comprar: ShoppingCart,
  "perto-de-mim": ShoppingCart,
  "criar-anuncio": ShoppingCart,
  "meus-anuncios": ShoppingCart,
  destaque: Sparkles,
  "startups-pmes": Rocket,
  "o-que-e-cd": Warehouse,
  "cadastrar-meu-cd": Warehouse,
  "vincular-cd": Warehouse,
  estoque: Warehouse,
  mensagens: Handshake,
  "negociacoes-kanban": Handshake,
  cotacoes: TrendingUp,
  "alertas-preco": TrendingUp,
  clima: TrendingUp,
  noticias: TrendingUp,
  "cursos-certificados": GraduationCap,
  "clube-vantagens": Sparkles,
  moedas: DollarSign,
  exportacao: Globe,
  "canal-internacional": Globe,
  incoterms: FileText,
  "meu-pais": MapPin,
};

function AjudaPage() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();

  const normalize = (s: string) => s.toLowerCase();

  const matchesArticle = (articleId: string) => {
    if (!query) return true;
    const title = t(`ajuda.articles.${articleId}.title`);
    const summary = t(`ajuda.articles.${articleId}.summary`);
    const steps = t(`ajuda.articles.${articleId}.steps`, { returnObjects: true }) as string[];
    const example = t(`ajuda.articles.${articleId}.example`);
    const tip = t(`ajuda.articles.${articleId}.tip`);
    const haystack = [title, summary, example, tip, ...(Array.isArray(steps) ? steps : [])]
      .map(normalize)
      .join(" \n ");
    return haystack.includes(query);
  };

  const filteredCategories = useMemo(() => {
    return CATEGORIES
      .map((cat) => ({ ...cat, articles: cat.articles.filter(matchesArticle) }))
      .filter((cat) => cat.articles.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const scrollToCategory = (id: string) => {
    const el = document.getElementById(`cat-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const backToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <section className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-lg md:p-8">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">
                {t("ajuda.ui.title")}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground md:text-base">
                {t("ajuda.ui.subtitle")}
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("ajuda.ui.searchPlaceholder")}
                className="pl-9 pr-10"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label={t("ajuda.ui.clearSearch")}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Category chips (only when not searching) */}
        {!query && (
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("ajuda.ui.categoriesTitle")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => scrollToCategory(cat.id)}
                    className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/50"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-bold text-foreground">
                        {t(`ajuda.categories.${cat.id}.title`)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {t(`ajuda.categories.${cat.id}.subtitle`)}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Results */}
        {query && (
          <p className="text-sm text-muted-foreground">
            {t("ajuda.ui.resultsFor")}: <span className="font-semibold text-foreground">{q}</span>
          </p>
        )}

        {filteredCategories.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {t("ajuda.ui.noResults")}
          </div>
        ) : (
          filteredCategories.map((cat) => {
            const Icon = cat.icon;
            return (
              <section
                key={cat.id}
                id={`cat-${cat.id}`}
                className="scroll-mt-20 rounded-3xl border border-border bg-card p-5 md:p-6"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-foreground">
                      {t(`ajuda.categories.${cat.id}.title`)}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {t(`ajuda.categories.${cat.id}.subtitle`)}
                    </p>
                  </div>
                </div>

                <Accordion type="multiple" className="space-y-2">
                  {cat.articles.map((articleId) => {
                    const AIcon = ARTICLE_ICONS[articleId] ?? BookOpen;
                    const steps = t(`ajuda.articles.${articleId}.steps`, {
                      returnObjects: true,
                    }) as string[];
                    return (
                      <AccordionItem
                        key={articleId}
                        value={articleId}
                        className="overflow-hidden rounded-2xl border border-border bg-background/40"
                      >
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                          <div className="flex min-w-0 items-center gap-3 text-left">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
                              <AIcon className="h-4 w-4" />
                            </div>
                            <span className="truncate font-display text-sm font-semibold text-foreground">
                              {t(`ajuda.articles.${articleId}.title`)}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 px-4 pb-4">
                          <p className="text-sm text-muted-foreground">
                            {t(`ajuda.articles.${articleId}.summary`)}
                          </p>
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                              {t("ajuda.ui.steps")}
                            </p>
                            <ol className="space-y-1.5">
                              {(Array.isArray(steps) ? steps : []).map((step, idx) => (
                                <li
                                  key={idx}
                                  className="flex gap-3 text-sm text-foreground"
                                >
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                                    {idx + 1}
                                  </span>
                                  <span className="flex-1">{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                          <div className="rounded-xl border border-border bg-card/60 p-3">
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {t("ajuda.ui.example")}
                            </p>
                            <p className="text-sm text-foreground">
                              {t(`ajuda.articles.${articleId}.example`)}
                            </p>
                          </div>
                          <div className={cn(
                            "flex gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3",
                          )}>
                            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <div>
                              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                                {t("ajuda.ui.tip")}
                              </p>
                              <p className="text-sm text-foreground">
                                {t(`ajuda.articles.${articleId}.tip`)}
                              </p>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </section>
            );
          })
        )}

        <div className="flex justify-center pb-8">
          <button
            type="button"
            onClick={backToTop}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-primary"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            {t("ajuda.ui.backToTop")}
          </button>
        </div>
      </div>
    </>
  );
}
