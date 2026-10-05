import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function sendAlertEmail(subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "ccert-alerts@kitech-software.de",
      to: "aalkh@kitech-software.de",
      subject,
      html,
    }),
  }).catch(() => {});
}

const CORS_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

// GPT-6-Modelle unterstützen Tool-Calls nur über die Responses API, nicht über Chat Completions
const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-6.1-sol";
const REASONING_EFFORT = "low";
const MAX_ITERATIONS = 5;

const fetchOpenAI = async (apiKey: string, body: object, retries = 2): Promise<Response> => {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429 && retries > 0) {
    const retryAfter = Math.max(parseInt(res.headers.get("Retry-After") ?? "4", 10), 4);
    await new Promise<void>((r) => setTimeout(r, Math.min(retryAfter * 1000, 10_000)));
    return fetchOpenAI(apiKey, body, retries - 1);
  }
  return res;
};

// ─── System Prompt ────────────────────────────────────────────────────────────

const buildSystemPrompt = (appBaseUrl: string, todayStr: string) => `
Du bist ein intelligenter Assistent im Zertifizierungs-Management-System von CERT CONSULTING PANE.
Heute: ${todayStr}

═══════════════════════════════════════
ARBEITSWEISE — PFLICHT
═══════════════════════════════════════
1. Verstehe die genaue Absicht der Frage — was wird wirklich gesucht?
2. Plane: welche Tabellen und JOINs brauche ich?
3. Führe SQL-Abfragen aus. Wenn eine leer zurückkommt → NICHT aufgeben, anderen Ansatz versuchen
4. Erst nach mindestens 2–3 verschiedenen Versuchen "keine Daten" zurückgeben
5. Antworte erst wenn du echte Ergebnisse hast oder alle Alternativen ausgeschöpft sind

HARTNÄCKIGKEIT:
- Leeres Ergebnis ≠ "keine Daten" — zuerst breiteren Filter versuchen (weniger WHERE-Bedingungen)
- Namen immer mit ILIKE '%term%' suchen — nie exakter Vergleich
- Wenn Suche nach Name nichts findet: Teilstring versuchen, Tippfehler berücksichtigen
- Wenn eine Tabelle leer scheint: ohne Filter prüfen ob überhaupt Daten existieren

═══════════════════════════════════════
DATENBANK-SCHEMA (PostgreSQL, Schema: public)
═══════════════════════════════════════
clients
  id, name, client_number, contact_person, email, phone, address, country, notes,
  is_active (bool), audit_mode ('on-site' | 'remote' | 'hybrid'),
  consultant_id (→ consultants.id, nullable),
  consultant (text, Altfeld — bei Altdaten steht der Berater-Name nur hier),
  parent_client_id (→ clients.id, nullable — Mutterfirma)

audits
  id, client_id (→ clients.id), client_certification_id (→ client_certifications.id, nullable),
  type (audit_type), status (audit_status), scheduled_date (timestamptz),
  notes (text, nullable), auditor_id (→ auditors.id, nullable),
  certification_body_id (→ certification_bodies.id, nullable)

audit_tasks  (Aufgaben UND Feststellungen/Befunde)
  id, audit_id (→ audits.id), title, description (nullable),
  category ('task' = Aufgabe | 'finding' = Feststellung/Nichtkonformität),
  severity (nur bei 'finding': 'major' = Haupt-NK | 'minor' = Neben-NK | 'recommendation' = Empfehlung),
  status (task_status), due_date (date), completed_at (nullable),
  assigned_to (text, Name als Freitext, nullable)

client_certifications
  id, client_id (→ clients.id), certification_id (→ certifications.id),
  certification_body_id (→ certification_bodies.id, nullable),
  auditor_id (→ auditors.id, nullable), status (text, nullable),
  valid_from (date, nullable), valid_until (date, nullable),
  certificate_number (text, nullable), scope (text, nullable), notes (nullable)

certifications      – id, name, description   [ISO 9001, ISO 14001, FSC, PEFC, SURE, ISCC, …]
certification_bodies – id, name, short_name, contact_person, email, phone, website
auditors            – id, name, email, phone, certification_body_id (→ certification_bodies.id)
contacts            – id, client_id, name, role, email, phone, is_primary (bool)
consultants         – id, name, email, phone, is_active (bool)
activity_log        – id, action ('created' | 'updated' | 'deleted'), entity_type, entity_id, entity_name,
                      details, user_id, user_name, created_at
audit_documents     – id, audit_id (→ audits.id), file_name, mime_type, created_at
certification_documents – id, client_certification_id (→ client_certifications.id), file_name, mime_type, created_at

ENUM-WERTE:
  audit_type:   initial | surveillance | recertification | six-month | internal | training
  audit_status: scheduled | in-progress | completed | cancelled
  task_status:  pending | in-progress | completed | overdue

═══════════════════════════════════════
GESCHÄFTSLOGIK — KRITISCH
═══════════════════════════════════════
• Überfällige Aufgaben:
    due_date < CURRENT_DATE AND status IN ('pending', 'in-progress')
    → NIEMALS status = 'overdue' — dieser Wert wird kaum gesetzt!

• Offene/anstehende Audits (nur wenn User explizit "offen", "geplant", "anstehend" fragt):
    status IN ('scheduled', 'in-progress')
    → Fragt der User nur nach "Audits in Monat X" ohne "offen" → ALLE Status zeigen, KEIN Status-Filter!

• Ablaufende Zertifikate (z.B. 90 Tage):
    valid_until BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'

• Nächstes Audit:
    status IN ('scheduled','in-progress') ORDER BY scheduled_date ASC LIMIT 1

• Audits eines Auditors: JOIN über audits.auditor_id → auditors.id, Filter auf auditors.name ILIKE
  auditors.name enthält Vor- UND Nachname im selben Feld → ILIKE '%Carsten%' findet "Carsten Sellmann"

• Monatsfilter auf scheduled_date (timestamptz) — IMMER so (timezone-sicher):
    a.scheduled_date >= '2026-05-01' AND a.scheduled_date < '2026-06-01'
    → NIEMALS EXTRACT(MONTH FROM ...) alleine — kann bei UTC-Grenzwerten falsche Ergebnisse liefern

• Wochenbezug ("diese Woche", "nächste Woche"): Woche = Montag bis Sonntag
    diese Woche: >= date_trunc('week', CURRENT_DATE) AND < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'

• Feststellungen / Befunde / NKs / Abweichungen: audit_tasks.category = 'finding'
  Reine Aufgaben: audit_tasks.category = 'task'
  Fragt der User allgemein nach "Aufgaben" → beide Kategorien, Feststellungen kennzeichnen

• Berater eines Kunden: LEFT JOIN consultants cons ON c.consultant_id = cons.id,
  Filter IMMER auf beide Felder: (cons.name ILIKE '%X%' OR c.consultant ILIKE '%X%')

• Mutter-/Tochterfirmen: clients.parent_client_id → clients.id

═══════════════════════════════════════
BEISPIEL-QUERIES (als Orientierung)
═══════════════════════════════════════
-- Audits eines Auditors (alle Status, kein Status-Filter wenn nicht explizit gefragt)
SELECT a.id, a.type, a.status, a.scheduled_date, c.name AS client
FROM audits a
JOIN clients c ON a.client_id = c.id
LEFT JOIN auditors au ON a.auditor_id = au.id
WHERE au.name ILIKE '%Sellmann%'
ORDER BY a.scheduled_date LIMIT 50;

-- Audits eines Auditors in einem bestimmten Monat (ALLE Status — kein status-Filter!)
SELECT a.id, a.type, a.status, a.scheduled_date, c.name AS client, au.name AS auditor
FROM audits a
JOIN clients c ON a.client_id = c.id
LEFT JOIN auditors au ON a.auditor_id = au.id
WHERE au.name ILIKE '%Carsten%'
  AND a.scheduled_date >= '2026-05-01'
  AND a.scheduled_date < '2026-06-01'
ORDER BY a.scheduled_date LIMIT 50;

-- Überfällige Aufgaben
SELECT t.id, t.title, t.due_date, t.status, c.name AS client, c.id AS client_id, a.id AS audit_id
FROM audit_tasks t
JOIN audits a ON t.audit_id = a.id
JOIN clients c ON a.client_id = c.id
WHERE t.due_date < CURRENT_DATE AND t.status IN ('pending','in-progress')
ORDER BY t.due_date LIMIT 50;

-- Ablaufende Zertifikate
SELECT cc.id, c.name AS client, c.id AS client_id, cert.name AS standard,
       cc.valid_until, cc.certificate_number,
       (cc.valid_until - CURRENT_DATE) AS days_left
FROM client_certifications cc
JOIN clients c ON cc.client_id = c.id
JOIN certifications cert ON cc.certification_id = cert.id
WHERE cc.valid_until BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
ORDER BY cc.valid_until LIMIT 50;

-- Kunden-Details inkl. Zertifikate und Audits
SELECT c.*, co.name AS standard, cc.valid_until, cc.status AS cert_status
FROM clients c
LEFT JOIN client_certifications cc ON cc.client_id = c.id
LEFT JOIN certifications co ON cc.certification_id = co.id
WHERE c.name ILIKE '%Müller%'
LIMIT 50;

═══════════════════════════════════════
AUSGABE-REGELN
═══════════════════════════════════════
- IMMER execute_sql nutzen wenn Daten gefragt sind — nie etwas erfinden
- Jede Abfrage mit LIMIT (max. 50) und sinnvollem ORDER BY
- KEIN Semikolon am Ende der SQL-Query — verursacht Syntax-Fehler
- Überfällige/kritische Einträge mit ⚠️ hervorheben
- Antworten: Deutsch, präzise, Markdown erlaubt
- Links nur mit echten IDs aus Abfrage-Ergebnissen:
    Audit: [Audit öffnen](${appBaseUrl}/audits/{id})
    Kunde: [{name}](${appBaseUrl}/clients/{id})
`.trim();

// ─── Tool Definition ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    type: "function",
    name: "execute_sql",
    description:
      "Führt eine PostgreSQL SELECT-Abfrage auf der Datenbank aus und gibt die Ergebnisse zurück. Nutze dieses Tool um beliebige Daten zu suchen und abzufragen. Du kannst mehrere Abfragen hintereinander ausführen.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Eine gültige PostgreSQL SELECT-Abfrage. Immer mit LIMIT (max. 50).",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
  },
];

// ─── Message types ────────────────────────────────────────────────────────────

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: string } };

interface IncomingMessage {
  role: string;
  content: string | ContentPart[];
}

interface OutputItem {
  type: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: { type: string; text?: string }[];
  [key: string]: unknown;
}

const toInputItems = (msgs: IncomingMessage[]) =>
  msgs
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: Array.isArray(m.content)
        ? m.content.map((p) =>
            p.type === "text"
              ? { type: "input_text", text: p.text }
              : { type: "input_image", image_url: p.image_url.url },
          )
        : String(m.content),
    }));

// Liest den SSE-Stream der Responses API: Text-Deltas sofort weiterreichen, fertige Output-Items sammeln
const readResponseStream = async (
  res: Response,
  onText: (delta: string) => Promise<void>,
): Promise<OutputItem[]> => {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const items: OutputItem[] = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      const evt = JSON.parse(payload);
      switch (evt.type) {
        case "response.output_text.delta":
          await onText(evt.delta ?? "");
          break;
        case "response.output_item.done":
          if (evt.item) items.push(evt.item);
          break;
        case "response.failed":
          throw new Error(`OpenAI response failed: ${evt.response?.error?.message ?? "unbekannt"}`);
        case "error":
          throw new Error(`OpenAI stream error: ${evt.error?.message ?? evt.message ?? "unbekannt"}`);
      }
    }
  }
  return items;
};

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": CORS_HEADERS,
  };

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ALLOWED_ORIGIN = (Deno.env.get("ALLOWED_ORIGIN") ?? "").trim();
    if (ALLOWED_ORIGIN) corsHeaders["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    // Auth check — in Deno Edge Functions muss der JWT explizit übergeben werden
    const jwt = authHeader.replace("Bearer ", "");
    const authSupabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await authSupabase.auth.getUser(jwt);
    if (authErr || !user) {
      console.error("Auth error:", authErr?.message ?? "no user");
      return new Response(JSON.stringify({ error: "Ungültiger Token." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    let body: { messages?: unknown };
    try { body = await req.json(); } catch { body = {}; }
    const { messages } = body;
    const userMessages = (Array.isArray(messages) ? messages : []).slice(-10) as IncomingMessage[];

    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = new Date();
    const todayStr = `${now.toLocaleDateString("de-DE", {
      weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin",
    })} (ISO: ${now.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })})`;
    const requestOrigin = req.headers.get("origin")?.trim() ?? "";
    const appBaseUrl = ALLOWED_ORIGIN && requestOrigin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "";
    const systemPrompt = buildSystemPrompt(appBaseUrl, todayStr);

    // ─── Stream sofort öffnen, Loop im Hintergrund ────────────────────────────
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    const emitSSE = (eventType: string | null, data: string) => {
      const line = eventType
        ? `event: ${eventType}\ndata: ${data}\n\n`
        : `data: ${data}\n\n`;
      return writer.write(encoder.encode(line));
    };

    const emitDelta = (content: string) =>
      emitSSE(null, JSON.stringify({ choices: [{ delta: { content } }] }));

    (async () => {
      const input: unknown[] = toInputItems(userMessages);
      let queryCount = 0;
      let textEmitted = false;

      try {
        await emitSSE("agent_meta", JSON.stringify({ agent: { id: "assistant", name: "Assistent", icon: "🤖" } }));

        for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
          const res = await fetchOpenAI(OPENAI_API_KEY, {
            model: MODEL,
            instructions: systemPrompt,
            input,
            tools: TOOLS,
            tool_choice: iter === MAX_ITERATIONS - 1 ? "none" : "auto",
            reasoning: { effort: REASONING_EFFORT },
            store: false,
            include: ["reasoning.encrypted_content"],
            stream: true,
          });

          if (!res.ok) {
            const err = await res.text();
            console.error(`OpenAI error (iter ${iter}):`, res.status, err);
            if (res.status === 429) {
              let errMsg = "Zu viele Anfragen. Bitte warten.";
              try {
                const parsed = JSON.parse(err);
                if (parsed?.error?.code === "insufficient_quota") {
                  errMsg = "OpenAI-Guthaben aufgebraucht. Bitte Konto unter platform.openai.com aufladen.";
                }
              } catch { /* ignore */ }
              await emitSSE("error", JSON.stringify({ error: errMsg }));
              await emitSSE(null, "[DONE]");
              return;
            }
            throw new Error(`OpenAI ${res.status}`);
          }

          let iterHasText = false;
          const items = await readResponseStream(res, async (delta) => {
            if (!iterHasText && textEmitted) await emitDelta("\n\n");
            iterHasText = true;
            textEmitted = true;
            await emitDelta(delta);
          });

          const calls = items.filter((i) => i.type === "function_call");
          if (!calls.length) break;

          // Reasoning-Items und Tool-Calls zurückgeben, damit das Modell im nächsten Schritt den Kontext behält
          for (const item of items) {
            if (item.type === "reasoning") {
              input.push(item);
            } else if (item.type === "function_call") {
              input.push({ type: "function_call", call_id: item.call_id, name: item.name, arguments: item.arguments });
            } else if (item.type === "message") {
              const text = (item.content ?? []).map((c) => c.text ?? "").join("");
              if (text) input.push({ role: "assistant", content: text });
            }
          }

          // Tool calls → thinking event + SQL ausführen
          for (const call of calls) {
            let query = "";
            try { query = String(JSON.parse(call.arguments || "{}").query ?? ""); } catch { /* Modell erhält Fehler als Tool-Ergebnis */ }
            queryCount++;

            console.log(`[Agent] User:${userId} iter:${iter} SQL: ${query.slice(0, 120)}`);
            await emitSSE("thinking", JSON.stringify({ text: `Datenbankabfrage ${queryCount}…` }));

            let toolResult: string;
            try {
              const cleanQuery = query.trim().replace(/;+\s*$/, "");
              if (!cleanQuery.toLowerCase().startsWith("select")) {
                toolResult = "Fehler: Nur SELECT-Abfragen erlaubt.";
              } else {
                const { data: sqlData, error: sqlErr } = await supabase.rpc("chat_execute_sql", { query: cleanQuery });
                if (sqlErr) {
                  console.error("SQL error:", sqlErr.message);
                  toolResult = `SQL-Fehler: ${sqlErr.message}\nQuery: ${cleanQuery.slice(0, 300)}\nBitte SQL korrigieren und erneut versuchen.`;
                } else {
                  const rows = Array.isArray(sqlData) ? sqlData : (sqlData ?? []);
                  toolResult = rows.length === 0
                    ? "Keine Ergebnisse gefunden."
                    : JSON.stringify(rows);
                }
              }
            } catch (e) {
              toolResult = `Fehler: ${e instanceof Error ? e.message : "unbekannt"}`;
            }

            input.push({ type: "function_call_output", call_id: call.call_id, output: toolResult });
          }
        }

        if (!textEmitted) {
          await emitDelta("Dazu konnte ich keine Antwort erstellen. Bitte formuliere die Frage etwas genauer.");
        }
        await emitSSE(null, "[DONE]");
      } catch (e) {
        const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        console.error("chat-assistant FATAL:", msg);
        await sendAlertEmail(
          "⚠️ ccert KI-Assistent — Kritischer Fehler",
          `<p><b>Fehler:</b> ${msg}</p><p><b>Zeit:</b> ${new Date().toISOString()}</p>`,
        );
        await emitSSE("error", JSON.stringify({ error: msg }));
        await emitSSE(null, "[DONE]");
      } finally {
        await writer.close().catch(() => {});
      }
    })();

    return new Response(readable, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.error("chat-assistant FATAL:", msg);
    await sendAlertEmail(
      "⚠️ ccert KI-Assistent — Kritischer Fehler",
      `<p><b>Fehler:</b> ${msg}</p><p><b>Zeit:</b> ${new Date().toISOString()}</p><p>Bitte prüfe den OpenAI API-Key und die Edge Function Logs im Supabase Dashboard.</p>`,
    );
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
