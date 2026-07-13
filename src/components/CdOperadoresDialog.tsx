import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Search, X, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  centroId: string;
  centroNome: string;
}

interface OperadorRow {
  id: string;
  usuario_id: string;
  nome_completo: string | null;
  email: string | null;
}

interface UserSearchRow {
  id: string;
  nome_completo: string | null;
  email: string | null;
}

export function CdOperadoresDialog({ open, onOpenChange, centroId, centroNome }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchRow[]>([]);
  const [searching, setSearching] = useState(false);

  const { data: operadores, isLoading } = useQuery({
    queryKey: ["cd_operadores", centroId],
    enabled: open,
    queryFn: async (): Promise<OperadorRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("cd_operadores")
        .select("id, usuario_id")
        .eq("centro_id", centroId);
      if (error) throw error;
      const rows = (data ?? []) as { id: string; usuario_id: string }[];
      if (rows.length === 0) return [];
      const ids = rows.map((r) => r.usuario_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome_completo, email")
        .in("id", ids);
      const map = new Map(
        (profs ?? []).map((p) => [
          (p as { id: string }).id,
          p as { id: string; nome_completo: string | null; email: string | null },
        ]),
      );
      return rows.map((r) => ({
        id: r.id,
        usuario_id: r.usuario_id,
        nome_completo: map.get(r.usuario_id)?.nome_completo ?? null,
        email: map.get(r.usuario_id)?.email ?? null,
      }));
    },
  });

  const runSearch = async () => {
    setSearching(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("admin_search_users", {
      p_query: query,
    });
    setSearching(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setResults((data ?? []) as UserSearchRow[]);
  };

  const add = async (usuario_id: string) => {
    const existing = (operadores ?? []).find((o) => o.usuario_id === usuario_id);
    if (existing) {
      toast.error(t("adminCds.operadores.alreadyLinked"));
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("cd_operadores")
      .insert({ centro_id: centroId, usuario_id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("adminCds.operadores.added"));
    qc.invalidateQueries({ queryKey: ["cd_operadores", centroId] });
  };

  const remove = async (id: string) => {
    if (!confirm(t("adminCds.operadores.confirmRemove"))) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("cd_operadores").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("adminCds.operadores.removed"));
    qc.invalidateQueries({ queryKey: ["cd_operadores", centroId] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {t("adminCds.operadores.title")} — {centroNome}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{t("adminCds.operadores.subtitle")}</p>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("adminCds.operadores.search")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearch();
                }
              }}
            />
            <Button onClick={runSearch} disabled={searching} size="sm" className="gap-1">
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {results.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-auto rounded-lg border border-border bg-card/60 p-2">
              {results.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.nome_completo ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email ?? ""}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => add(u.id)} className="gap-1">
                    <Plus className="h-3 w-3" /> {t("adminCds.operadores.add")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-2 border-t border-border pt-3">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (operadores ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("adminCds.operadores.empty")}
            </p>
          ) : (
            <ul className="space-y-1">
              {(operadores ?? []).map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{o.nome_completo ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{o.email ?? ""}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => remove(o.id)} className="gap-1">
                    <Trash2 className="h-3.5 w-3.5" /> {t("adminCds.operadores.remove")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="gap-1">
            <X className="h-3.5 w-3.5" /> {t("adminCds.operadores.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
