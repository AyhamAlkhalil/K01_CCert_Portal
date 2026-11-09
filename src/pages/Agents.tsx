import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import ReactMarkdown from "react-markdown";
import { BookOpen, Upload, TrendingUp, RotateCcw, AlertTriangle, Info, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from '@/components/PageHeader';
import { useRunAgent, EinlagerungResult } from "@/hooks/useAgents";

const COLUMN_MAP: Record<string, string> = {
  Datum: "datum",
  Lieferant: "lieferant",
  Firma: "lieferant",
  Lieferschein: "lieferschein",
  Lieferscheine: "lieferschein",
  Sorte: "sorte",
  Ort: "ort",
  Kategorie: "kategorie",
  "t/lutro": "tonnen_lutro",
  "Menge / To": "tonnen_lutro",
  SRM: "srm",
  "Menge / m³": "srm",
};
const SHEET_PRIORITY = ["Auswertungsdaten", "Gesamtliste sortiert"];

interface NormalizedRow {
  datum: string;
  lieferant: string;
  lieferschein: string;
  sorte: string;
  tonnen_lutro: number | null;
  srm: number | null;
}

function parseExcelFile(file: File): Promise<{ rows: NormalizedRow[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const sheetName = SHEET_PRIORITY.find((s) => wb.SheetNames.includes(s));
        if (!sheetName) {
          reject(new Error(`Kein bekanntes Datenblatt. Vorhanden: ${wb.SheetNames.join(", ")}`));
          return;
        }
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { raw: false });
        const rows: NormalizedRow[] = [];
        for (const r of raw) {
          const mapped: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(r)) {
            const c = COLUMN_MAP[k.trim()];
            if (c) mapped[c] = v;
          }
          if (!mapped.datum) continue;
          const parsed = Date.parse(String(mapped.datum));
          if (isNaN(parsed)) continue;
          const toNum = (v: unknown) => {
            if (v === null || v === undefined || v === "") return null;
            const n = parseFloat(String(v).replace(",", "."));
            return isNaN(n) ? null : n;
          };
          rows.push({
            datum: new Date(parsed).toISOString().slice(0, 10),
            lieferant: String(mapped.lieferant ?? "").trim(),
            lieferschein: String(mapped.lieferschein ?? "").trim(),
            sorte: String(mapped.sorte ?? "").trim(),
            tonnen_lutro: toNum(mapped.tonnen_lutro),
            srm: toNum(mapped.srm),
          });
        }
        resolve({ rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function EinlagerungForm({
  onSubmit,
  loading,
}: {
  onSubmit: (inputs: Record<string, string>) => void;
  loading: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ count: number; von: string; bis: string } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<NormalizedRow[] | null>(null);
  const [frage, setFrage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    setFile(f);
    setParseError(null);
    setPreview(null);
    setParsedRows(null);
    try {
      const { rows } = await parseExcelFile(f);
      if (!rows.length) {
        setParseError("Keine gültigen Lieferzeilen gefunden.");
        return;
      }
      const dates = rows.map((r) => r.datum).sort();
      setPreview({ count: rows.length, von: dates[0], bis: dates[dates.length - 1] });
      setParsedRows(rows);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Fehler beim Lesen.");
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border/60 rounded-lg p-6 text-center cursor-pointer hover:border-border hover:bg-accent/20 transition-colors"
      >
        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">{file ? file.name : "Excel-Datei hier ablegen"}</p>
        <p className="text-xs text-muted-foreground mt-1">.xlsx oder .xls</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
      {parseError && <p className="text-xs text-destructive">{parseError}</p>}
      {preview && (
        <p className="text-xs text-muted-foreground">
          {preview.count} Lieferungen geladen · {preview.von} – {preview.bis}
        </p>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs">Spezifische Frage (optional)</Label>
        <Textarea
          rows={3}
          value={frage}
          onChange={(e) => setFrage(e.target.value)}
          placeholder="z.B. Welche Lieferanten haben im Mai am meisten geliefert?"
        />
      </div>
      <Button
        className="w-full"
        disabled={loading || !parsedRows}
        onClick={() => onSubmit({ lieferungen: JSON.stringify(parsedRows), frage: frage.trim() })}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Auswerten
      </Button>
    </div>
  );
}

function EinlagerungResultView({ data }: { data: EinlagerungResult }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Lieferungen", value: data.gesamtLieferungen.toString() },
          { label: "t/lutro gesamt", value: data.gesamtTonnen.toFixed(1) },
          { label: "SRM gesamt", value: data.gesamtSrm.toFixed(1) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-muted/50 px-3 py-2 text-center">
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Zeitraum: {data.zeitraum}</p>
      {data.massenbilanz.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Massenbilanz monatlich
          </p>
          <div className="rounded-md border overflow-hidden text-xs">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Monat</th>
                  <th className="text-right px-3 py-2 font-medium">t/lutro</th>
                  <th className="text-right px-3 py-2 font-medium">SRM</th>
                  <th className="text-right px-3 py-2 font-medium">Lief.</th>
                </tr>
              </thead>
              <tbody>
                {data.massenbilanz.map((p, i) => (
                  <tr key={i} className="border-t border-border/40">
                    <td className="px-3 py-1.5">{p.monat}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{p.tonnen.toFixed(1)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{p.srm.toFixed(1)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{p.lieferungen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        {data.topLieferanten.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Top Lieferanten</p>
            <ul className="space-y-1">
              {data.topLieferanten.map((l, i) => (
                <li key={i} className="flex justify-between text-xs">
                  <span className="text-muted-foreground truncate pr-2">{l.name}</span>
                  <span className="tabular-nums font-medium shrink-0">{l.tonnen.toFixed(1)} t</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.topSorten.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Top Sorten</p>
            <ul className="space-y-1">
              {data.topSorten.map((s, i) => (
                <li key={i} className="flex justify-between text-xs">
                  <span className="text-muted-foreground truncate pr-2">{s.name}</span>
                  <span className="tabular-nums font-medium shrink-0">{s.tonnen.toFixed(1)} t</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {data.antwort && (
        <div className="rounded-md bg-muted/50 px-4 py-3 text-sm">
          <p className="font-medium mb-1 text-xs uppercase tracking-wide text-muted-foreground">Antwort</p>
          <ReactMarkdown>{data.antwort}</ReactMarkdown>
        </div>
      )}
      {data.auffaelligkeiten && data.auffaelligkeiten.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Auffälligkeiten</p>
          <ul className="space-y-1.5">
            {data.auffaelligkeiten.map((a, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const Agents = () => {
  const { mutate, data: result, isPending, error, reset } = useRunAgent();
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5 sm:space-y-6 animate-fade-in">
      <PageHeader title="KI-Agenten" description="Spezialisierte Assistenten für Zertifizierungsaufgaben" />
      <div className="grid md:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-warning/10">
                <BookOpen className="h-4 w-4 text-warning" />
              </div>
              <CardTitle className="text-base">Betriebstagebuch-Auswertung</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Excel-Betriebstagebuch hochladen — der Agent erstellt Massenbilanzen nach Lieferant und Sorte und
              beantwortet spezifische Fragen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EinlagerungForm
              onSubmit={(inputs) => mutate({ agentType: "einlagerung", inputs })}
              loading={isPending}
            />
          </CardContent>
        </Card>
        <Card className={`min-h-[200px] ${!result && !isPending && !error ? "border-dashed" : ""}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Ergebnis</CardTitle>
              {result && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => reset()}>
                  <RotateCcw className="h-3 w-3" />
                  Zurücksetzen
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isPending && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Agent arbeitet...</p>
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-center gap-2 text-destructive mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Fehler</span>
                </div>
                <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
              </div>
            )}
            {!isPending && !error && !result && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <BookOpen className="h-8 w-8 opacity-20" />
                <p className="text-sm">Excel hochladen und auswerten</p>
              </div>
            )}
            {result && !isPending && <EinlagerungResultView data={result as EinlagerungResult} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Agents;