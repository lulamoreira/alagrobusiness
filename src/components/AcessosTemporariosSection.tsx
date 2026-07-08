import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Timer, Send, Ban, Plus, Minus, Pencil, Trash2, KeyRound, RotateCcw, Copy, Sparkles, MessageCircle, ClipboardCopy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Row {
  convite_id: string;
  email: string;
  login: string | null;
  label: string | null;
  plano_codigo: string;
  duracao_horas: number;
  criado_em: string;
  expira_em: string | null;
  status_convite: "pendente" | "usado" | "cancelado" | "expirado";
  is_demo: boolean;
  iniciado_em: string | null;
  usuario_id: string | null;
  usado_em: string | null;
  assinatura_fim: string | null;
  assinatura_status: string | null;
}

interface PlanoOpt { codigo: string; nome: Record<string, string> | null }

type Estado = "pendente" | "ativo" | "expirado";

function classify(r: Row): Estado {
  if (r.is_demo && !r.iniciado_em && r.status_convite === "pendente") return "pendente";
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

function fmtRestante(target: string | null, t: (k: string) => string): string {
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
  const [rows, setRows] = useState<Row[]>([]);
  const [planos, setPlanos] = useState<PlanoOpt[]>([]);
  const [loading, setLoading] = useState(false);

  // Form email invite
  const [email, setEmail] = useState("");
  const [diasEmail, setDiasEmail] = useState("2");
  const [busyEmail, setBusyEmail] = useState(false);

  // Form demo
  const [demoLogin, setDemoLogin] = useState("");
  const [demoSenha, setDemoSenha] = useState("");
  const [demoLabel, setDemoLabel] = useState("");
  const [demoPlano, setDemoPlano] = useState("pro");
  const [demoDias, setDemoDias] = useState("2");
  const [busyDemo, setBusyDemo] = useState(false);
  const [criado, setCriado] = useState<{ login: string; senha: string } | null>(null);

  // Edit dialog
  const [editing, setEditing] = useState<Row | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editPlano, setEditPlano] = useState("");
  const [editNovaSenha, setEditNovaSenha] = useState("");

  // Add-days input per row
  const [addDaysMap, setAddDaysMap] = useState<Record<string, string>>({});
  const [pwdByLogin, setPwdByLogin] = useState<Record<string, string>>({});

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);

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

  const loadPlanos = async () => {
    const { data } = await supabase
      .from("planos")
      .select("codigo, nome")
      .eq("ativo", true)
      .is("deleted_at", null)
      .order("codigo");
    setPlanos((data ?? []) as PlanoOpt[]);
  };

  const PWD_LS_KEY = "demo_pwd_cache_v1";
  const savePwd = (login: string, senha: string) => {
    setPwdByLogin((prev) => {
      const next = { ...prev, [login]: senha };
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(PWD_LS_KEY, JSON.stringify(next));
        }
      } catch { /* ignore */ }
      return next;
    });
  };
  const forgetPwd = (login: string) => {
    setPwdByLogin((prev) => {
      const next = { ...prev };
      delete next[login];
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(PWD_LS_KEY, JSON.stringify(next));
        }
      } catch { /* ignore */ }
      return next;
    });
  };

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(PWD_LS_KEY);
        if (raw) setPwdByLogin(JSON.parse(raw) as Record<string, string>);
      }
    } catch { /* ignore */ }
    load();
    loadPlanos();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const criarEmail = async () => {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast.error(t("adminAccess.inviteInvalidEmail"));
      return;
    }
    const n = Number(diasEmail);
    if (!Number.isFinite(n) || n < 1) {
      toast.error(t("tempAccess.invalidDays"));
      return;
    }
    setBusyEmail(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("admin_criar_convite", {
      p_email: clean,
      p_plano: "pro",
      p_dias: null,
      p_horas: Math.round(n * 24),
    });
    setBusyEmail(false);
    if (error) return toast.error(error.message);
    toast.success(t("tempAccess.createdManual"));
    setEmail("");
    await load();
  };

  const criarDemo = async () => {
    if (!demoLogin.trim() || demoLogin.trim().length < 2) return toast.error(t("demoAccess.invalidLogin"));
    if (!demoSenha || demoSenha.length < 6) return toast.error(t("demoAccess.invalidPassword"));
    const n = Number(demoDias);
    if (!Number.isFinite(n) || n < 1) return toast.error(t("tempAccess.invalidDays"));

    setBusyDemo(true);
    const { data, error } = await supabase.functions.invoke("admin-criar-demo", {
      body: {
        login: demoLogin.trim().toLowerCase(),
        senha: demoSenha,
        label: demoLabel.trim(),
        plano: demoPlano,
        dias: Math.round(n),
      },
    });
    setBusyDemo(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = (error as any) || (data && (data as any).error);
    if (err) return toast.error(typeof err === "string" ? err : (err.message ?? "erro"));
    const loginCriado = demoLogin.trim().toLowerCase();
    setCriado({ login: loginCriado, senha: demoSenha });
    savePwd(loginCriado, demoSenha);
    setDemoLogin(""); setDemoSenha(""); setDemoLabel("");
    toast.success(t("demoAccess.created"));
    await load();
  };

  const ajustar = async (id: string, delta: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("admin_temporario_ajustar_horas", {
      p_convite_id: id,
      p_delta_horas: delta,
    });
    if (error) return toast.error(error.message);
    toast.success(t("tempAccess.updated"));
    await load();
  };

  const adicionarDias = async (r: Row) => {
    const raw = addDaysMap[r.convite_id];
    const dias = Number(raw);
    if (!Number.isFinite(dias) || dias === 0) return toast.error(t("tempAccess.invalidDays"));
    await ajustar(r.convite_id, Math.round(dias * 24));
    setAddDaysMap((m) => ({ ...m, [r.convite_id]: "" }));
  };

  const revogar = async (r: Row) => {
    if (r.is_demo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("admin_demo_revogar", { p_convite_id: r.convite_id });
      if (error) return toast.error(error.message);
    } else if (r.status_convite === "pendente") {
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

  const reativar = async (r: Row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("admin_demo_reativar", {
      p_convite_id: r.convite_id,
      p_horas: r.duracao_horas || 48,
    });
    if (error) return toast.error(error.message);
    toast.success(t("demoAccess.reactivated"));
    await load();
  };

  const abrirEdit = (r: Row) => {
    setEditing(r);
    setEditLabel(r.label ?? "");
    setEditPlano(r.plano_codigo);
    setEditNovaSenha("");
  };

  const salvarEdit = async () => {
    if (!editing) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("admin_demo_editar", {
      p_convite_id: editing.convite_id,
      p_label: editLabel || null,
      p_plano: editPlano || null,
    });
    if (error) return toast.error(error.message);

    if (editNovaSenha && editNovaSenha.length >= 6 && editing.usuario_id) {
      const { data, error: e2 } = await supabase.functions.invoke("admin-demo-reset-senha", {
        body: { user_id: editing.usuario_id, senha: editNovaSenha },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = (e2 as any) || (data && (data as any).error);
      if (err) return toast.error(typeof err === "string" ? err : (err.message ?? "erro"));
    }
    toast.success(t("demoAccess.saved"));
    setEditing(null);
    await load();
  };

  const apagar = async (r: Row) => {
    const { data, error } = await supabase.functions.invoke("admin-demo-apagar", {
      body: { convite_id: r.convite_id },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = (error as any) || (data && (data as any).error);
    if (err) return toast.error(typeof err === "string" ? err : (err.message ?? "erro"));
    toast.success(t("demoAccess.deleted"));
    setConfirmDelete(null);
    await load();
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("demoAccess.copied"));
    } catch {
      toast.error("clipboard");
    }
  };

  const buildCredMessage = (login: string, senha: string) =>
    t("demoAccess.waMessage", {
      login,
      senha,
      url: typeof window !== "undefined" ? window.location.origin : "",
    });

  const buildLoginOnlyMessage = (login: string) =>
    t("demoAccess.waMessageLoginOnly", {
      login,
      url: typeof window !== "undefined" ? window.location.origin : "",
    });

  const openWhatsapp = (msg: string) => {
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareWhatsapp = (login: string, senha: string) =>
    openWhatsapp(buildCredMessage(login, senha));

  const shareWhatsappLoginOnly = (login: string) =>
    openWhatsapp(buildLoginOnlyMessage(login));

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(i18n.language) : "—");
  const nomePlano = (p: PlanoOpt) => p.nome?.[i18n.language] ?? p.nome?.["pt-BR"] ?? p.codigo;

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

  const demos = useMemo(() => rows.filter((r) => r.is_demo), [rows]);
  const invites = useMemo(() => rows.filter((r) => !r.is_demo), [rows]);

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

      {/* Criação de conta demo */}
      <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{t("demoAccess.createTitle")}</h3>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{t("demoAccess.createHint")}</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="demo-login">{t("demoAccess.login")}</Label>
            <Input id="demo-login" value={demoLogin} onChange={(e) => setDemoLogin(e.target.value)} placeholder="ana.demo" />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="demo-senha">{t("demoAccess.password")}</Label>
            <Input id="demo-senha" type="text" value={demoSenha} onChange={(e) => setDemoSenha(e.target.value)} placeholder="min 6" />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="demo-label">{t("demoAccess.label")}</Label>
            <Input id="demo-label" value={demoLabel} onChange={(e) => setDemoLabel(e.target.value)} placeholder={t("demoAccess.labelPlaceholder")} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label>{t("demoAccess.plan")}</Label>
            <Select value={demoPlano} onValueChange={setDemoPlano}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {planos.map((p) => (
                  <SelectItem key={p.codigo} value={p.codigo}>{nomePlano(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="demo-dias">{t("demoAccess.daysFromFirstAccess")}</Label>
            <Input id="demo-dias" type="number" min={1} value={demoDias} onChange={(e) => setDemoDias(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex items-end">
            <Button className="w-full" onClick={criarDemo} disabled={busyDemo}>
              {busyDemo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {t("demoAccess.createBtn")}
            </Button>
          </div>
        </div>
      </div>

      {/* Convite por e-mail (mantido) */}
      <details className="mt-4 rounded-xl border border-border/50 bg-background/40 p-4">
        <summary className="cursor-pointer text-sm font-medium">{t("tempAccess.emailInviteTitle")}</summary>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_140px_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="temp-email">{t("adminAccess.inviteEmailLabel")}</Label>
            <Input id="temp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("adminAccess.inviteEmailPlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="temp-days">{t("tempAccess.daysLabel")}</Label>
            <Input id="temp-days" type="number" min={1} value={diasEmail} onChange={(e) => setDiasEmail(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={criarEmail} disabled={busyEmail} className="w-full md:w-auto">
              {busyEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {t("tempAccess.send")}
            </Button>
          </div>
        </div>
      </details>

      {/* Lista */}
      <div className="mt-6">
        <p className="mb-2 text-sm font-medium">{t("tempAccess.listTitle")}</p>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("adminAccess.searching")}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("tempAccess.listEmpty")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...demos, ...invites].map((r) => {
              const est = classify(r);
              const alvo = est === "pendente" ? r.expira_em : r.assinatura_fim;
              const primeiroAcesso = r.iniciado_em ?? r.usado_em;
              const nomeExibido = r.is_demo ? (r.label || r.login || r.email) : r.email;
              const totalH = r.duracao_horas || 0;
              const totalD = Math.floor(totalH / 24);
              const restH = totalH % 24;
              const duracaoAmigavel =
                totalD > 0 && restH === 0
                  ? `${totalD} ${t("tempAccess.daysShort")}`
                  : totalD > 0
                    ? `${totalD}d ${restH}h`
                    : `${totalH}h`;
              return (
                <div
                  key={r.convite_id}
                  className="flex flex-col gap-5 rounded-xl border border-border/50 bg-background/40 p-5"
                >
                  {/* 1) CABEÇALHO */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <h3
                        className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug"
                        title={nomeExibido}
                      >
                        {nomeExibido}
                      </h3>
                      {r.is_demo && (
                        <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Demo
                        </span>
                      )}
                    </div>
                    <div>{badge(est)}</div>
                  </div>

                  {/* 2) CREDENCIAIS (só demo) */}
                  {r.is_demo && r.login && (
                    <div className="space-y-2 rounded-lg border border-primary/25 bg-primary/5 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">
                        {t("demoAccess.credentialsTitle")}
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded-md border border-border/40 bg-background/60 px-2 py-1.5 font-mono text-sm">
                          {r.login}
                        </code>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="shrink-0"
                          aria-label={t("demoAccess.copyLogin")}
                          title={t("demoAccess.copyLogin")}
                          onClick={() => copy(r.login!)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground" htmlFor={`pwd-${r.convite_id}`}>
                          {t("demoAccess.password")}
                        </Label>
                        <Input
                          id={`pwd-${r.convite_id}`}
                          type="text"
                          className="h-9 font-mono"
                          placeholder={t("demoAccess.sharePwdPlaceholder")}
                          value={sharePwdMap[r.convite_id] ?? ""}
                          onChange={(e) =>
                            setSharePwdMap((m) => ({ ...m, [r.convite_id]: e.target.value }))
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={!(sharePwdMap[r.convite_id] ?? "").trim()}
                          onClick={() =>
                            copy(buildCredMessage(r.login!, sharePwdMap[r.convite_id]!.trim()))
                          }
                        >
                          <ClipboardCopy className="mr-2 h-3.5 w-3.5" />
                          {t("demoAccess.copyAll")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1 bg-[#25D366] text-white hover:bg-[#1EBE5B]"
                          disabled={!(sharePwdMap[r.convite_id] ?? "").trim()}
                          onClick={() =>
                            shareWhatsapp(r.login!, sharePwdMap[r.convite_id]!.trim())
                          }
                        >
                          <MessageCircle className="mr-2 h-3.5 w-3.5" />
                          {t("demoAccess.sendWhatsapp")}
                        </Button>
                      </div>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        {t("demoAccess.sharePwdNote")}
                      </p>
                    </div>
                  )}

                  {/* 3) DADOS */}
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
                    <div className="space-y-0.5">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t("demoAccess.plan")}
                      </dt>
                      <dd className="font-medium">
                        {r.plano_codigo.toUpperCase()}{" "}
                        <span className="text-muted-foreground">· {duracaoAmigavel}</span>
                      </dd>
                    </div>
                    <div className="space-y-0.5">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t("tempAccess.firstAccess")}
                      </dt>
                      <dd className="break-words">
                        {primeiroAcesso ? fmt(primeiroAcesso) : t("tempAccess.notYet")}
                      </dd>
                    </div>
                    <div className="space-y-0.5">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {est === "pendente"
                          ? t("tempAccess.inviteExpiresAt")
                          : t("tempAccess.accessExpiresAt")}
                      </dt>
                      <dd className="break-words">{fmt(alvo)}</dd>
                    </div>
                    <div className="space-y-0.5">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t("tempAccess.remaining")}
                      </dt>
                      <dd className="text-sm font-semibold text-foreground">
                        {est === "expirado" ? t("tempAccess.expiredLabel") : fmtRestante(alvo, t)}
                      </dd>
                    </div>
                  </dl>

                  {/* 4) AÇÕES */}
                  <div className="mt-auto space-y-4">
                    {est !== "expirado" && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("demoAccess.adjustTimeGroup")}
                        </p>
                        <div className="flex items-end gap-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            <Label className="text-[11px]" htmlFor={`add-${r.convite_id}`}>
                              {t("demoAccess.addDaysLabel")}
                            </Label>
                            <Input
                              id={`add-${r.convite_id}`}
                              type="number"
                              className="h-9"
                              value={addDaysMap[r.convite_id] ?? ""}
                              onChange={(e) =>
                                setAddDaysMap((m) => ({ ...m, [r.convite_id]: e.target.value }))
                              }
                              placeholder="7"
                            />
                          </div>
                          <Button size="sm" className="shrink-0" onClick={() => adicionarDias(r)}>
                            <Plus className="mr-1 h-3 w-3" /> {t("demoAccess.addBtn")}
                          </Button>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => ajustar(r.convite_id, 24)}>+1d</Button>
                          <Button size="sm" variant="secondary" onClick={() => ajustar(r.convite_id, 12)}>+12h</Button>
                          <Button size="sm" variant="outline" onClick={() => ajustar(r.convite_id, -24)}>
                            <Minus className="h-3 w-3" />1d
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => ajustar(r.convite_id, -12)}>
                            <Minus className="h-3 w-3" />12h
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 border-t border-border/40 pt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("demoAccess.manageGroup")}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {r.is_demo && (
                          <Button size="sm" variant="secondary" onClick={() => abrirEdit(r)}>
                            <Pencil className="mr-1 h-3 w-3" /> {t("demoAccess.edit")}
                          </Button>
                        )}
                        {est === "expirado" && r.is_demo ? (
                          <Button size="sm" variant="secondary" onClick={() => reativar(r)}>
                            <RotateCcw className="mr-1 h-3 w-3" /> {t("demoAccess.reactivate")}
                          </Button>
                        ) : (
                          <Button size="sm" variant="destructive" onClick={() => revogar(r)}>
                            <Ban className="mr-1 h-4 w-4" /> {t("tempAccess.revokeNow")}
                          </Button>
                        )}
                      </div>
                      {r.is_demo && (
                        <div className="flex justify-end pt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setConfirmDelete(r)}
                          >
                            <Trash2 className="mr-1 h-3 w-3" /> {t("demoAccess.delete")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* Dialog: credenciais criadas */}
      <Dialog open={!!criado} onOpenChange={(o) => !o && setCriado(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("demoAccess.createdTitle")}</DialogTitle>
            <DialogDescription>{t("demoAccess.createdDesc")}</DialogDescription>
          </DialogHeader>
          {criado && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">{t("demoAccess.login")}</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={criado.login} className="font-mono" />
                  <Button
                    size="icon"
                    variant="secondary"
                    aria-label={t("demoAccess.copyLogin")}
                    onClick={() => copy(criado.login)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t("demoAccess.password")}</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={criado.senha} className="font-mono" />
                  <Button
                    size="icon"
                    variant="secondary"
                    aria-label={t("demoAccess.copyPassword")}
                    onClick={() => copy(criado.senha)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => copy(buildCredMessage(criado.login, criado.senha))}
                >
                  <ClipboardCopy className="mr-2 h-4 w-4" />
                  {t("demoAccess.copyAll")}
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-[#25D366] text-white hover:bg-[#1EBE5B]"
                  onClick={() => shareWhatsapp(criado.login, criado.senha)}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {t("demoAccess.sendWhatsapp")}
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCriado(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: editar demo */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("demoAccess.editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("demoAccess.label")}</Label>
              <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("demoAccess.plan")}</Label>
              <Select value={editPlano} onValueChange={setEditPlano}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {planos.map((p) => (
                    <SelectItem key={p.codigo} value={p.codigo}>{nomePlano(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><KeyRound className="h-3 w-3" /> {t("demoAccess.newPassword")}</Label>
              <Input type="text" value={editNovaSenha} onChange={(e) => setEditNovaSenha(e.target.value)} placeholder={t("demoAccess.newPasswordHint")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>{t("common.cancel", "Cancelar")}</Button>
            <Button onClick={salvarEdit}>{t("demoAccess.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("demoAccess.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("demoAccess.deleteConfirm", { name: confirmDelete?.label ?? confirmDelete?.login ?? confirmDelete?.email ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && apagar(confirmDelete)}>
              {t("demoAccess.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
