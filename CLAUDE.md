# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Antwort-Stil (Token-Effizienz)

- **So kurz wie möglich** — keine Zusammenfassungen am Ende, kein "Hier ist was ich gemacht habe"
- Keine Wiederholungen, kein Boilerplate, kein erklärtes Offensichtliches
- Code-Änderungen kommentarlos ausgeben, es sei denn Logik ist nicht selbsterklärend
- Bei Fehlern: Ursache nennen + Fix — kein Kontext-Padding

---

## Deployment-Kontext — PFLICHT lesen

Dieses Projekt läuft auf **[Lovable](https://lovable.dev)** mit Lovable-gehosteter Supabase.

- **NIEMALS** Supabase MCP (`mcp__plugin_supabase_supabase__*`) zur Authentifizierung oder Migration verwenden — der MCP-Zugriff funktioniert nicht für Lovable-gehostete Projekte
- **NIEMALS** `supabase db push`, `supabase migration up` oder ähnliche CLI-Befehle ausführen
- **Migrations-SQL** immer als kopierbaren Block ausgeben mit dem Hinweis "Im Supabase-Dashboard → SQL Editor ausführen"
- **Frontend-Änderungen** deployen via `git push` zu GitHub → Lovable baut automatisch. Kein lokaler Dev-Server als "Fix"

---

## Validierungspflicht — nach JEDER Änderung

Nach **jeder Multi-File-Änderung** zwingend ausführen, bevor "fertig" gemeldet wird:

1. `npx tsc --noEmit` — TypeScript-Fehler prüfen
2. `npm run lint` — ESLint prüfen
3. Bei Hook-Änderungen: Dashboard öffnen und testen (wegen `useAllAuditTasks()`)

**Vor Cross-Cutting-Edits (Umbenennung, deprecated Column, Validierung):**
- Zuerst mit Grep/Glob **alle** betroffenen Stellen im Codebase finden und als Checkliste ausgeben
- Erst nach Bestätigung editieren — nie nur die offensichtliche Stelle patchen
- Beispiel-Fehler: Phone-Validierung — 4 von 6 Feldern gepatcht, 2 übersehen

---

## Änderungs-Scope-Disziplin

- **Chirurgische Edits** — nichts refactoren oder umstrukturieren, was nicht explizit gefragt wurde
- Bei Bug-Fixes: erst prüfen ob ein einfacher JOIN/Query-Fix reicht, bevor neue Tabellen/Trigger/Backend-Logik gebaut wird
- Keine neuen Infrastruktur-Layer (Trigger, Edge Functions, neue Tabellen) ohne explizite Anfrage
- Keine console.logs, Kommentare oder Imports als "Aufgabe für den Nutzer" hinterlassen — immer vollständig bereinigen

---

## Commands

```bash
npm run dev        # Dev server (Vite)
npm run build      # Production build (kein echter TS-Check — immer auch npx tsc --noEmit laufen lassen)
npm run lint       # ESLint check
npm run preview    # Preview production build
npx tsc --noEmit   # Echter TypeScript-Check (Vite baut auch bei TS-Fehlern durch)
```

No test suite is configured. The app was bootstrapped with [Lovable](https://lovable.dev).

> ⚠️ **Vite baut auch bei TS-Fehlern durch** — kein Fehler im Terminal, aber das **Error Overlay blockiert ALLE Seiten** (inkl. Dashboard). `npx tsc --noEmit` nach jeder Typänderung zwingend.

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

---

## Architecture

**Stack:** React 18 + Vite + TypeScript, Supabase (PostgreSQL + Auth), TanStack Query, shadcn/ui, Tailwind CSS, React Router v6. **Kein Next.js** — alle `"use client"`-Hinweise von Hooks sind False Positives.

**Entry point:** `src/main.tsx` → `src/App.tsx`

### Routing & Auth

All routes except `/auth` are wrapped in `<ProtectedRoute><Layout />`. Auth state lives in `src/contexts/AuthContext.tsx` via `supabase.auth.onAuthStateChange`. The `useAuth()` hook exposes `user`, `session`, `loading`, `signOut`.

### Data Layer

Every entity follows the same pattern:
- **Hook file** in `src/hooks/use<Entity>.ts` — exports `useQuery`/`useMutation` wrappers around Supabase
- **Types** come from `src/integrations/supabase/types.ts` — **never hand-write DB types**, always use `Tables<'table_name'>`, `TablesInsert<'table_name'>`, `Enums<'enum_name'>`
- **Activity logging** on every mutation via `logActivity()` from `src/hooks/useActivityLog.ts`

### Seiten & Hooks (Stand April 2026)

| Route | Datei | Primärer Hook | Hinweis |
|-------|-------|--------------|---------|
| `/` | `Dashboard.tsx` | `useClients()`, `useAudits()`, `useAllAuditTasks()` | `useAllAuditTasks()` via `OpenTasksCard` — Fehler dort bricht Dashboard |
| `/audits` | `Audits.tsx` | `useAudits()` | |
| `/audits/:id` | `AuditDetail.tsx` | `useAuditTasks(auditId)` | |
| `/tasks` | `Tasks.tsx` | `useAllAuditTasks()` → `DbAuditTaskFull` | |
| `/clients` | `Clients.tsx` | `useClients()` | |

### Layout: Scroll-Ausnahmen
Pfade `/audits` und `/tasks` werden **nicht** in `scrollRef`-div gewrapped — sie verwalten ihren Scroll intern. Bei neuen Seiten mit eigenem Scroll: in `Layout.tsx` der Bedingung `['/audits', '/tasks'].includes(location.pathname)` hinzufügen.

### sessionStorage-Key-Konventionen
Schema: `{seite}-{schlüssel}` — am Seitenanfang als `const SS_KEY = '...'` definieren.

| Prefix | Seite |
|--------|-------|
| `audits-*` | Audits.tsx (search, status, group-by, …) |
| `tasks-*` | Tasks.tsx (search, status, category, due, group-by) |
| `clients-*` | Clients.tsx |
| `scroll-pos-{path}` | automatisch via `useScrollPersistence()` |

---

## Datenbankmodell (Stand April 2026)

**18 Tabellen**, 5 Postgres-Enums, RLS auf allen Tabellen aktiviert.

### Kern-Domänenmodell

```
clients (Kunden, auch hierarchisch: parent → child)
  └── client_certifications  (Zertifizierung pro Kunde, mit Ablaufdatum)
        ├── certifications        (Mastertabelle: ISO 9001, FSC, PEFC, etc.)
        ├── certification_bodies  (Zertifizierungsstelle: TÜV, etc.)
        ├── auditors              (Auditor, gehört zu einer certification_body)
        └── audits                (Audits zu dieser Zertifizierung)
              └── audit_tasks     (Aufgaben + Befunde pro Audit)
              └── audit_documents (Dokumente pro Audit)
```

Daneben:
- `contacts` — Kontakte pro Client (1:N)
- `consultants` — Berater-Mastertabelle
- `audit_templates` + `audit_template_tasks` — Vorlagen für automatische Task-Generierung
- `certification_documents` — Dokumente pro client_certification
- `client_certification_bodies` — Legacy Join-Tabelle (wird abgelöst, s.u.)
- `client_locks` — Concurrent-Edit-Schutz mit Realtime
- `profiles`, `user_roles` — Auth/Rollen
- `outlook_tokens` — OAuth für Outlook-Kalender-Integration
- `activity_log` — Audit-Trail (immutable, kein updated_at by design)

### Enums

```typescript
audit_type:    'initial' | 'surveillance' | 'recertification' | 'six-month' | 'internal' | 'training'
audit_status:  'scheduled' | 'in-progress' | 'completed' | 'cancelled'
task_status:   'pending' | 'in-progress' | 'completed' | 'overdue'
app_role:      'admin' | 'berater' | 'user'
certification_standard:  'SURE' | 'FSC' | 'PEFC' | 'ISCC' | 'ISO 9001' | 'ISO 14001'
```

### Wichtige FK-Regeln

| Beziehung | ON DELETE | Grund |
|-----------|-----------|-------|
| `audits.client_id` | RESTRICT | Client kann nicht gelöscht werden solange Audits existieren |
| `client_certifications.client_id` | RESTRICT | Client kann nicht gelöscht werden solange Zertifizierungen existieren |
| `audit_tasks.audit_id` | CASCADE | Tasks gehören dem Audit |
| `audit_documents.audit_id` | CASCADE | Dokumente gehören dem Audit |
| `contacts.client_id` | CASCADE | Kontakte gehören dem Client |
| `auditors.certification_body_id` | SET NULL | CB kann gelöscht werden |
| `audits.auditor_id` | SET NULL | Auditor kann gelöscht werden |

---

## Kritische Konventionen — Pflicht vor jeder Änderung lesen

### 1. Audit-Datum heißt `scheduled_date`
Immer `scheduled_date` verwenden — nie `date`, `audit_date` oder ähnliches.

### 2. Trigger-Funktion für `updated_at`
Immer `update_updated_at_column()` verwenden. Es existieren noch `set_updated_at()` (legacy, nicht neu verwenden) und `handle_updated_at()` (existiert nicht mehr, war ein Bug).

### 3. `audits.client_id` ist NICHT redundant
`audits` hat sowohl `client_id` als auch `client_certification_id`. Das ist kein Fehler: interne Audits (`type = 'internal'`) und Trainings (`type = 'training'`) haben keine `client_certification_id` — für diese ist `client_id` der einzige Client-Link.

### 4. `certifications` in `transformAuditToLocal` liefert max. 1 Eintrag
Die lokale `Audit.certifications: string[]` wird aus `client_certifications?.certifications?.name` befüllt — maximal ein Zertifizierungsname. Das ist Design, kein Bug. Outlook-Sync bekommt immer `certifications: []`.

### 5. `src/types/audit.ts` ist der lokale Frontend-Typ
`Audit` und `Client` in `src/types/audit.ts` sind lokale UI-Typen (camelCase, Dates als `Date`-Objekte). Sie unterscheiden sich bewusst von den DB-Typen (`Tables<'audits'>` etc.). `transformAuditToLocal()` in `src/lib/auditUtils.ts` übersetzt zwischen beiden.

### 6. ⚠️ Supabase `.select()` — Spaltennamen 1:1 aus `types.ts` abschreiben, NIE raten
Falsche Namen → Runtime-Fehler oder leeres Ergebnis (Supabase gibt kein Error zurück). Immer `src/integrations/supabase/types.ts` öffnen und exakten Namen kopieren.

| ✅ Richtig | ❌ Falsch |
|-----------|---------|
| `scheduled_date` | `date`, `audit_date` |
| `assigned_to` | `assignee` |
| `due_date` | `deadline` |
| `valid_from` / `valid_until` | `start_date` / `end_date` |

### 7. ⚠️ `useAllAuditTasks()` bricht Dashboard — immer Dashboard testen nach Änderungen
`OpenTasksCard` auf dem Dashboard nutzt `useAllAuditTasks()`. Fehler in `useAuditTasks.ts` → Error Overlay auf allen Seiten. Nach jeder Änderung an diesem Hook Dashboard öffnen und prüfen.

---

## Bekannte Altlasten — NICHT anfassen ohne expliziten Migrationsplan

### Bereits bereinigt (April 2026)
- `clients.certifications certification_standard[]` — **gedroppt**. Code-Referenzen entfernt.
- `audits.certifications certification_standard[]` — **gedroppt**. Code-Referenzen entfernt.

### Noch aktiv aber veraltet
- **`clients.consultant TEXT`** — Die Mastertabelle `consultants` existiert bereits. Dieses Feld sollte zu `clients.consultant_id UUID FK → consultants.id` migriert werden. Migration steht aus. Altes Textfeld nicht mehr befüllen.
- **`client_certification_bodies` Tabelle** — **GEDROPPT** (Migration `20260412000003`). Alle Code-Referenzen entfernt. Zertifizierungsstellen ausschließlich über `client_certifications.certification_body_id`.

### Noch vorhandener toter Code (bekannt, nicht kritisch)
- `Calendar.tsx` Zeile ~159: `certifications: [] as string[]` in lokalem UI-Objekt — kein DB-Write, nur irreführend.

### Bekannte Fallstricke (bereits passiert — nicht wiederholen)

| Bug | Ursache | Prävention |
|-----|---------|-----------|
| Dashboard blank (alle Seiten) | `task.audits.date` statt `.scheduled_date` → Vite Error Overlay | `npx tsc --noEmit` nach jeder Typänderung |
| Supabase liefert `null`/leer | Spaltenname in `.select()` falsch | Immer aus `types.ts` kopieren, nie raten |
| Chat-Assistent: "keine Audits" trotz vorhandener Daten | KI filtert fälschlicherweise `status IN ('scheduled','in-progress')` bei allgemeiner Monat-Anfrage | System-Prompt: Status-Filter NUR bei explizit "offene/geplante" Anfrage |
| Chat-Assistent: Monatsfilter schlägt fehl | `EXTRACT(MONTH FROM scheduled_date)` auf `timestamptz` bei UTC-Grenzwerten | Immer `>= '2026-05-01' AND < '2026-06-01'` Pattern verwenden |

---

## Technische Schulden — Status (April 2026)

### Behoben ✓
1. ~~`clients.consultant TEXT`~~ — **consultant_id FK migriert**, Code schreibt jetzt beide Felder
2. ~~`client_certification_bodies` Tabelle~~ — **gedroppt**, alle Hooks auf `client_certifications` umgestellt
3. ~~Fehlende `updated_at`~~ auf `certification_bodies`, `user_roles`, `client_locks` — **ergänzt**
4. ~~`useAutomaticAuditPlanning` Performance~~ — **Serverseite gefiltert** (nur aktive Certs im 36-Monats-Fenster, nur relevante Audits)
5. ~~Activity-Log fehlte~~ für `audit_tasks` Mutations — **ergänzt**
6. ~~`useAuditTasks.ts` Bug~~ `.date` statt `.scheduled_date` — **gefixt**
7. ~~`audit_documents` Trigger~~ rief `handle_updated_at()` auf (existiert nicht) — **gefixt** auf `update_updated_at_column()`

### Noch offen (klein)
- `clients.consultant TEXT` bleibt als Fallback-Feld erhalten bis alle Altdaten migriert sind — danach DROP COLUMN
- `Calendar.tsx` `certifications: []` — irreführend aber harmlos

---

## Supabase Edge Functions

Located in `supabase/functions/`:
- `outlook-auth` / `outlook-callback` — Microsoft OAuth flow
- `outlook-sync` — calendar sync
- `chat-assistant` — KI-Assistent (siehe unten)

> ⚠️ **Edge Functions werden von Lovable NICHT automatisch deployed.** Git push updated nur das Frontend. Edge Functions müssen manuell im Supabase Dashboard → Edge Functions → `<name>` → Edit/Deploy aktualisiert werden.

---

## KI-Assistent (`chat-assistant`)

### Architektur — Agentic SQL-Loop

Der Assistent nutzt **`gpt-6.1-sol` (OpenAI Responses API, `reasoning.effort: low`) mit Tool-Use in einem Loop** — kein statisches Keyword-Matching, kein Pre-Fetching. Jeder Schritt wird gestreamt (`store: false`, Reasoning-Items werden verschlüsselt zurückgegeben).

**Flow:**
1. User-Nachricht → Modell mit System-Prompt (`instructions`) + `execute_sql` Tool
2. KI entscheidet selbst welche SQL-Query sie braucht und führt sie aus
3. Ergebnis geht zurück an KI → weitere Queries wenn nötig (max. 5 Iterationen, letzte ohne Tools)
4. Finale Antwort wird als SSE gestreamt

**Dateien:**
- Edge Function: `supabase/functions/chat-assistant/index.ts`
- Frontend-Client: `src/lib/chatUtils.ts` (SSE-Parser, Datei-Anhang-Support)
- Frontend-Komponente: `src/components/ChatBot.tsx`

### Erforderliche Postgres-Funktion

Die Edge Function ruft `supabase.rpc('chat_execute_sql', { query })` auf. Diese Funktion muss im Supabase Dashboard → SQL Editor einmalig angelegt werden:

```sql
CREATE OR REPLACE FUNCTION chat_execute_sql(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT (lower(trim(query)) ~ '^select') THEN
    RAISE EXCEPTION 'Nur SELECT-Abfragen erlaubt';
  END IF;
  EXECUTE format('SELECT json_agg(row_to_json(r)) FROM (%s) r', query) INTO result;
  RETURN COALESCE(result, '[]'::json);
END;
$$;
```

Migration-Datei: `supabase/migrations/20260422000002_chat_execute_sql.sql`

### Env-Variablen (Supabase Edge Function Secrets)

| Key | Zweck |
|-----|-------|
| `OPENAI_API_KEY` | `gpt-6.1-sol` für Agent-Loop + Antwort |
| `SUPABASE_URL` | automatisch gesetzt |
| `SUPABASE_ANON_KEY` | automatisch gesetzt |
| `SUPABASE_SERVICE_ROLE_KEY` | automatisch gesetzt |
| `ALLOWED_ORIGIN` | CORS-Origin (optional) |

### System-Prompt — kritische Geschäftslogik

Beim Anpassen des System-Prompts (`buildSystemPrompt` in der Edge Function) folgende Muster korrekt dokumentieren — die KI muss diese kennen um korrekte SQL zu schreiben:

| Frage-Intent | Korrektes SQL-Muster | Falsch |
|---|---|---|
| Überfällige Aufgaben | `due_date < CURRENT_DATE AND status IN ('pending', 'in-progress')` | `status = 'overdue'` — Enum-Wert wird kaum gesetzt |
| Offene Audits | `status IN ('scheduled', 'in-progress')` | `status = 'open'` — existiert nicht |
| Ablaufende Zertifikate | `valid_until BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'` | String-Vergleiche |
| Audits nach Auditor | JOIN auf `auditors.name` | Filter nach `clients.name` |

### Bekannte Fallstricke

| Bug | Ursache | Fix |
|-----|---------|-----|
| "Keine überfälligen Tasks" obwohl welche da | KI schreibt `status = 'overdue'` | Geschäftslogik im System-Prompt dokumentieren |
| Edge Function zeigt alten Stand | Lovable deployed EF nicht automatisch | Manuell im Supabase Dashboard deployen |
| Tool-Calls schlagen nach Modellwechsel fehl | GPT-5.6/GPT-6-Modelle unterstützen Function Calling nicht über `/v1/chat/completions` | Nur `/v1/responses` verwenden (Tool-Format flach: `{type, name, parameters}`) |
| IDE zeigt Deno-Fehler in `index.ts` | VS Code nutzt Node-Compiler, kennt `deno.land`-Imports nicht | False Positives — `npx tsc --noEmit` ist korrekt und zeigt keine Fehler |

---

## UI Conventions

- All UI primitives from `src/components/ui/` (shadcn/ui — no custom primitives)
- Icons exclusively from `lucide-react`
- Business logic in `src/lib/` or hooks, not in page/component files
- `src/lib/constants.ts` — alle Display-Labels und Config-Objekte für audit types, statuses, urgency
- Toast notifications via `sonner` (`import { toast } from "sonner"`)

### logActivity()
```typescript
// fire-and-forget — kein await in Komponenten
logActivity({ action, entity_type, entity_id?, entity_name?, details? });
// action: 'created' | 'updated' | 'deleted'  entity_type: Tabellenname z.B. 'audit_task'
// Aufruf immer in onSuccess-Callback der Mutation, nie im mutationFn
```

### Mobile Bottom Navigation
Nur 4 feste Items: **Dashboard** `/` · **Kunden** `/clients` · **Audits** `/audits` · **Aufgaben** `/tasks`. Alle weiteren Punkte nur in Desktop-Sidebar. Änderungen in `Layout.tsx` im inline-Array bei `{user && <nav ...>}`.

---

## Supabase Migrations

> Deployment-Regeln → siehe **Deployment-Kontext** am Anfang dieser Datei.

Migrations-Dateien in `supabase/migrations/` dienen nur zur Dokumentation.

**Workflow bei DB-Änderungen:**
1. Migration-Datei in `supabase/migrations/` schreiben (zur Dokumentation)
2. Vollständiges SQL als kopierbaren Block ausgeben: "Im Supabase-Dashboard → SQL Editor ausführen"

**Trigger-Funktion immer:** `update_updated_at_column()` — nicht `set_updated_at()` oder `handle_updated_at()`
