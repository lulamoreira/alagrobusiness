import { useTranslation } from "react-i18next";

interface NewsItem {
  id: string;
  titulo: string;
  resumo: string | null;
  link: string;
  fonte: string | null;
  imagem: string | null;
  tema: string | null;
  publicado_em: string | null;
}

export function NewsCard({ item }: { item: NewsItem }) {
  const { t, i18n } = useTranslation();
  const date = item.publicado_em
    ? new Date(item.publicado_em).toLocaleDateString(i18n.language, {
        day: "2-digit",
        month: "short",
      })
    : "";
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/40 hover:-translate-y-0.5"
    >
      {item.imagem && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imagem} alt="" className="h-40 w-full object-cover" loading="lazy" />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          {item.tema && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{item.tema}</span>}
          {item.fonte && <span>{item.fonte}</span>}
          {date && <span>· {date}</span>}
        </div>
        <h3 className="font-display text-base font-bold text-foreground line-clamp-2">{item.titulo}</h3>
        {item.resumo && <p className="text-sm text-muted-foreground line-clamp-3">{item.resumo}</p>}
        <span className="mt-auto pt-2 text-xs font-semibold text-primary">{t("news.readMore")} →</span>
      </div>
    </a>
  );
}
