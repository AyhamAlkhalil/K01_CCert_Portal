import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_URL = "https://api.resend.com/emails";
const RECIPIENT = "aalkh@kitech-software.de";
const FROM = "ccert-monitor@kitech-software.de";

// ─── Ablauf ohne Anschlussaudit ──────────────────────────────────────────────
// Muss mit src/lib/certificationRisk.ts synchron gehalten werden
// (Edge Functions können nicht aus src/ importieren).

const DAY_MS = 86_400_000;
const NON_EXPIRING_CERTIFICATIONS = ["Beratung & Begleitung", "Schulung"];
const PAST_AUDIT_GRACE_DAYS = 30;
const RISK_HORIZON_DAYS = 180;
const CERT_QUERY_LIMIT = 2000;

type RiskType = "expired" | "expiring" | "no_expiry_date";

interface CertRow {
  id: string;
  valid_until: string | null;
  certifications: { name: string | null } | null;
  clients: { name: string | null; is_active: boolean | null } | null;
  audits: { status: string | null; scheduled_date: string | null }[] | null;
}

interface Risk {
  clientName: string;
  certificationName: string;
  validUntil: string | null;
  daysUntilExpiry: number | null;
  type: RiskType;
}

const toUtcDay = (iso: string): number => {
  const d = new Date(iso);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

const daysUntil = (iso: string, todayUtc: number): number =>
  Math.round((toUtcDay(iso) - todayUtc) / DAY_MS);

const RISK_ORDER: Record<RiskType, number> = { expiring: 0, expired: 1, no_expiry_date: 2 };

const buildRisks = (rows: CertRow[], todayUtc: number): Risk[] => {
  const risks: Risk[] = [];

  for (const cert of rows) {
    if (!cert.clients || cert.clients.is_active === false) continue;

    const planned = (cert.audits ?? []).some((a) =>
      (a.status === "scheduled" || a.status === "in-progress") &&
      a.scheduled_date !== null &&
      daysUntil(a.scheduled_date, todayUtc) >= -PAST_AUDIT_GRACE_DAYS
    );
    if (planned) continue;

    const certificationName = cert.certifications?.name ?? "Unbekannt";
    const clientName = cert.clients.name ?? "Unbekannt";

    if (!cert.valid_until) {
      if (NON_EXPIRING_CERTIFICATIONS.includes(certificationName)) continue;
      risks.push({ clientName, certificationName, validUntil: null, daysUntilExpiry: null, type: "no_expiry_date" });
      continue;
    }

    const days = daysUntil(cert.valid_until, todayUtc);
    if (days > RISK_HORIZON_DAYS) continue;

    risks.push({
      clientName,
      certificationName,
      validUntil: cert.valid_until,
      daysUntilExpiry: days,
      type: days < 0 ? "expired" : "expiring",
    });
  }

  return risks.sort((a, b) => {
    const byType = RISK_ORDER[a.type] - RISK_ORDER[b.type];
    if (byType !== 0) return byType;
    if (a.type === "no_expiry_date") return a.clientName.localeCompare(b.clientName);
    if (a.type === "expired") return (b.daysUntilExpiry ?? 0) - (a.daysUntilExpiry ?? 0);
    return (a.daysUntilExpiry ?? 0) - (b.daysUntilExpiry ?? 0);
  });
};

// Zeilen-Typen der Report-Abfragen (nur die im Bericht verwendeten Felder)
interface ClientRef { name: string | null }
interface OverdueTaskRow {
  title: string;
  due_date: string | null;
  assigned_to: string | null;
  audits: { clients: ClientRef | null } | null;
}
interface AuditRow {
  type: string;
  scheduled_date: string | null;
  clients: ClientRef | null;
  auditors?: { name: string | null } | null;
}
interface ExpiringCertRow {
  valid_until: string | null;
  clients: ClientRef | null;
  certifications: { name: string | null } | null;
}

const fmtFrist = (r: Risk): string => {
  if (r.daysUntilExpiry === null) return "kein Ablaufdatum hinterlegt";
  if (r.daysUntilExpiry < 0) return `seit ${Math.abs(r.daysUntilExpiry)} Tagen abgelaufen`;
  if (r.daysUntilExpiry === 0) return "läuft heute ab";
  return `in ${r.daysUntilExpiry} Tagen`;
};

Deno.serve(async (req) => {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const auth = req.headers.get("Authorization");
  if (!auth || auth !== `Bearer ${anonKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");

  if (!serviceKey || !resendKey) {
    return new Response("Missing secrets", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const in90days = new Date(today.getTime() + 90 * 86400000).toISOString().split("T")[0];
  const in30days = new Date(today.getTime() + 30 * 86400000).toISOString().split("T")[0];
  const last7days = new Date(today.getTime() - 7 * 86400000).toISOString();

  // ─── Daten parallel abfragen ───────────────────────────────────────────────
  const [
    { data: overdueTasks },
    { data: upcomingAudits },
    { data: expiringCerts },
    { data: auditsWithoutAuditor },
    { data: recentActivity },
    { data: openTasksCount },
  ] = await Promise.all([
    // Überfällige Aufgaben
    supabase
      .from("audit_tasks")
      .select("id, title, due_date, assigned_to, audits(client_id, clients(name))")
      .lt("due_date", todayStr)
      .in("status", ["pending", "in-progress"])
      .order("due_date", { ascending: true })
      .limit(20),

    // Audits in den nächsten 30 Tagen
    supabase
      .from("audits")
      .select("id, type, status, scheduled_date, clients(name), auditors(name)")
      .gte("scheduled_date", todayStr)
      .lte("scheduled_date", in30days)
      .in("status", ["scheduled", "in-progress"])
      .order("scheduled_date", { ascending: true })
      .limit(20),

    // Zertifizierungen die in 90 Tagen ablaufen
    supabase
      .from("client_certifications")
      .select("id, valid_until, clients(name), certifications(name)")
      .gte("valid_until", todayStr)
      .lte("valid_until", in90days)
      .order("valid_until", { ascending: true })
      .limit(20),

    // Scheduled Audits ohne Auditor
    supabase
      .from("audits")
      .select("id, type, scheduled_date, clients(name)")
      .is("auditor_id", null)
      .in("status", ["scheduled"])
      .gte("scheduled_date", todayStr)
      .order("scheduled_date", { ascending: true })
      .limit(20),

    // Aktivitäten letzte 7 Tage
    supabase
      .from("activity_log")
      .select("action, entity_type, entity_name, created_at")
      .gte("created_at", last7days)
      .order("created_at", { ascending: false })
      .limit(50),

    // Alle offenen Tasks gesamt
    supabase
      .from("audit_tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "in-progress"]),
  ]);

  // ─── Ablauf ohne Anschlussaudit ────────────────────────────────────────────
  // Bewusst mit expliziter Fehlerprüfung: eine leere Liste wäre sonst nicht von
  // "alles geplant" zu unterscheiden — genau die Entwarnung, die es nie geben darf.
  const { data: certRows, error: certError } = await supabase
    .from("client_certifications")
    .select("id, valid_until, certifications ( name ), clients ( name, is_active ), audits ( status, scheduled_date )")
    .limit(CERT_QUERY_LIMIT);

  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const risks = certError ? [] : buildRisks((certRows ?? []) as unknown as CertRow[], todayUtc);
  const certLimitReached = (certRows?.length ?? 0) >= CERT_QUERY_LIMIT;
  const riskStats = {
    expiring: risks.filter((r) => r.type === "expiring").length,
    expired: risks.filter((r) => r.type === "expired").length,
    noDate: risks.filter((r) => r.type === "no_expiry_date").length,
  };
  const RISK_ROW_LIMIT = 40;

  // ─── HTML-Report bauen ─────────────────────────────────────────────────────
  const section = (title: string, color: string, content: string) => `
    <div style="margin-bottom:24px;">
      <h2 style="color:${color};border-bottom:2px solid ${color};padding-bottom:6px;font-size:16px;">${title}</h2>
      ${content}
    </div>`;

  const table = (headers: string[], rows: string[][]) => `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr>${headers.map((h) => `<th style="text-align:left;padding:6px 8px;background:#f1f5f9;border:1px solid #e2e8f0;">${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r, i) => `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"};">${r.map((c) => `<td style="padding:6px 8px;border:1px solid #e2e8f0;">${c}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;

  const empty = (msg: string) => `<p style="color:#64748b;font-style:italic;">${msg}</p>`;

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("de-DE") : "–";
  const fmtType: Record<string, string> = {
    initial: "Erstzertifizierung", surveillance: "Überwachungsaudit",
    recertification: "Rezertifizierung", "six-month": "6-Monats-Audit",
    internal: "Internes Audit", training: "Training",
  };

  // Aktivitäts-Zusammenfassung
  const activityByType: Record<string, number> = {};
  for (const a of recentActivity ?? []) {
    const k = `${a.action}:${a.entity_type}`;
    activityByType[k] = (activityByType[k] ?? 0) + 1;
  }
  const activityRows = Object.entries(activityByType)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => {
      const [action, entity] = k.split(":");
      return [action, entity, String(n)];
    });

  const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><title>ccert Wochenbericht</title></head>
<body style="font-family:system-ui,sans-serif;color:#1e293b;max-width:700px;margin:0 auto;padding:24px;">
  <div style="background:#0f172a;color:#f8fafc;padding:20px 24px;border-radius:8px;margin-bottom:28px;">
    <h1 style="margin:0;font-size:20px;">ccert — Wochenbericht</h1>
    <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">Generiert am ${today.toLocaleDateString("de-DE")} um ${today.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</p>
  </div>

  <!-- KPIs -->
  <div style="display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap;">
    ${[
      ["Ablauf ohne Audit", certError ? "?" : risks.length.toString(), certError || risks.length ? "#dc2626" : "#16a34a"],
      ["Überfällige Aufgaben", (overdueTasks?.length ?? 0).toString(), overdueTasks?.length ? "#dc2626" : "#16a34a"],
      ["Audits in 30 Tagen", (upcomingAudits?.length ?? 0).toString(), "#2563eb"],
      ["Ablaufende Zertifikate (90d)", (expiringCerts?.length ?? 0).toString(), expiringCerts?.length ? "#d97706" : "#16a34a"],
      ["Audits ohne Auditor", (auditsWithoutAuditor?.length ?? 0).toString(), auditsWithoutAuditor?.length ? "#dc2626" : "#16a34a"],
    ].map(([label, val, color]) => `
      <div style="flex:1;min-width:140px;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:${color};">${val}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px;">${label}</div>
      </div>`).join("")}
  </div>

  ${certError
    ? section("⚠️ Ablauf ohne Anschlussaudit", "#dc2626",
        `<p style="background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:6px;color:#991b1b;">
           <strong>Prüfung fehlgeschlagen — diese Zahl ist KEINE Entwarnung.</strong><br>
           ${certError.message}
         </p>`)
    : risks.length
      ? section(
          `🚨 Ablauf ohne Anschlussaudit (${riskStats.expiring} laufen ab · ${riskStats.expired} abgelaufen · ${riskStats.noDate} ohne Datum)`,
          "#dc2626",
          table(
            ["Kunde", "Zertifikat", "Gültig bis", "Frist"],
            risks.slice(0, RISK_ROW_LIMIT).map((r) => [
              r.clientName,
              r.certificationName,
              fmtDate(r.validUntil),
              r.type === "expiring" ? `<strong>${fmtFrist(r)}</strong>` : fmtFrist(r),
            ])
          ) +
          (risks.length > RISK_ROW_LIMIT
            ? `<p style="color:#64748b;font-size:12px;margin-top:8px;">… und ${risks.length - RISK_ROW_LIMIT} weitere. Vollständige Liste im Dashboard.</p>`
            : "") +
          (certLimitReached
            ? `<p style="color:#b45309;font-size:12px;margin-top:8px;">Hinweis: Abfragegrenze von ${CERT_QUERY_LIMIT} Zertifizierungen erreicht — die Liste kann unvollständig sein.</p>`
            : "")
        )
      : section("✅ Ablauf ohne Anschlussaudit", "#16a34a",
          empty("Für alle ablaufenden Zertifizierungen ist ein Audit geplant."))}

  ${overdueTasks?.length
    ? section("🔴 Überfällige Aufgaben", "#dc2626", table(
        ["Aufgabe", "Kunde", "Fällig", "Zugewiesen"],
        overdueTasks.map((t: OverdueTaskRow) => [
          t.title,
          t.audits?.clients?.name ?? "–",
          fmtDate(t.due_date),
          t.assigned_to ?? "–",
        ])
      ))
    : section("✅ Überfällige Aufgaben", "#16a34a", empty("Keine überfälligen Aufgaben."))}

  ${auditsWithoutAuditor?.length
    ? section("⚠️ Geplante Audits ohne Auditor", "#d97706", table(
        ["Kunde", "Typ", "Datum"],
        auditsWithoutAuditor.map((a: AuditRow) => [
          a.clients?.name ?? "–",
          fmtType[a.type] ?? a.type,
          fmtDate(a.scheduled_date),
        ])
      ))
    : section("✅ Auditor-Abdeckung", "#16a34a", empty("Alle geplanten Audits haben einen Auditor."))}

  ${upcomingAudits?.length
    ? section("📅 Audits in den nächsten 30 Tagen", "#2563eb", table(
        ["Kunde", "Typ", "Datum", "Auditor"],
        upcomingAudits.map((a: AuditRow) => [
          a.clients?.name ?? "–",
          fmtType[a.type] ?? a.type,
          fmtDate(a.scheduled_date),
          a.auditors?.name ?? "<i>nicht gesetzt</i>",
        ])
      ))
    : section("📅 Audits in 30 Tagen", "#2563eb", empty("Keine Audits in den nächsten 30 Tagen."))}

  ${expiringCerts?.length
    ? section("⏳ Ablaufende Zertifizierungen (90 Tage)", "#d97706", table(
        ["Kunde", "Zertifizierung", "Läuft ab"],
        expiringCerts.map((c: ExpiringCertRow) => [
          c.clients?.name ?? "–",
          c.certifications?.name ?? "–",
          fmtDate(c.valid_until),
        ])
      ))
    : section("✅ Zertifizierungen", "#16a34a", empty("Keine Zertifizierungen laufen in 90 Tagen ab."))}

  ${activityRows.length
    ? section("📊 Aktivitäten letzte 7 Tage", "#475569", table(["Aktion", "Entität", "Anzahl"], activityRows))
    : section("📊 Aktivitäten", "#475569", empty("Keine Aktivitäten in den letzten 7 Tagen."))}

  <div style="margin-top:32px;padding:16px;background:#f1f5f9;border-radius:8px;font-size:12px;color:#64748b;">
    Automatisch generiert von ccert activity-monitor · <a href="https://supabase.com/dashboard/project/hgrnidbducyghefgabel" style="color:#2563eb;">Supabase Dashboard</a>
  </div>
</body>
</html>`;

  // ─── Mail senden ───────────────────────────────────────────────────────────
  const overdueCount = overdueTasks?.length ?? 0;
  const subjectFlag = certError
    ? "⚠️ Fristenprüfung fehlgeschlagen — "
    : riskStats.expiring > 0
      ? `🚨 ${riskStats.expiring} Zertifikat(e) laufen ohne geplantes Audit ab — `
      : overdueCount > 0
        ? `⚠️ ${overdueCount} überfällige Aufgaben — `
        : "✅ ";

  const mailRes = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: RECIPIENT,
      subject: `${subjectFlag}ccert Wochenbericht ${today.toLocaleDateString("de-DE")}`,
      html,
    }),
  });

  if (!mailRes.ok) {
    const err = await mailRes.text();
    console.error("Resend error:", err);
    return new Response(`Mail-Fehler: ${err}`, { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, sent_to: RECIPIENT }), {
    headers: { "Content-Type": "application/json" },
  });
});
