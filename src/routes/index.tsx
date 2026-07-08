import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirector,
});

function IndexRedirector() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (!profile) return;
    if (!profile.perfil_completo) {
      navigate({ to: "/completar-cadastro", replace: true });
    } else if (profile.status === "ativo") {
      navigate({ to: "/painel", replace: true });
    } else if (profile.status === "bloqueado") {
      navigate({ to: "/bloqueado", replace: true });
    } else if (profile.status === "aguardando_aprovacao") {
      navigate({ to: "/aguardando-aprovacao", replace: true });
    }
  }, [user, profile, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-10 w-10 animate-pulse rounded-full bg-primary/40" />
    </div>
  );
}
