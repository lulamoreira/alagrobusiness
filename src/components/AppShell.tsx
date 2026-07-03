import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { Logo } from "./Logo";
import { LanguageSelector } from "./LanguageSelector";
import { AmbientGlow } from "./AmbientGlow";
import { PlanBadge, PlanBanner } from "./PlanStatus";
import { usePlan } from "@/lib/plan";
import {
  LayoutDashboard,
  ShoppingCart,
  Store,
  MessageSquare,
  Handshake,
  TrendingUp,
  Newspaper,
  Bell,
  Settings,
  ShieldCheck,
  LogOut,
  Wallet,
  CalendarDays,
  BarChart3,
  Lock,
  Crown,
  GraduationCap,
  Award,
} from "lucide-react";


import { cn } from "@/lib/utils";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import type { ReactNode } from "react";

interface NavItem {
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  badgeKey?: "messages";
  pro?: boolean;
}

const NAV: NavItem[] = [
  { to: "/painel", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/comprar", labelKey: "nav.buy", icon: ShoppingCart },
  { to: "/vender", labelKey: "nav.sell", icon: Store },
  { to: "/negociacoes", labelKey: "nav.negotiations", icon: Handshake, pro: true },
  { to: "/mensagens", labelKey: "nav.messages", icon: MessageSquare, badgeKey: "messages" },
  { to: "/financeiro", labelKey: "nav.finance", icon: Wallet, pro: true },
  { to: "/agenda", labelKey: "nav.agenda", icon: CalendarDays, pro: true },
  { to: "/relatorios", labelKey: "nav.reports", icon: BarChart3, pro: true },
  { to: "/cotacao", labelKey: "nav.quote", icon: TrendingUp },
  { to: "/noticias", labelKey: "nav.news", icon: Newspaper },
  { to: "/alertas", labelKey: "nav.alerts", icon: Bell },
  { to: "/cursos", labelKey: "nav.courses", icon: GraduationCap },
  { to: "/certificados", labelKey: "nav.certificates", icon: Award },
  { to: "/planos", labelKey: "nav.plans", icon: Crown },
  { to: "/configuracoes", labelKey: "nav.settings", icon: Settings },
];


const MOBILE_NAV: NavItem[] = [
  { to: "/painel", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/comprar", labelKey: "nav.buy", icon: ShoppingCart },
  { to: "/vender", labelKey: "nav.sell", icon: Store },
  { to: "/negociacoes", labelKey: "nav.negotiations", icon: Handshake },
  { to: "/mensagens", labelKey: "nav.messages", icon: MessageSquare, badgeKey: "messages" },
];

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function MobileBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-2 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const unreadMessages = useUnreadMessages();
  const { isPro } = usePlan();

  const resolveBadge = (key?: NavItem["badgeKey"]) => {
    if (key === "messages") return unreadMessages;
    return 0;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AmbientGlow />

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col border-r border-border bg-card/40 backdrop-blur-md lg:flex">
        <div className="px-6 py-5">
          <Logo size="sm" />
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active =
              pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            const badge = resolveBadge(item.badgeKey);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{t(item.labelKey)}</span>
                {item.pro && !isPro && (
                  <Lock className="ml-1 h-3 w-3 text-muted-foreground/70" aria-label={t("plan.proBadge")} />
                )}
                <Badge count={badge} />
              </Link>
            );
          })}
          {profile?.tipo_perfil === "admin" && (
            <>
              <Link
                to="/admin/cotacoes"
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  pathname.startsWith("/admin/cotacoes")
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{t("adminQuotes.navLabel")}</span>
              </Link>
              <Link
                to="/admin/acessos"
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  pathname.startsWith("/admin/acessos")
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{t("adminAccess.navLabel")}</span>
              </Link>
              <Link
                to="/admin/cursos"
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  pathname.startsWith("/admin/cursos")
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{t("adminCourses.navLabel")}</span>
              </Link>
              <Link
                to="/admin/gestao"
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  pathname.startsWith("/admin/gestao")
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{t("adminGestao.navLabel")}</span>
              </Link>
              <Link
                to="/admin/moderacao"
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  pathname.startsWith("/admin/moderacao")
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{t("adminModeracao.navLabel")}</span>
            </>
          )}
        </nav>

        <button
          onClick={signOut}
          className="m-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          {t("common.logout")}
        </button>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/70 px-4 backdrop-blur-md lg:pl-72 lg:pr-8">
        <div className="lg:hidden">
          <Logo size="sm" />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <PlanBadge />
          <LanguageSelector />
          <div className="hidden items-center gap-2 md:flex">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
              {profile?.nome_completo?.[0]?.toUpperCase() ?? "?"}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 md:px-6 lg:pl-72 lg:pr-8">
        <PlanBanner />
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-border bg-card/90 backdrop-blur-md lg:hidden">
        {MOBILE_NAV.map((item) => {
          const active =
            pathname === item.to || pathname.startsWith(`${item.to}/`);
          const Icon = item.icon;
          const badge = resolveBadge(item.badgeKey);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-3 text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                <MobileBadge count={badge} />
              </span>
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
