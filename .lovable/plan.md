
# AGROBUSINESS — Fase 0 (revisada com correções de segurança)

Plataforma do agronegócio brasileiro. Entrega: identidade visual premium responsiva (mobile/tablet/desktop), autenticação segura, fundação de banco, i18n (pt-BR/en/es), notícias do agro (job 12h) e cotação do dólar (job diário).

---

## 1. Lovable Cloud
Habilita Supabase: banco, auth, edge functions, pg_cron, pg_net.

**Auth config desta fase:** confirmação de e-mail **desativada** (login imediato pós-cadastro). Marcado no relatório como pendência a reativar antes do lançamento.

---

## 2. Design system
`src/styles.css` Tailwind v4 `@theme inline` em oklch, tokens semânticos preparados para tema claro futuro:
- `--background` ≈ #0B130E, `--card` ≈ #121C15, `--border` rgba branco 7%
- `--primary` #C2F04A, `--foreground` #EAF1EA, `--muted-foreground` #8A9590
- `--radius` 18px; botões via `rounded-full`

Fontes via `<link>` em `__root.tsx`: Space Grotesk (display 700) + Inter (body). `AmbientGlow` com blobs `blur-3xl`. Micro-interações `transition-all`, `hover:scale-[1.01]`, `active:scale-[0.98]`.

---

## 3. Layout responsivo (mobile-first + desktop premium)

Breakpoints Tailwind padrão.

**Telas públicas (splash, login, cadastro):**
- Mobile: tela inteira, coluna única.
- Tablet/Desktop: cartão centralizado (`max-w-md` login, `max-w-2xl` cadastro) sobre fundo com `AmbientGlow`. Cadastro com grid 2 colunas para campos curtos.

**Área autenticada (`_authenticated/`) — `AppShell` adaptativo:**
- Desktop (lg+): sidebar fixa shadcn (`w-64`) com Comprar, Vender, Cotação, Notícias, Alertas, Configurações. Topbar h-14 com logo, sino, seletor de idioma, avatar. Conteúdo `max-w-7xl` centralizado, `px-8`.
- Tablet (md): sidebar colapsável em modo ícone.
- Mobile (<md): sidebar drawer via hambúrguer + bottom-nav fixa (Painel, Comprar, Vender, Notícias, Mais).

**Listas (Notícias):** `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6`. Toque ≥44px no mobile, hover lift no desktop.

**Painel:** grid de cards `grid-cols-2 md:grid-cols-3`.

---

## 4. Internacionalização

`react-i18next` + `i18next-browser-languagedetector`. Recursos em `src/i18n/locales/{pt-BR,en,es}.json` com namespaces por tela (`splash`, `auth`, `signup`, `awaiting`, `blocked`, `dashboard`, `news`, `settings`, `nav`, `common`, `validation`, `notifications`, `lgpd`).

Detecção: navegador → localStorage → fallback pt-BR. Persistência em `profiles.idioma_preferido` + `preferencias.idioma` quando logado. Seletor na splash e em Configurações.

**Regra absoluta:** zero texto hardcoded. Mensagens Zod via chaves traduzidas.

---

## 5. Banco de dados (migration única)

### Convenções
`created_at`, `updated_at` (trigger `set_updated_at`), `deleted_at` (soft delete; consultas filtram `deleted_at is null`).

### Enums
`tipo_perfil` (comprador, vendedor, lojista, marca, admin), `status_perfil` (ativo, aguardando_aprovacao, bloqueado), `idioma_app` (pt-BR, en, es), `moeda_app` (BRL, USD, EUR), `tipo_dolar` (comercial, turismo, paralelo), `categoria_agro` (fruta, grao, legumes, vegetal).

### Tabelas
- **profiles** (id = auth.users.id): nome_completo, email, telefone, pais default 'Brasil', estado, cidade, cep, latitude, longitude, tipo_perfil, categorias_interesse `categoria_agro[]`, idioma_preferido, moeda_preferida, tipo_dolar_preferido default 'comercial', status, termos_aceitos_em, termos_versao.
- **preferencias**: usuario_id unique FK, idioma, moeda, tipo_dolar, temas_noticias `text[]`.
- **notificacoes**: usuario_id, tipo (alerta|noticia|preco|sistema), titulo, mensagem, lida default false, link.
- **unidades**: codigo unique, nome_chave (i18n), fator_kg. Seed: saca_60=60, tonelada=1000, kg=1, caixa=20, arroba=15.
- **cotacoes_dolar**: tipo `tipo_dolar`, valor_brl, atualizado_em.
- **noticias**: titulo, resumo, link, fonte, imagem, tema, publicado_em.
- **cotacoes_commodities** (vazia): produto, valor, moeda, unidade_id, atualizado_em.
- **clima** (vazia): regiao, temperatura, condicao, previsao jsonb, atualizado_em.

### Índices únicos PARCIAIS (soft-delete safe)
```sql
CREATE UNIQUE INDEX noticias_link_uniq      ON noticias(link)      WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX cotacoes_dolar_tipo_uniq ON cotacoes_dolar(tipo) WHERE deleted_at IS NULL;
```
Soft-delete não conflita com novos upserts.

### Triggers / funções

**`handle_new_user()` — SECURITY DEFINER, `set search_path = public`:**

```text
1. Lê raw_user_meta_data.
2. Sanitiza tipo_perfil:
   - se vier 'admin' OU vier algo fora de
     ('comprador','vendedor','lojista','marca')
     → força 'comprador'.
3. Deriva status no servidor a partir do tipo já sanitizado:
   - comprador/vendedor → 'ativo'
   - lojista/marca       → 'aguardando_aprovacao'
4. INSERT em profiles + preferencias com valores sanitizados.
```

Resultado: **é impossível se autocadastrar como admin**. Admin é atribuído apenas manualmente via SQL.

Outros: `set_updated_at()` BEFORE UPDATE em cada tabela; `public.is_admin(uuid) SECURITY DEFINER set search_path=public`.

### GRANTs
Cada tabela: `GRANT SELECT,INSERT,UPDATE,DELETE TO authenticated; GRANT ALL TO service_role`. Sem `anon`.

---

## 6. RLS (em todas as tabelas)
- **profiles**: SELECT/UPDATE próprio; admin total via `is_admin`. INSERT só via trigger (service_role). Usuário NÃO pode mudar o próprio `tipo_perfil` nem `status` (policy de UPDATE com WITH CHECK garante imutabilidade desses campos para não-admin).
- **preferencias / notificacoes**: CRUD em `usuario_id = auth.uid()`; admin total.
- **noticias, cotacoes_dolar, cotacoes_commodities, unidades**: SELECT para `authenticated` (filtra `deleted_at is null`); escrita só admin. Jobs usam service_role (bypassa RLS).
- Bloqueio: front redireciona `status='bloqueado'` para `/bloqueado`.

---

## 7. Edge Functions & cron

### `fetch-dolar` (diária, 09:00 UTC)
AwesomeAPI `https://economia.awesomeapi.com.br/json/last/USD-BRL,USD-BRL-T`. Upsert em `cotacoes_dolar` para `comercial` e `turismo`. `paralelo` editável só por admin. **EUR não é coletado nesta fase.**

### `fetch-noticias-agro` (a cada 12h)
RSS: Notícias Agrícolas, Canal Rural, Globo Rural. Parse, derivação de `tema` por keywords, upsert por `link` (único parcial), soft-delete de notícias com `publicado_em > 60 dias`.

### Agendamento
Migration habilita `pg_cron` + `pg_net`:
- `cron.schedule('fetch-dolar-daily', '0 9 * * *', ...)`
- `cron.schedule('fetch-noticias-12h', '0 */12 * * *', ...)`

Sem chaves externas.

---

## 8. Moeda — degradação elegante

`src/lib/format.ts` + `src/lib/convertCurrency.ts`:

```text
formatMoney(valorBRL, moedaPreferida, tipoDolarPreferido, cotacoes):
  se moedaPreferida === 'BRL' → Intl BRL
  se moedaPreferida === 'USD':
    busca cotacoes_dolar[tipoDolarPreferido]
    se existe → Intl USD (valorBRL / cotacao)
    senão → fallback: Intl BRL + sufixo " (BRL)"  ou "—"
  se moedaPreferida === 'EUR':
    SEM fonte nesta fase → fallback: Intl BRL + " (BRL)"
    (nunca quebra a tela; "EUR em breve")
```

Valores sempre armazenados como número base + código de moeda. Conversão real de EUR fica para fase futura.

---

## 9. Componentes reutilizáveis
`src/components/ui/`: `PillButton`, `DarkInput`, `CategoryChip`, `ThemeChip`, `SegmentedToggle`, `LanguageSelector`, `CurrencySelector`, `DollarTypeSelector`, `Logo`, `AmbientGlow`, `NotificationBell`, `NewsCard`, `LGPDCheckbox`, `AppShell`, `BottomNav`.

`src/lib/`: `format.ts`, `convertCurrency.ts`, `auth.tsx` (`useAuth`, `useProfile` via TanStack Query + `onAuthStateChange`), `i18n.ts`, `schemas.ts`.

---

## 10. Rotas (TanStack Router)

**Públicas:** `/` (splash), `/login` (+ "esqueci a senha" placeholder), `/cadastro`, `/aguardando-aprovacao`, `/bloqueado`.

**Protegidas (`_authenticated/`):** `/painel`, `/noticias` (funcional), `/configuracoes`, `/comprar`, `/vender`, `/cotacao`, `/alertas` (placeholders i18n).

---

## 11. Validação
Zod em `src/lib/schemas.ts`: email válido, senha ≥6, senhas iguais, LGPD obrigatório, ≥1 categoria, ≥1 tema. Mensagens via `validation.*`. **Cadastro NÃO envia `tipo_perfil='admin'`** — UI só oferece Comprador/Vendedor (lojista/marca virão em fase futura, e ainda assim o trigger protege).

---

## 12. Fora de escopo
Marketplace, planos, cursos, storage, alertas de preço, painel admin, cotações reais de commodities, clima real, push, recuperação de senha funcional, conversão real EUR, reativação de confirmação de e-mail.

---

## 13. Relatório pós-aplicação (PT-BR, ao final)

Cobrirá os 10 itens. Confirmações **explícitas** exigidas:

- **(a) Impossível se autocadastrar como admin** — trigger sanitiza qualquer tentativa via `raw_user_meta_data` (admin/valor inválido → comprador). Promoção só via SQL manual:
  ```sql
  update public.profiles
     set tipo_perfil='admin', status='ativo'
   where email='usuario@exemplo.com';
  ```
- **(b) Confirmação de e-mail DESATIVADA nesta fase** (login imediato pós-cadastro). Reativar antes do lançamento em Cloud → Users → Auth Settings → Email.
- **(c) Índices únicos são PARCIAIS** (`WHERE deleted_at IS NULL`) em `noticias(link)` e `cotacoes_dolar(tipo)`.

Também: telas e navegação, tabelas/triggers/RLS, edge functions/cron, idiomas (0 hardcoded), integrações/segredos, responsividade mobile/tablet/desktop confirmada, EUR em fallback (BRL), pendências e próximos passos.
