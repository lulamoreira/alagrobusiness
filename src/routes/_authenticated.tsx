import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthGate,
});

function AuthGate() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (profile) {
      if (profile.status === "bloqueado") navigate({ to: "/bloqueado" });
      else if (profile.status === "aguardando_aprovacao") navigate({ to: "/aguardando-aprovacao" });
    }
  }, [user, profile, loading, navigate]);

  if (loading || !user || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-pulse rounded-full bg-primary/40" />
      </div>
    );
  }
  if (profile.status !== "ativo") return null;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
