import React, { useEffect, useMemo, useState } from "react";

/**
 * Rated Capacity Tab
 * - Top card: "Rated Capacity" (editable Installed Capacity + PLF, computed Rated Capacity)
 * - New card below: "Historical Capacity" (Start/End month selectors, Net Additions with conditional colors)
 *
 * IMPORTANT:
 * - Does NOT change formatting/behavior of the Rated Capacity card above (manual inputs still allowed)
 * - Uses localStorage keys exactly as specified:
 *    - ratedCapacity_installed
 *    - ratedCapacity_plf
 * - Reads initial installed capacities from /data/Capacity.csv (single-row CSV)
 * - Reads historical monthly capacities from /data/capacity.csv (monthly time-series CSV)
 */

type SourceKey =
  | "Coal"
  | "Oil & Gas"
  | "Nuclear"
  | "Hydro"
  | "Solar"
  | "Wind"
  | "Small-Hydro"
  | "Bio Power";

const SOURCES: SourceKey[] = [
  "Coal",
  "Oil & Gas",
  "Nuclear",
  "Hydro",
  "Solar",
  "Wind",
  "Small-Hydro",
  "Bio Power",
];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function fmt2(n: number) {
  const v = round2(n);
  return v.toFixed(2);
}

function safeNum(x: unknown) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function sumSources(obj: Record<string, number>, keys: string[]) {
  return keys.reduce((acc, k) => acc + safeNum(obj[k]), 0);
}

function parseCSVSimple(text: string) {
  // Minimal CSV parser that supports quoted fields and commas inside quotes.
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return { header: [], rows: [] as string[][] };

  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = line[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        // escaped quote
        cur += '"';
        i++;
        continue;
      }

      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (ch === "," && !inQuotes) {
        out.push(cur.trim());
        cur = "";
        continue;
      }

      cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  const header = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { header, rows };
}

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        {right ? <div className="text-sm text-slate-600">{right}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function numberInputClass() {
  return "w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 tabular-nums";
}

function monthKeyToLabel(m: string) {
  // expects MM/YYYY
  return m;
}

function compareMonthKey(a: string, b: string) {
  // MM/YYYY
  const [am, ay] = a.split("/").map((x) => Number(x));
  const [bm, by] = b.split("/").map((x) => Number(x));
  if (ay !== by) return ay - by;
  return am - bm;
}

function minusMonths(monthKey: string, monthsBack: number) {
  const [mm, yyyy] = monthKey.split("/").map((x) => Number(x));
  let m = mm;
  let y = yyyy;
  let left = monthsBack;

  while (left > 0) {
    m -= 1;
    if (m <= 0) {
      m = 12;
      y -= 1;
    }
    left -= 1;
  }
  return `${String(m).padStart(2, "0")}/${String(y)}`;
}

function clampMonthKeyToOptions(target: string, options: string[]) {
  if (!options.length) return target;
  if (options.includes(target)) return target;

  // pick nearest earlier; else earliest
  const sorted = options.slice().sort(compareMonthKey);
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (compareMonthKey(sorted[i], target) <= 0) return sorted[i];
  }
  return sorted[0];
}

function netColorClass(v: number) {
  if (v > 0) return "text-emerald-600";
  if (v < 0) return "text-rose-600";
  return "text-slate-700";
}

export default function RatedCapacity() {
  // ----------------------------
  // Rated Capacity (top card)
  // ----------------------------
  const INSTALLED_KEY = "ratedCapacity_installed";
  const PLF_KEY = "ratedCapacity_plf";

  const [installed, setInstalled] = useState<Record<SourceKey, number>>(() => {
    // Default: 0 for all
    const base = Object.fromEntries(SOURCES.map((s) => [s, 0])) as Record<SourceKey, number>;
    // LocalStorage override
    try {
      const raw = localStorage.getItem(INSTALLED_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        for (const s of SOURCES) base[s] = safeNum(obj?.[s]);
      }
    } catch {
      // ignore
    }
    return base;
  });

  const [plf, setPlf] = useState<Record<SourceKey, number>>(() => {
    const base = Object.fromEntries(SOURCES.map((s) => [s, 0])) as Record<SourceKey, number>;
    try {
      const raw = localStorage.getItem(PLF_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        for (const s of SOURCES) base[s] = safeNum(obj?.[s]);
      }
    } catch {
      // ignore
    }
    return base;
  });

  const [capacityCsvMissing, setCapacityCsvMissing] = useState(false);
  const [capacityCsvMsg, setCapacityCsvMsg] = useState<string | null>(null);

  // Load initial installed capacities from /data/Capacity.csv (single row)
  useEffect(() => {
    let cancelled = false;

    async function loadCapacitySingleRow() {
      try {
        const res = await fetch(`/data/Capacity.csv?v=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const { header, rows } = parseCSVSimple(text);
        if (!header.length || !rows.length) throw new Error("Empty CSV");

        const row = rows[0] || [];
        const map: Record<string, string> = {};
        header.forEach((h, i) => {
          map[h] = row[i] ?? "";
        });

        const next = { ...installed };
        let any = false;
        for (const s of SOURCES) {
          const v = safeNum(map[s]);
          if (Number.isFinite(v)) {
            next[s] = v;
            any = true;
          }
        }

        if (!cancelled && any) {
          setInstalled(next);
          setCapacityCsvMissing(false);
          setCapacityCsvMsg(null);
        }
      } catch {
        if (!cancelled) {
          setCapacityCsvMissing(true);
          setCapacityCsvMsg("Capacity.csv not loaded – enter values manually.");
        }
      }
    }

    // Only try to load if localStorage doesn't already have something non-zero.
    // (keeps manual edits stable)
    const hasNonZeroLocal = Object.values(installed).some((v) => Number(v) !== 0);
    if (!hasNonZeroLocal) loadCapacitySingleRow();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(INSTALLED_KEY, JSON.stringify(installed));
    } catch {
      // ignore
    }
  }, [installed]);

  useEffect(() => {
    try {
      localStorage.setItem(PLF_KEY, JSON.stringify(plf));
    } catch {
      // ignore
    }
  }, [plf]);

  const installedTotal = useMemo(() => {
    return sumSources(installed as unknown as Record<string, number>, SOURCES);
  }, [installed]);

  const ratedBySource = useMemo(() => {
    const out: Record<SourceKey, number> = {} as any;
    for (const s of SOURCES) {
      out[s] = round2(safeNum(installed[s]) * (safeNum(plf[s]) / 100));
    }
    return out;
  }, [installed, plf]);

  const ratedTotal = useMemo(() => {
    return sumSources(ratedBySource as unknown as Record<string, number>, SOURCES);
  }, [ratedBySource]);

  // ----------------------------
  // Historical Capacity (new card)
  // ----------------------------
  type MonthRow = {
    month: string; // MM/YYYY
    values: Record<SourceKey, number>;
  };

  const [history, setHistory] = useState<MonthRow[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const monthOptions = useMemo(() => {
    const opts = history.map((r) => r.month).filter(Boolean);
    return opts.slice().sort(compareMonthKey);
  }, [history]);

  const latestMonth = useMemo(() => {
    if (!monthOptions.length) return null;
    return monthOptions[monthOptions.length - 1];
  }, [monthOptions]);

  const defaultStartMonth = useMemo(() => {
    if (!latestMonth) return null;
    // "Start: 12 months before the end month in the data."
    const candidate = minusMonths(latestMonth, 12);
    return clampMonthKeyToOptions(candidate, monthOptions);
  }, [latestMonth, monthOptions]);

  const [startMonth, setStartMonth] = useState<string>("");
  const [endMonth, setEndMonth] = useState<string>("");

  // Load /data/capacity.csv (monthly history)
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        setHistoryError(null);
        const res = await fetch(`/data/capacity.csv?v=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const { header, rows } = parseCSVSimple(text);
        if (!header.length || !rows.length) throw new Error("Empty CSV");

        // Expect: Month, Coal, Oil & Gas, Nuclear, Hydro, Solar, Wind, Small-Hydro, Bio Power
        const monthIdx = header.findIndex((h) => h.trim().toLowerCase() === "month");
        if (monthIdx === -1) throw new Error(`Missing "Month" column`);

        const parsed: MonthRow[] = [];
        for (const row of rows) {
          const mk = (row[monthIdx] || "").trim();
          if (!/^\d{2}\/\d{4}$/.test(mk)) continue;

          const values: Record<SourceKey, number> = {} as any;
          for (const s of SOURCES) {
            const idx = header.findIndex((h) => h.trim() === s);
            values[s] = idx >= 0 ? safeNum(row[idx]) : 0;
          }
          parsed.push({ month: mk, values });
        }

        parsed.sort((a, b) => compareMonthKey(a.month, b.month));

        if (!cancelled) {
          setHistory(parsed);
          setHistoryError(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setHistory([]);
          setHistoryError("capacity.csv not loaded – please ensure /public/data/capacity.csv exists with Month (MM/YYYY) + source columns.");
        }
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize default start/end once history arrives
  useEffect(() => {
    if (!monthOptions.length) return;

    const end = latestMonth || monthOptions[monthOptions.length - 1];
    const start = defaultStartMonth || monthOptions[Math.max(0, monthOptions.length - 13)] || monthOptions[0];

    setEndMonth((prev) => (prev ? clampMonthKeyToOptions(prev, monthOptions) : end));
    setStartMonth((prev) => (prev ? clampMonthKeyToOptions(prev, monthOptions) : start));
  }, [monthOptions, latestMonth, defaultStartMonth]);

  // Enforce Start ≤ End
  useEffect(() => {
    if (!startMonth || !endMonth) return;
    if (compareMonthKey(startMonth, endMonth) > 0) {
      // If start is after end, clamp start to end
      setStartMonth(endMonth);
    }
  }, [startMonth, endMonth]);

  const startRow = useMemo(() => {
    if (!startMonth) return null;
    return history.find((r) => r.month === startMonth) || null;
  }, [history, startMonth]);

  const endRow = useMemo(() => {
    if (!endMonth) return null;
    return history.find((r) => r.month === endMonth) || null;
  }, [history, endMonth]);

  const startTotals = useMemo(() => {
    const vals = startRow?.values;
    if (!vals) return null;
    return {
      per: vals,
      total: sumSources(vals as unknown as Record<string, number>, SOURCES),
    };
  }, [startRow]);

  const endTotals = useMemo(() => {
    const vals = endRow?.values;
    if (!vals) return null;
    return {
      per: vals,
      total: sumSources(vals as unknown as Record<string, number>, SOURCES),
    };
  }, [endRow]);

  const netAdditions = useMemo(() => {
    const out: Record<SourceKey, number> = {} as any;
    for (const s of SOURCES) {
      const a = startTotals?.per?.[s];
      const b = endTotals?.per?.[s];
      if (a == null || b == null) out[s] = 0;
      else out[s] = round2(b - a);
    }
    const total =
      startTotals && endTotals ? round2(endTotals.total - startTotals.total) : 0;

    return { per: out, total };
  }, [startTotals, endTotals]);

  // ----------------------------
  // Render
  // ----------------------------
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 gap-6">
          {/* ===========================
              Rated Capacity (existing)
              =========================== */}
          <Card
            title="Rated Capacity"
            right={<div className="text-xs text-slate-500">GW</div>}
          >
            {capacityCsvMissing && capacityCsvMsg ? (
              <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {capacityCsvMsg}
              </div>
            ) : null}

            {/* Keep this table styling stable (do not change formatting of this card) */}
            <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
              <table className="w-full border-collapse bg-white text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-700">
                      <span className="font-bold text-slate-900">Capacity (GW)</span>
                    </th>
                    {SOURCES.map((s) => (
                      <th
                        key={s}
                        className="px-3 py-2 text-xs font-semibold text-slate-700 text-right"
                      >
                        {s}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-xs font-semibold text-slate-700 text-right">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {/* Installed capacity row */}
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2 font-bold text-slate-900">
                      Capacity as on current date
                    </td>
                    {SOURCES.map((s) => (
                      <td key={s} className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={installed[s]}
                          onChange={(e) => {
                            const v = safeNum(e.target.value);
                            setInstalled((prev) => ({ ...prev, [s]: v }));
                          }}
                          className={numberInputClass()}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {fmt2(installedTotal)}
                    </td>
                  </tr>

                  {/* PLF row */}
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2 font-bold text-slate-900">PLF %</td>
                    {SOURCES.map((s) => (
                      <td key={s} className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          max={100}
                          value={plf[s]}
                          onChange={(e) => {
                            const v = safeNum(e.target.value);
                            setPlf((prev) => ({ ...prev, [s]: v }));
                          }}
                          className={numberInputClass()}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-500">
                      —
                    </td>
                  </tr>

                  {/* Rated capacity row */}
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2 font-bold text-slate-900">Rated Capacity</td>
                    {SOURCES.map((s) => (
                      <td
                        key={s}
                        className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900"
                      >
                        {fmt2(ratedBySource[s])}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {fmt2(ratedTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-xs text-slate-600">
              Rated Capacity (GW) = Installed Capacity × (PLF / 100). Values are editable and saved locally in your browser.
            </div>
          </Card>

          {/* ===========================
              Historical Capacity (NEW)
              =========================== */}
          <Card title="Historical Capacity" right={<div className="text-xs text-slate-500">GW</div>}>
            {/* Controls */}
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-slate-600">Start Month/Year</div>
                <select
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
                >
                  {monthOptions.length ? (
                    monthOptions.map((m) => (
                      <option
                        key={m}
                        value={m}
                        disabled={endMonth ? compareMonthKey(m, endMonth) > 0 : false}
                      >
                        {monthKeyToLabel(m)}
                      </option>
                    ))
                  ) : (
                    <option value="">No data</option>
                  )}
                </select>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-600">End Month/Year</div>
                <select
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
                >
                  {monthOptions.length ? (
                    monthOptions.map((m) => (
                      <option
                        key={m}
                        value={m}
                        disabled={startMonth ? compareMonthKey(m, startMonth) < 0 : false}
                      >
                        {monthKeyToLabel(m)}
                      </option>
                    ))
                  ) : (
                    <option value="">No data</option>
                  )}
                </select>
              </div>
            </div>

            {historyError ? (
              <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {historyError}
              </div>
            ) : null}

            {/* Table — compact so Total column is visible without horizontal scrolling */}
            <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
              <table className="w-full table-fixed border-collapse bg-white text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="w-[170px] px-2 py-2 text-[11px] font-semibold text-slate-700">
                      <span className="font-bold text-slate-900">Capacity (GW)</span>
                    </th>

                    {SOURCES.map((s) => (
                      <th
                        key={s}
                        className="px-2 py-2 text-[11px] font-semibold text-slate-700 text-right whitespace-normal break-words"
                      >
                        {s}
                      </th>
                    ))}

                    <th className="px-2 py-2 text-[11px] font-semibold text-slate-700 text-right">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody className="text-[12px]">
                  <tr className="border-t border-slate-100">
                    <td className="px-2 py-2 font-bold text-slate-900">
                      Capacity as on Start Date ({startMonth || "—"})
                    </td>

                    {SOURCES.map((s) => {
                      const v = startTotals?.per?.[s];
                      const show = startTotals ? fmt2(safeNum(v)) : "—";
                      return (
                        <td key={s} className="px-2 py-2 text-right tabular-nums text-slate-900">
                          {startTotals ? show : "—"}
                        </td>
                      );
                    })}

                    <td className="px-2 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {startTotals ? fmt2(startTotals.total) : "—"}
                    </td>
                  </tr>

                  <tr className="border-t border-slate-100">
                    <td className="px-2 py-2 font-bold text-slate-900">
                      Capacity as on End Date ({endMonth || "—"})
                    </td>

                    {SOURCES.map((s) => {
                      const v = endTotals?.per?.[s];
                      const show = endTotals ? fmt2(safeNum(v)) : "—";
                      return (
                        <td key={s} className="px-2 py-2 text-right tabular-nums text-slate-900">
                          {endTotals ? show : "—"}
                        </td>
                      );
                    })}

                    <td className="px-2 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {endTotals ? fmt2(endTotals.total) : "—"}
                    </td>
                  </tr>

                  <tr className="border-t border-slate-100">
                    <td className="px-2 py-2 font-bold text-slate-900">Net Addition (GW)</td>

                    {SOURCES.map((s) => {
                      const v = netAdditions.per[s];
                      const cls = netColorClass(v);
                      const sign = v > 0 ? "+" : "";
                      return (
                        <td
                          key={s}
                          className={`px-2 py-2 text-right font-semibold tabular-nums ${cls}`}
                        >
                          {startTotals && endTotals ? `${sign}${fmt2(v)}` : "—"}
                        </td>
                      );
                    })}

                    <td
                      className={`px-2 py-2 text-right font-semibold tabular-nums ${
                        startTotals && endTotals ? netColorClass(netAdditions.total) : "text-slate-700"
                      }`}
                    >
                      {startTotals && endTotals
                        ? `${netAdditions.total > 0 ? "+" : ""}${fmt2(netAdditions.total)}`
                        : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-xs text-slate-600">
              Net Addition (GW) = Capacity at End Date − Capacity at Start Date. Data sourced from monthly capacity.csv.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
