import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Mail, Send, Copy, Ban, Clock } from "lucide-react";
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

interface PlanoOpt {
  codigo: string;
  nome: Record<string, string> | null;
}

interface ConviteRow {
  id: string;
  email: string;
  plano_codigo: string;
  dias: number | null;
  status: "pendente" | "usado" | "cancelado" | "expirado";
  token: string;
  expira_em: string | null;
  usado_em: string | null;
  created_at: string;
}

export function InviteCortesiaSection() {
  const { t, i18n } = useTranslation();
  const [planos, setPlanos] = useState<PlanoOpt[]>([]);
  const [email, setEmail] = useState("");
  const [plano, setPlano] = useState("pro");
  const [mode, setMode] = useState<"indefinite" | "days">("indefinite");
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<ConviteRow[]>([]);
  const [manualLinks, setManualLinks] = useState<Record<string, string>>({});

  const loadPlanos = async () => {
    const { data } = await supabase
      .from("planos")
      .select("codigo, nome")
      .is("deleted_at", null)
      .eq("ativo", true)
      .order("preco_mensal", { ascending: true });
    setPlanos((data ?? []) as PlanoOpt[]);
  };

  const loadInvites = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("admin_listar_convites");
    if (error) {
      toast.error(error.message);
      return;
    }
    setInvites((data ?? []) as ConviteRow[]);
  };

  useEffect(() => {
    loadPlanos();
    loadInvites();
  }, []);

  const planoNome = (codigo: string) => {
    const p = planos.find((x) => x.codigo === codigo);
    return p?.nome?.[i18n.language] || p?.nome?.["pt-BR"] || codigo.toUpperCase();
  };

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(i18n.language) : t("adminAccess.indefinite");

  const submit = async () => {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast.error(t("adminAccess.inviteInvalidEmail"));
      return;
    }
    setBusy(true);
    const dias = mode === "days" ? Number(days) || null : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("admin_criar_convite", {
      p_email: clean,
      p_plano: plano,
      p_dias: dias,
    });
    if (error) {
      setBusy(false);
      toast.error(t("adminAccess.inviteErrorCreate", { detail: error.message }));
      return;
    }
    const row = data as ConviteRow;

    if (row.status === "usado") {
      toast.success(t("adminAccess.inviteGrantedNow"));
    } else {
      // Try to send email via edge function
      const { data: send, error: sendErr } = await supabase.functions.invoke(
        "enviar-convite",
        {
          body: {
            email: row.email,
            token: row.token,
            plano: row.plano_codigo,
            dias: row.dias,
            origin: typeof window !== "undefined" ? window.location.origin : "",
            lang: i18n.language,
          },
        },
      );
      if (sendErr) {
        // Fallback: build link manually
        const link = `${window.location.origin}/cadastro?convite=${encodeURIComponent(row.token)}&email=${encodeURIComponent(row.email)}`;
        setManualLinks((m) => ({ ...m, [row.id]: link }));
        toast.warning(t("adminAccess.inviteReadyManual"));
      } else {
        const payload = send as { sent: boolean; mode: string; link: string };
        if (payload?.sent) {
          toast.success(t("adminAccess.inviteSentEmail"));
        } else {
          setManualLinks((m) => ({ ...m, [row.id]: payload.link }));
          toast.warning(t("adminAccess.inviteReadyManual"));
        }
      }
    }
    setBusy(false);
    setEmail("");
    await loadInvites();
  };

  const cancel = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("admin_cancelar_convite", { p_id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("adminAccess.inviteCancelled"));
    await loadInvites();
  };

  const copyLink = async (row: ConviteRow) => {
    const link =
      manualLinks[row.id] ??
      `${window.location.origin}/cadastro?convite=${encodeURIComponent(row.token)}&email=${encodeURIComponent(row.email)}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t("adminAccess.inviteLinkCopied"));
    } catch {
      window.prompt(t("adminAccess.inviteCopyLink"), link);
    }
  };

  const statusBadge = (s: ConviteRow["status"]) => {
    const map: Record<ConviteRow["status"], string> = {
      pendente: "bg-amber-500/15 text-amber-300 border-amber-500/40",
      usado: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
      cancelado: "bg-muted text-muted-foreground border-border",
      expirado: "bg-red-500/15 text-red-300 border-red-500/40",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[s]}`}
      >
        {t(`adminAccess.inviteStatus_${s}`)}
      </span>
    );
  };

  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">
            {t("adminAccess.inviteSectionTitle")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("adminAccess.inviteSectionSubtitle")}
          </p>
        </div>
      </header>

      {/* Form */}
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="md:col-span-2 space-y-1.5">
          <Label htmlFor="invite-email">{t("adminAccess.inviteEmailLabel")}</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("adminAccess.inviteEmailPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("adminAccess.invitePlanLabel")}</Label>
          <Select value={plano} onValueChange={setPlano}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {planos.map((p) => (
                <SelectItem key={p.codigo} value={p.codigo}>
                  {planoNome(p.codigo)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("adminAccess.inviteDurationLabel")}</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as "indefinite" | "days")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="indefinite">
                {t("adminAccess.durationIndefinite")}
              </SelectItem>
              <SelectItem value="days">{t("adminAccess.durationDays")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mode === "days" && (
          <div className="space-y-1.5 md:col-span-1">
            <Label htmlFor="invite-days">{t("adminAccess.days")}</Label>
            <Input
              id="invite-days"
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
        )}
        <div className="flex items-end md:col-span-4">
          <Button onClick={submit} disabled={busy} className="w-full md:w-auto">
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {busy ? t("adminAccess.inviteSending") : t("adminAccess.inviteSend")}
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="mt-6">
        <p className="mb-2 text-sm font-medium">{t("adminAccess.inviteListTitle")}</p>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("adminAccess.inviteListEmpty")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {invites.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-3 rounded-xl border border-border/50 bg-background/40 p-4"
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.email}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {planoNome(c.plano_codigo)} ·{" "}
                      {c.dias == null
                        ? t("adminAccess.durationIndefinite")
                        : `${c.dias} ${t("adminAccess.days").toLowerCase()}`}
                    </p>
                  </div>
                  {statusBadge(c.status)}
                </div>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <div>
                    <dt className="text-muted-foreground">
                      {t("adminAccess.inviteCreatedAt")}
                    </dt>
                    <dd>{fmt(c.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t("adminAccess.inviteExpiresAt")}
                    </dt>
                    <dd className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {fmt(c.expira_em)}
                    </dd>
                  </div>
                </dl>

                {c.status === "pendente" && (
                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copyLink(c)}
                    >
                      <Copy className="mr-1 h-4 w-4" />
                      {t("adminAccess.inviteCopyLink")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => cancel(c.id)}
                    >
                      <Ban className="mr-1 h-4 w-4" />
                      {t("adminAccess.inviteCancel")}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
