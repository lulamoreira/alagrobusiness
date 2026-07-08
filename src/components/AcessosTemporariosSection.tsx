import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Timer, Send, Ban, Plus, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Row {
  convite_id: string;
  email: string;
  plano_codigo: string;
  duracao_horas: number;
  criado_em: string;
  expira_em: string | null;
  status_convite: "pendente" | "usado" | "cancelado" | "expirado";
  usuario_id: string | null;
  usado_em: string | null;
  assinatura_fim: string | null;
  assinatura_status: string | null;
}

type Estado = "pendente" | "ativo" | "expirado";

function classify(r: Row): Estado {
  if (r.status_convite === "pendente") {
    if (r.expira_em && new Date(r.expira_em) <= new Date()) return "expirado";
    return "pendente";
  }
  if (r.status_convite === "usado") {
    if (r.assinatura_fim && new Date(r.assinatura_fim) <= new Date()) return "expirado";
    if (r.assinatura_status === "ativa") return "ativo";
    return "expirado";
  }
  return "expirado";
}

function fmtRestante(target: string | null, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (!target) return "—";
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return t("tempAccess.expiredLabel");
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(h / 24);
  const restH = h % 24;
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${restH}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function AcessosTemporariosSection() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [dias, setDias] = useState("2");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("admin_list_acessos_temporarios");
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const criar = async () => {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast.error(t("adminAccess.inviteInvalidEmail"));
      return;
    }
    const n = Number(dias);
    if (!Number.isFinite(n) || n < 1) {
      toast.error(t("tempAccess.invalidDays"));
      return;
    }
    setBusy(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("admin_criar_convite", {
      p_email: clean,
      p_plano: "pro",
      p_dias: null,
      p_horas: Math.round(n * 24),
    });
    if (error) {
      setBusy(false);
      toast.error(t("adminAccess.inviteErrorCreate", { detail: error.message }));
      return;
    }
    const row = data as { status: string; token: string; email: string; plano_codigo: string; dias: number | null };
    if (row.status === "usado") {
      toast.success(t("tempAccess.appliedNow"));
    } else {
      // Try email delivery via existing edge function
      const { error: sendErr } = await supabase.functions.invoke("enviar-convite", {
        body: {
          email: row.email,
          token: row.token,
          plano: row.plano_codigo,
          dias: Math.round(n),
          origin: typeof window !== "undefined" ? window.location.origin : "",
          lang: i18n.language,
        },
      });
      if (sendErr) toast.warning(t("tempAccess.createdManual"));
      else toast.success(t("tempAccess.sentEmail"));
    }
    setBusy(false);
    setEmail("");
    await load();
  };

  const ajustar = async (id: string, delta: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("admin_temporario_ajustar_horas", {
      p_convite_id: id,
      p_delta_horas: delta,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("tempAccess.updated"));
    await load();
  };

  const revogar = async (r: Row) => {
    if (r.status_convite === "pendente") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("admin_cancelar_convite", { p_id: r.convite_id });
      if (error) return toast.error(error.message);
    } else if (r.usuario_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("admin_revoke_plan", { p_usuario: r.usuario_id });
      if (error) return toast.error(error.message);
    }
    toast.success(t("tempAccess.revoked"));
    await load();
  };

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(i18n.language) : "—";

  const badge = (e: Estado) => {
    const cls: Record<Estado, string> = {
      pendente: "bg-amber-500/15 text-amber-300 border-amber-500/40",
      ativo: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
      expirado: "bg-red-500/15 text-red-300 border-red-500/40",
    };
    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls[e]}`}>
        {t(`tempAccess.state_${e}`)}
      </span>
    );
  };

  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2">
          <Timer className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">{t("tempAccess.title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("tempAccess.subtitle")}</p>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_140px_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="temp-email">{t("adminAccess.inviteEmailLabel")}</Label>
          <Input
            id="temp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("adminAccess.inviteEmailPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="temp-days">{t("tempAccess.daysLabel")}</Label>
          <Input
            id="temp-days"
            type="number"
            min={1}
            value={dias}
            onChange={(e) => setDias(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button onClick={criar} disabled={busy} className="w-full md:w-auto">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {busy ? t("adminAccess.inviteSending") : t("tempAccess.send")}
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium">{t("tempAccess.listTitle")}</p>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("adminAccess.searching")}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("tempAccess.listEmpty")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => {
              const est = classify(r);
              const alvo = est === "pendente" ? r.expira_em : r.assinatura_fim;
              return (
                <div key={r.convite_id} className="flex flex-col gap-3 rounded-xl border border-border/50 bg-background/40 p-4">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.email}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {r.plano_codigo.toUpperCase()} · {(r.duracao_horas / 24).toFixed(1)} {t("tempAccess.daysShort")}
                      </p>
                    </div>
                    {badge(est)}
                  </div>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <div>
                      <dt className="text-muted-foreground">{t("tempAccess.firstAccess")}</dt>
                      <dd>{r.usado_em ? fmt(r.usado_em) : t("tempAccess.notYet")}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">
                        {est === "pendente" ? t("tempAccess.inviteExpiresAt") : t("tempAccess.accessExpiresAt")}
                      </dt>
                      <dd>{fmt(alvo)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">{t("tempAccess.remaining")}</dt>
                      <dd className="font-medium">{est === "expirado" ? t("tempAccess.expiredLabel") : fmtRestante(alvo, t)}</dd>
                    </div>
                  </dl>

                  {est !== "expirado" && (
                    <div className="mt-auto grid grid-cols-2 gap-2">
                      <Button size="sm" variant="secondary" onClick={() => ajustar(r.convite_id, 24)}>
                        <Plus className="mr-1 h-3 w-3" />
                        1d
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => ajustar(r.convite_id, 12)}>
                        <Plus className="mr-1 h-3 w-3" />
                        12h
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => ajustar(r.convite_id, -24)}>
                        <Minus className="mr-1 h-3 w-3" />
                        1d
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => ajustar(r.convite_id, -12)}>
                        <Minus className="mr-1 h-3 w-3" />
                        12h
                      </Button>
                      <Button size="sm" variant="destructive" className="col-span-2" onClick={() => revogar(r)}>
                        <Ban className="mr-1 h-4 w-4" />
                        {t("tempAccess.revokeNow")}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
