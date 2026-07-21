import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AmbientGlow } from "@/components/AmbientGlow";
import { Logo } from "@/components/Logo";
import { PillButton } from "@/components/PillButton";
import { LanguageSelector } from "@/components/LanguageSelector";

interface PublicShellProps {
  children: React.ReactNode;
}

export function PublicShell({ children }: PublicShellProps) {
  const { t } = useTranslation();
  return (
    <div className="relative min-h-screen">
      <AmbientGlow />
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-3 sm:gap-3 sm:px-6">
          <Logo size="sm" to="/" />
          <nav className="ml-6 hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            <Link to="/sobre" className="hover:text-foreground">{t("public.footer.about")}</Link>
            <Link to="/contato" className="hover:text-foreground">{t("public.nav.contact")}</Link>
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <LanguageSelector />
            <Link to="/login">
              <PillButton variant="secondary" className="px-3 py-2 text-xs sm:px-6 sm:py-3 sm:text-sm">{t("public.nav.signin")}</PillButton>
            </Link>
            <Link to="/cadastro">
              <PillButton variant="primary" className="px-3 py-2 text-xs sm:px-6 sm:py-3 sm:text-sm">{t("public.nav.signup")}</PillButton>
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-border/50 bg-background/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo size="sm" />
            <p className="mt-3 text-sm text-muted-foreground">{t("public.footer.tagline")}</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link to="/sobre" className="hover:text-foreground">{t("public.footer.about")}</Link>
            <Link to="/contato" className="hover:text-foreground">{t("public.footer.contact")}</Link>
            <Link to="/termos" className="hover:text-foreground">{t("public.footer.terms")}</Link>
            <Link to="/privacidade" className="hover:text-foreground">{t("public.footer.privacy")}</Link>
          </nav>
        </div>
        <div className="border-t border-border/40 px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} Entreposto Virtual. {t("public.footer.rights")}
        </div>
      </footer>
    </div>
  );
}
