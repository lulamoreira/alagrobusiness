import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, Award, Download, Printer } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/certificado/$codigo")({
  component: CertificadoPage,
});

interface CertRow {
  id: string;
  codigo: string;
  emitido_em: string;
  usuario_id: string;
  curso: { titulo: string; categoria: string | null } | null;
  profile: { nome_completo: string | null } | null;
}

function CertificadoPage() {
  const { codigo } = Route.useParams();
  const { t, i18n } = useTranslation();
  const certRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["certificado-view", codigo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificados")
        .select(
          "id, codigo, emitido_em, usuario_id, curso:cursos(titulo, categoria)",
        )
        .eq("codigo", codigo)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const { data: prof } = await supabase
        .from("profiles")
        .select("nome_completo")
        .eq("id", data.usuario_id)
        .maybeSingle();

      return {
        ...data,
        profile: prof,
      } as unknown as CertRow;
    },
  });

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(i18n.language, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  const handleDownload = async () => {
    if (!certRef.current || !data) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(certRef.current, {
        scale: 2,
        backgroundColor: "#0B130E",
        useCORS: true,
      });
      const img = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const w = pdf.internal.pageSize.getWidth();
      const h = pdf.internal.pageSize.getHeight();
      pdf.addImage(img, "JPEG", 0, 0, w, h);
      pdf.save(`ALAGROBUSINESS-${data.codigo}.pdf`);
    } catch (err) {
      console.error(err);
      toast.error(t("courses.certificateError"));
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => window.print();

  if (isLoading) {
    return <div className="h-96 animate-pulse rounded-3xl border border-border bg-card/40" />;
  }
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card/60 p-12 text-center">
        <h2 className="font-display text-lg font-semibold">{t("certificates.notFound")}</h2>
        <Link to="/certificados" className="mt-4 text-sm font-semibold text-primary">
          ← {t("certificates.back")}
        </Link>
      </div>
    );
  }

  const nome = data.profile?.nome_completo ?? "—";
  const cursoTitulo = data.curso?.titulo ?? "—";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to="/certificados"
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("certificates.back")}
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-1.5 h-4 w-4" />
            {t("certificates.print")}
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={generating}>
            <Download className="mr-1.5 h-4 w-4" />
            {generating ? t("certificates.generating") : t("certificates.download")}
          </Button>
        </div>
      </div>

      {/* Certificado — proporção A4 landscape */}
      <div className="mx-auto w-full max-w-5xl overflow-x-auto">
        <div
          ref={certRef}
          className="relative mx-auto aspect-[297/210] w-full min-w-[720px] overflow-hidden rounded-3xl border border-primary/30 bg-[#0B130E] p-10 shadow-2xl shadow-primary/10 md:p-14"
          style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
        >
          {/* Glows decorativos */}
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />

          {/* Borda ornamental */}
          <div className="absolute inset-4 rounded-2xl border border-primary/20 md:inset-6" />

          <div className="relative flex h-full flex-col">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/40 bg-primary/10">
                  <Award className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div
                    className="text-sm font-black tracking-[0.2em] text-primary"
                    style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                  >
                    ALAGROBUSINESS
                  </div>
                  <div className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                    {t("certificates.platform")}
                  </div>
                </div>
              </div>
              {data.curso?.categoria && (
                <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                  {data.curso.categoria}
                </span>
              )}
            </div>

            {/* Corpo */}
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div
                className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground"
                style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
              >
                {t("certificates.title")}
              </div>
              <div className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">
                {t("certificates.certifyThat")}
              </div>
              <h1
                className="mt-3 font-display text-3xl font-black text-foreground md:text-5xl"
                style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
              >
                {nome}
              </h1>
              <div className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
                {t("certificates.hasCompleted")}
              </div>
              <h2 className="mt-3 max-w-3xl font-display text-xl font-bold text-primary md:text-2xl">
                {cursoTitulo}
              </h2>

              <div className="mt-6 h-px w-40 bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            </div>

            {/* Footer */}
            <div className="mt-auto grid grid-cols-2 gap-6 text-xs">
              <div>
                <div className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                  {t("certificates.issuedAt")}
                </div>
                <div className="mt-1 font-semibold text-foreground">{fmt(data.emitido_em)}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                  {t("certificates.verification")}
                </div>
                <div className="mt-1 font-mono text-sm font-bold tracking-widest text-primary">
                  {data.codigo}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
