import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface PlanLimites {
  max_anuncios?: number | null;
  max_alertas?: number | null;
  painel_completo?: boolean;
  clube?: boolean;
  cursos?: "preview" | "full" | string;
  [k: string]: unknown;
}

export interface CurrentPlan {
  codigo: string;
  status: "trial" | "ativa" | "expirada" | "cancelada" | "none" | string;
  trial_ate: string | null;
  inicio: string | null;
  fim: string | null;
  dias_restantes: number;
  limites: PlanLimites;
}

const FREE_FALLBACK: CurrentPlan = {
  codigo: "free",
  status: "none",
  trial_ate: null,
  inicio: null,
  fim: null,
  dias_restantes: 0,
  limites: { max_anuncios: 2, max_alertas: 1, painel_completo: false, clube: false, cursos: "preview" },
};

const ADMIN_PLAN: CurrentPlan = {
  codigo: "pro",
  status: "ativa",
  trial_ate: null,
  inicio: null,
  fim: null,
  dias_restantes: 0,
  limites: {
    max_anuncios: null,
    max_alertas: null,
    painel_completo: true,
    clube: true,
    cursos: "full",
    admin: true,
  },
};

export function usePlan() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.tipo_perfil === "admin";
  const query = useQuery({
    queryKey: ["current_plan", user?.id],
    enabled: !!user && !isAdmin,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<CurrentPlan> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("current_plan");
      if (error) throw error;
      return (data as CurrentPlan) ?? FREE_FALLBACK;
    },
  });

  const plan = isAdmin ? ADMIN_PLAN : (query.data ?? FREE_FALLBACK);
  const isPro = isAdmin || plan.limites?.painel_completo === true;
  const emTrial = !isAdmin && plan.status === "trial" && plan.dias_restantes > 0;
  const ativo = isAdmin || (plan.status === "ativa" && plan.codigo === "pro");

  return {
    plan,
    limites: plan.limites,
    codigo: plan.codigo,
    inicio: plan.inicio,
    fim: plan.fim,
    trialAte: plan.trial_ate,
    isPro,
    emTrial,
    isProAtivo: ativo,
    diasRestantesTrial: emTrial ? plan.dias_restantes : 0,
    loading: !isAdmin && query.isLoading,
  };
}

/** Detects backend paywall errors (P0001 messages from enforce_plan_* triggers). */
export function isPaywallError(err: unknown): "anuncios" | "alertas" | null {
  if (!err) return null;
  const msg =
    (err as { message?: string }).message ??
    (typeof err === "string" ? err : "");
  if (msg.includes("limite_anuncios_plano")) return "anuncios";
  if (msg.includes("limite_alertas_plano")) return "alertas";
  return null;
}
