import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState, useMemo, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Logo } from "./Logo";
import { CategoryApprovedModal } from "./CategoryApprovedModal";
import { LanguageSelector } from "./LanguageSelector";
import { AmbientGlow } from "./AmbientGlow";
import { PlanBadge, PlanBanner } from "./PlanStatus";
import { usePlan } from "@/lib/plan";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
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
  Briefcase,
  LineChart,
  BookOpen,
  UserCircle,
  ChevronDown,
  Menu,
  Mail,
  Sparkles,
  FolderTree,
  Rocket,
  Warehouse,


} from "lucide-react";

import { cn } from "@/lib/utils";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useAdminPerms } from "@/lib/adminPerms";

type BadgeKey = "messages";

interface NavItem {
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  badgeKey?: BadgeKey;
  pro?: boolean;
  permKey?: import("@/lib/adminPerms").AdminResource;
}

interface NavGroup {
  id: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  items: NavItem[];
  adminOnly?: boolean;
}


const SOLO_TOP: NavItem = { to: "/painel", labelKey: "nav.dashboard", icon: LayoutDashboard };
const SOLO_MESSAGES: NavItem = { to: "/mensagens", labelKey: "nav.messages", icon: MessageSquare, badgeKey: "messages" };

const GROUPS: NavGroup[] = [
  {
    id: "business",
    labelKey: "nav.groups.business",
    icon: Briefcase,
    items: [
      { to: "/comprar", labelKey: "nav.buy", icon: ShoppingCart },
      { to: "/vender", labelKey: "nav.sell", icon: Store },
      { to: "/startups", labelKey: "nav.startups", icon: Rocket },
      { to: "/negociacoes", labelKey: "nav.negotiations", icon: Handshake, pro: true },
    ],
  },
  {
    id: "management",
    labelKey: "nav.groups.management",
    icon: LineChart,
    items: [
      { to: "/financeiro", labelKey: "nav.finance", icon: Wallet, pro: true },
      { to: "/agenda", labelKey: "nav.agenda", icon: CalendarDays, pro: true },
      { to: "/relatorios", labelKey: "nav.reports", icon: BarChart3, pro: true },
    ],
  },
  {
    id: "market",
    labelKey: "nav.groups.market",
    icon: TrendingUp,
    items: [
      { to: "/cotacao", labelKey: "nav.quote", icon: TrendingUp },
      { to: "/noticias", labelKey: "nav.news", icon: Newspaper },
      { to: "/alertas", labelKey: "nav.alerts", icon: Bell },
    ],
  },
  {
    id: "learning",
    labelKey: "nav.groups.learning",
    icon: BookOpen,
    items: [
      { to: "/cursos", labelKey: "nav.courses", icon: GraduationCap },
      { to: "/certificados", labelKey: "nav.certificates", icon: Award },
    ],
  },
  {
    id: "account",
    labelKey: "nav.groups.account",
    icon: UserCircle,
    items: [
      { to: "/conta", labelKey: "nav.account", icon: UserCircle },
      { to: "/planos", labelKey: "nav.plans", icon: Crown },
      { to: "/configuracoes", labelKey: "nav.settings", icon: Settings },
    ],
  },
  {
    id: "admin",
    labelKey: "nav.groups.admin",
    icon: ShieldCheck,
    adminOnly: true,
    items: [
      { to: "/admin/cotacoes", labelKey: "adminQuotes.navLabel", icon: TrendingUp, permKey: "cotacoes" },
      { to: "/admin/acessos", labelKey: "adminAccess.navLabel", icon: ShieldCheck, permKey: "acessos" },
      { to: "/admin/cursos", labelKey: "adminCourses.navLabel", icon: GraduationCap, permKey: "cursos" },
      { to: "/admin/gestao", labelKey: "adminGestao.navLabel", icon: BarChart3, permKey: "gestao" },
      { to: "/admin/moderacao", labelKey: "adminModeracao.navLabel", icon: ShieldCheck, permKey: "moderacao" },
      { to: "/admin/contatos", labelKey: "adminContatos.navLabel", icon: Mail },
      { to: "/admin/vantagens", labelKey: "adminVantagens.navLabel", icon: Sparkles },
      { to: "/admin/catalogo", labelKey: "adminCatalogo.navLabel", icon: FolderTree },

    ],

  },
];

const MOBILE_NAV: NavItem[] = [
  { to: "/painel", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/comprar", labelKey: "nav.buy", icon: ShoppingCart },
  { to: "/vender", labelKey: "nav.sell", icon: Store },
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

function isPathActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

interface NavLeafProps {
  item: NavItem;
  active: boolean;
  badge: number;
  isPro: boolean;
  onNavigate?: () => void;
}

function NavLeaf({ item, active, badge, isPro, onNavigate }: NavLeafProps) {
  const { t } = useTranslation();
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{t(item.labelKey)}</span>
      {item.pro && !isPro && (
        <Lock className="ml-1 h-3 w-3 shrink-0 text-muted-foreground/70" aria-label={t("plan.proBadge")} />
      )}
      <Badge count={badge} />
    </Link>
  );
}

interface GroupBlockProps {
  group: NavGroup;
  pathname: string;
  unreadMessages: number;
  isPro: boolean;
  onNavigate?: () => void;
}

function GroupBlock({ group, pathname, unreadMessages, isPro, onNavigate }: GroupBlockProps) {
  const { t } = useTranslation();
  const containsActive = useMemo(
    () => group.items.some((i) => isPathActive(pathname, i.to)),
    [group.items, pathname],
  );
  const [open, setOpen] = useState(containsActive);
  const GroupIcon = group.icon;

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground/80 hover:bg-accent hover:text-foreground"
        aria-expanded={open}
      >
        <GroupIcon className="h-4 w-4 shrink-0" />
        <span className="truncate">{t(group.labelKey)}</span>
        <ChevronDown
          className={cn("ml-auto h-4 w-4 shrink-0 transition-transform", open ? "rotate-180" : "rotate-0")}
        />
      </button>
      {open && (
        <div className="ml-3 space-y-1 border-l border-border/60 pl-2">
          {group.items.map((item) => {
            const badge = item.badgeKey === "messages" ? unreadMessages : 0;
            return (
              <NavLeaf
                key={item.to}
                item={item}
                active={isPathActive(pathname, item.to)}
                badge={badge}
                isPro={isPro}
                onNavigate={onNavigate}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function NavTree({
  pathname,
  adminHas,
  adminHasAny,
  isPro,
  unreadMessages,
  onNavigate,
}: {
  pathname: string;
  adminHas: (r: import("@/lib/adminPerms").AdminResource) => boolean;
  adminHasAny: boolean;
  isPro: boolean;
  unreadMessages: number;
  onNavigate?: () => void;
}) {
  const visibleGroups = GROUPS
    .filter((g) => !g.adminOnly || adminHasAny)
    .map((g) =>
      g.id === "admin"
        ? { ...g, items: g.items.filter((i) => !i.permKey || adminHas(i.permKey)) }
        : g,
    )
    .filter((g) => g.items.length > 0);
  return (
    <div className="space-y-1">
      <NavLeaf
        item={SOLO_TOP}
        active={isPathActive(pathname, SOLO_TOP.to)}
        badge={0}
        isPro={isPro}
        onNavigate={onNavigate}
      />
      {/* First: Negócios */}
      {visibleGroups
        .filter((g) => g.id === "business")
        .map((g) => (
          <GroupBlock
            key={g.id}
            group={g}
            pathname={pathname}
            unreadMessages={unreadMessages}
            isPro={isPro}
            onNavigate={onNavigate}
          />
        ))}
      {/* Mensagens standalone */}
      <NavLeaf
        item={SOLO_MESSAGES}
        active={isPathActive(pathname, SOLO_MESSAGES.to)}
        badge={unreadMessages}
        isPro={isPro}
        onNavigate={onNavigate}
      />
      {/* Rest */}
      {visibleGroups
        .filter((g) => g.id !== "business")
        .map((g) => (
          <GroupBlock
            key={g.id}
            group={g}
            pathname={pathname}
            unreadMessages={unreadMessages}
            isPro={isPro}
            onNavigate={onNavigate}
          />
        ))}
    </div>
  );
}


export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const unreadMessages = useUnreadMessages();
  const { isPro } = usePlan();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { has: adminHas, hasAny: adminHasAny } = useAdminPerms();


  return (
    <div className="min-h-screen bg-background text-foreground">
      <AmbientGlow />

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col border-r border-border bg-card/40 backdrop-blur-md lg:flex">
        <div className="px-6 py-5">
          <Logo size="sm" to="/painel" />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <NavTree
            pathname={pathname}
            adminHas={adminHas}
            adminHasAny={adminHasAny}
            isPro={isPro}
            unreadMessages={unreadMessages}
          />
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
          <Logo size="sm" to="/painel" />
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
      <main className="mx-auto min-w-0 max-w-7xl overflow-x-clip px-4 pb-24 pt-6 md:px-6 lg:pl-72 lg:pr-8">
        <PlanBanner />
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-border bg-card/90 backdrop-blur-md lg:hidden">
        {MOBILE_NAV.map((item) => {
          const active = isPathActive(pathname, item.to);
          const Icon = item.icon;
          const badge = item.badgeKey === "messages" ? unreadMessages : 0;
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
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="relative flex flex-col items-center gap-0.5 px-3 text-[10px] font-medium text-muted-foreground"
            >
              <Menu className="h-5 w-5" />
              {t("nav.more")}
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 overflow-y-auto bg-card p-0">
            <SheetHeader className="border-b border-border px-4 py-4">
              <SheetTitle>
                <Logo size="sm" to="/painel" />
              </SheetTitle>
            </SheetHeader>
            <div className="px-3 py-3">
              <NavTree
                pathname={pathname}
                adminHas={adminHas}
            adminHasAny={adminHasAny}
                isPro={isPro}
                unreadMessages={unreadMessages}
                onNavigate={() => setMobileOpen(false)}
              />
              <button
                onClick={() => {
                  setMobileOpen(false);
                  void signOut();
                }}
                className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                {t("common.logout")}
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
      <CategoryApprovedModal />
    </div>
  );
}

