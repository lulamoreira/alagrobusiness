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
  dias_restantes: number;
  limites: PlanLimites;
}

const FREE_FALLBACK: CurrentPlan = {
  codigo: "free",
  status: "none",
  trial_ate: null,
  dias_restantes: 0,
  limites: { max_anuncios: 2, max_alertas: 1, painel_completo: false, clube: false, cursos: "preview" },
};

export function usePlan() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["current_plan", user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<CurrentPlan> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("current_plan");
      if (error) throw error;
      return (data as CurrentPlan) ?? FREE_FALLBACK;
    },
  });

  const plan = query.data ?? FREE_FALLBACK;
  const isPro = plan.limites?.painel_completo === true;
  const emTrial = plan.status === "trial" && plan.dias_restantes > 0;
  const ativo = plan.status === "ativa" && plan.codigo === "pro";

  return {
    plan,
    limites: plan.limites,
    codigo: plan.codigo,
    isPro,
    emTrial,
    isProAtivo: ativo,
    diasRestantesTrial: emTrial ? plan.dias_restantes : 0,
    loading: query.isLoading,
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
