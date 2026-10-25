"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LineChart } from "lucide-react";
import adminApi from "@/api/endpoints/admin.api";
import { PageHeader } from "@/components/layouts/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { selectAccessToken, selectUser } from "@/features/auth/authSlice";
import { getStoredAccessToken } from "@/lib/auth/session";
import { useAppSelector } from "@/store/hooks";
import type { AdminAIUsageFilters, AdminAIUsageItem, AdminAIUsageMetrics, AdminAIUsagePricing, AdminAIUsageReport } from "@/types/admin";

type Filters = Required<Pick<AdminAIUsageFilters, "groupBy" | "kind" | "sort" | "order" | "page" | "pageSize">> & {
  period: string; startDate: string; endDate: string; search: string; userId: string; workspaceId: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(value);

export function validateAIUsageFilters(filters: Pick<Filters, "period" | "startDate" | "endDate" | "userId" | "workspaceId">) {
  if ((filters.userId && !uuid.test(filters.userId)) || (filters.workspaceId && !uuid.test(filters.workspaceId))) return "User and workspace IDs must be valid UUIDs.";
  if (filters.period !== "custom") return null;
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date.getTime() : NaN;
  };
  const days = (parse(filters.endDate) - parse(filters.startDate)) / 86400000 + 1;
  return Number.isFinite(days) && days >= 1 && days <= 366 ? null : "Choose valid start and end dates spanning 1–366 inclusive UTC days.";
}

function Choice({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void }) {
  return <div className="min-w-0 space-y-1.5"><Label htmlFor={id}>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger id={id}><SelectValue /></SelectTrigger><SelectContent>{options.map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select></div>;
}

function Cost({ metrics }: { metrics: AdminAIUsageMetrics }) {
  return <div className="space-y-1 text-sm"><p>Known subtotal: <span className="font-semibold tabular-nums">{usd(metrics.estimatedKnownCostUsd)}</span></p><p>{metrics.totalCostUsd === null ? "Total: Unknown · partial estimate" : `Total estimate: ${usd(metrics.totalCostUsd)}`}</p><p className="text-xs text-muted-foreground">{metrics.unpricedCalls.toLocaleString()} unpriced calls · {metrics.historicalUnknown ? "Legacy coverage unknown" : "No legacy usage identified"}</p></div>;
}

function MetricsTable({ rows, label, identities = false }: { rows: (AdminAIUsageItem | (AdminAIUsageMetrics & { date: string }))[]; label: string; identities?: boolean }) {
  return <div role="region" aria-label={label} tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Table><TableHeader><TableRow><TableHead>{identities ? "Identity" : "UTC date / model"}</TableHead><TableHead>Text generations</TableHead><TableHead>Image generations</TableHead><TableHead>Provider calls</TableHead><TableHead>Estimated USD</TableHead><TableHead>Coverage & observed tokens</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={"id" in row ? row.id : row.date}>
    <TableCell><div className="w-52 space-y-1 break-words"><p className="font-medium">{"name" in row ? row.name : row.date}</p>{"id" in row && <><p className="break-all text-xs text-muted-foreground">{row.email}{row.email && <br />}{row.id === "__unattributed__" ? "No retained identity" : row.id}</p>{identities && (row.userId || row.workspaceId) && <Link className="text-sm text-primary underline" href={`/admin/ai-usage?${row.userId ? `userId=${encodeURIComponent(row.userId)}` : `workspaceId=${encodeURIComponent(row.workspaceId!)}`}`}>Scope AI usage</Link>}</>}</div></TableCell>
    <TableCell className="tabular-nums">{row.textGenerations.toLocaleString()}</TableCell><TableCell className="tabular-nums">{row.imageGenerations.toLocaleString()}</TableCell><TableCell><p>{row.providerCalls.toLocaleString()}</p><p className="whitespace-nowrap text-xs text-muted-foreground">{row.textProviderCalls} text · {row.imageProviderCalls} image</p></TableCell><TableCell><div className="w-56"><Cost metrics={row} /></div></TableCell>
    <TableCell><details className="w-60 text-xs"><summary className="cursor-pointer font-medium">Usage details</summary><dl className="mt-2 space-y-1">{[["Priced calls", row.pricedCalls], ["Unpriced / missing-rate calls", row.unpricedCalls], ["Failed calls", row.failedCalls], ["Filtered calls", row.filteredCalls], ["Calls without actor", row.unattributedCalls], ["Legacy text units", row.legacyTextGenerations], ["Legacy image units", row.legacyImageGenerations], ["Provider quantity (not calls)", row.providerQuantity], ["Input tokens", row.inputTokens], ["Output tokens", row.outputTokens], ["Cache read tokens", row.cacheReadTokens], ["Cache write tokens", row.cacheWriteTokens]].map(([name, value]) => <div key={name} className="flex justify-between gap-3"><dt>{name}</dt><dd>{Number(value).toLocaleString()}</dd></div>)}</dl><p className="mt-2 text-muted-foreground">Observed token fields only; missing usage is unknown, not zero. Unpriced calls can include missing rates, failed or filtered requests.</p></details></TableCell>
  </TableRow>)}</TableBody></Table></div>;
}

function Breakdown({ report }: { report: AdminAIUsageReport }) {
  const [dailyPage, setDailyPage] = useState(0);
  const [modelPage, setModelPage] = useState(0);
  const sections = [{ title: "Daily", data: report.daily, index: dailyPage, change: setDailyPage }, { title: "Model", data: report.models, index: modelPage, change: setModelPage }];
  return <details className="min-w-0 rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Daily & model breakdown</summary><div className="mt-4 min-w-0 space-y-5">{sections.map(({ title, data, index, change }) => {
    return <section key={String(title)} className="min-w-0 space-y-3"><h2 className="font-medium">{String(title)} breakdown</h2>{data.length ? <><MetricsTable rows={data.slice(index * 20, (index + 1) * 20)} label={`${title} breakdown table`} /><nav aria-label={`${title} breakdown pagination`} className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={index === 0} onClick={() => change(index - 1)}>Previous {String(title).toLowerCase()}</Button><span className="text-sm">Page {index + 1} of {Math.max(1, Math.ceil(data.length / 20))}</span><Button variant="outline" disabled={(index + 1) * 20 >= data.length} onClick={() => change(index + 1)}>Next {String(title).toLowerCase()}</Button></nav></> : <p className="text-sm text-muted-foreground">No {String(title).toLowerCase()} activity in this scope.</p>}</section>;
  })}<p className="text-sm text-muted-foreground">Quota generations have no historical model correlation and appear under Unattributed. Breakdowns reflect all current filters, not just this result page.</p></div></details>;
}

const rates: [keyof AdminAIUsagePricing, string][] = [["inputPerMillionUsd", "Input / 1M tokens"], ["outputPerMillionUsd", "Output / 1M tokens"], ["cacheReadPerMillionUsd", "Cache read / 1M"], ["cacheWritePerMillionUsd", "Cache write / 1M"], ["imagePerUnitUsd", "Image / unit"]];

export default function AdminAIUsage() {
  const user = useAppSelector(selectUser);
  const token = useAppSelector(selectAccessToken);
  const query = useSearchParams();
  const userId = query.get("userId") ?? "";
  const workspaceId = query.get("workspaceId") ?? "";
  if (!user?.isPlatformAdmin) return <p role="alert">Platform administrator access is required.</p>;
  return <ReportContent key={`${user.id}:${token}:${userId}:${workspaceId}`} userId={userId} workspaceId={workspaceId} />;
}

function ReportContent({ userId, workspaceId }: { userId: string; workspaceId: string }) {
  const [filters, setFilters] = useState<Filters>({ period: "30", startDate: "", endDate: "", groupBy: workspaceId && !userId ? "workspace" : "user", kind: "all", search: "", userId, workspaceId, sort: "cost", order: "desc", page: 1, pageSize: 20 });
  const [report, setReport] = useState<AdminAIUsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const session = useRef(getStoredAccessToken());
  const validation = validateAIUsageFilters(filters);

  function invalidate() { ++request.current; controller.current?.abort(); setReport(null); setError(false); setLoading(true); }
  function update(patch: Partial<Filters>) { invalidate(); setFilters((value) => ({ ...value, ...patch, page: patch.page ?? 1 })); }

  useEffect(() => {
    const id = ++request.current;
    const abort = new AbortController();
    controller.current = abort;
    const valid = () => id === request.current && !abort.signal.aborted && session.current === getStoredAccessToken();
    if (validation) { setLoading(false); return () => { ++request.current; abort.abort(); }; }
    const timer = setTimeout(() => {
      if (!valid()) return;
      const params: AdminAIUsageFilters = {
        ...(filters.period === "custom" ? { startDate: filters.startDate, endDate: filters.endDate } : { days: Number(filters.period) as 7 | 30 | 90 }),
        groupBy: filters.groupBy, kind: filters.kind, search: filters.search.trim() || undefined,
        userId: filters.userId || undefined, workspaceId: filters.workspaceId || undefined,
        sort: filters.sort, order: filters.order, page: filters.page, pageSize: filters.pageSize,
      };
      void adminApi.getAIUsage(params, abort.signal).then((data) => {
        if (!valid()) return;
        if (filters.page > data.totalPages) { update({ page: Math.max(1, data.totalPages) }); return; }
        setReport(data);
      }).catch(() => { if (valid()) setError(true); }).finally(() => { if (valid()) setLoading(false); });
    }, filters.search.trim() ? 300 : 0);
    return () => { clearTimeout(timer); ++request.current; abort.abort(); };
  }, [filters, revision, validation]);

  return <div className="min-w-0 max-w-full space-y-6">
    <PageHeader icon={LineChart} title="AI Usage & Costs" description="Successful generation units, retained provider calls and configured USD cost estimates — not provider invoices." />
    <Card><CardContent className="space-y-4 p-4"><div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Choice id="usage-period" label="UTC period" value={filters.period} options={[["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["custom", "Explicit UTC dates"]]} onChange={(period) => update({ period })} />
      <Choice id="usage-group" label="Group by" value={filters.groupBy} options={[["user", "User"], ["workspace", "Workspace"], ["model", "Model"]]} onChange={(groupBy) => update({ groupBy: groupBy as Filters["groupBy"] })} />
      <Choice id="usage-kind" label="Generation kind" value={filters.kind} options={[["all", "Text & image"], ["text", "Text"], ["image", "Image"]]} onChange={(kind) => update({ kind: kind as Filters["kind"] })} />
      <Choice id="usage-sort" label="Sort by" value={filters.sort} options={[["cost", "Known cost subtotal"], ["count", "Provider calls"]]} onChange={(sort) => update({ sort: sort as Filters["sort"] })} />
      <div className="space-y-1.5"><Label htmlFor="usage-search">Search grouped identities</Label><Input id="usage-search" maxLength={200} value={filters.search} placeholder="Name, email or grouped ID" onChange={(event) => update({ search: event.target.value })} /></div>
      <Choice id="usage-order" label="Sort order" value={filters.order} options={[["desc", "Highest first"], ["asc", "Lowest first"]]} onChange={(order) => update({ order: order as Filters["order"] })} />
      <Choice id="usage-size" label="Rows per page" value={String(filters.pageSize)} options={[["20", "20"], ["50", "50"], ["100", "100"]]} onChange={(pageSize) => update({ pageSize: Number(pageSize) })} />
    </div>
    {filters.period === "custom" && <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="usage-start">Start date (UTC)</Label><Input id="usage-start" type="date" value={filters.startDate} onChange={(event) => update({ startDate: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="usage-end">End date (UTC)</Label><Input id="usage-end" type="date" value={filters.endDate} onChange={(event) => update({ endDate: event.target.value })} /></div><p className="text-xs text-muted-foreground sm:col-span-2">Inclusive UTC calendar days, maximum 366. Both dates are required.</p></div>}
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="usage-user">User ID scope</Label><Input id="usage-user" value={filters.userId} placeholder="All users" onChange={(event) => update({ userId: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="usage-workspace">Workspace ID scope</Label><Input id="usage-workspace" value={filters.workspaceId} placeholder="All workspaces" onChange={(event) => update({ workspaceId: event.target.value })} /></div></div>
    <p className="text-sm text-muted-foreground">Search is applied on the server before pagination. Summary, daily and model totals reflect the full filtered scope. Generations are successful quota units, not provider calls; they are never assumed to match one-to-one.</p>
    </CardContent></Card>
    {validation ? <p role="alert" className="text-sm text-destructive">{validation}</p> : loading ? <div role="status" aria-label="Loading AI usage" className="space-y-4"><span className="sr-only">Loading AI usage…</span><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-36" />)}</div><Skeleton className="h-64" /></div> : error ? <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4"><p>AI usage could not be loaded. No cost or generation totals are available.</p><Button variant="outline" onClick={() => { invalidate(); setRevision((value) => value + 1); }}>Retry AI usage</Button></div> : report && <>
      <p aria-live="polite" className="text-sm text-muted-foreground">{report.startDate} through {report.endDate} · inclusive UTC · {report.total.toLocaleString()} groups matching current filters</p>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Text generations", report.summary.textGenerations, "Successful text quota units"], ["Image generations", report.summary.imageGenerations, "Successful image quota units"], ["Provider calls", report.summary.providerCalls, `${report.summary.textProviderCalls} text · ${report.summary.imageProviderCalls} image actual invocations`]].map(([title, value, detail]) => <Card key={title}><CardContent className="p-5"><h2 className="text-sm font-medium text-muted-foreground">{title}</h2><p className="mt-3 text-3xl font-semibold tabular-nums">{Number(value).toLocaleString()}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></CardContent></Card>)}<Card><CardContent className="space-y-3 p-5"><h2 className="text-sm font-medium text-muted-foreground">Configured USD estimate</h2><Cost metrics={report.summary} /></CardContent></Card></div>
      <section className="space-y-2 rounded-xl border bg-muted/30 p-4 text-sm"><h2 className="font-semibold">Coverage & cost clarity</h2><p>{report.summary.unpricedCalls} unpriced calls (including missing rates or unavailable request cost). {report.summary.pricedCalls} priced calls. {report.summary.failedCalls} failed calls. {report.summary.filteredCalls} filtered calls. {report.summary.unattributedCalls} calls without an actor.</p><p>Legacy heuristic: {report.summary.legacyTextGenerations} text and {report.summary.legacyImageGenerations} image units precede the earliest retained global ledger event. {report.summary.historicalUnknown ? "Historical costs unknown; total estimate is partial." : "No legacy usage identified; this does not prove complete ledger coverage."} Later quota records cannot be correlated to requests. Missing actors remain Unattributed, not workspace owners.</p><p>Known subtotal includes only priced calls. An unknown total is never a zero cost. Token totals include observed fields only.</p></section>
      {report.items.length ? <MetricsTable rows={report.items} label="AI usage groups" identities /> : <div className="space-y-3 rounded-xl border p-8 text-center"><h2 className="font-semibold">No AI usage found</h2><p className="text-sm text-muted-foreground">No retained activity matches this date range and scope. Adjust the filters to explore another scope.</p></div>}
      <nav aria-label="AI usage pagination" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Page {report.page} of {report.totalPages}</p><div className="flex gap-2"><Button variant="outline" disabled={report.page <= 1} onClick={() => update({ page: report.page - 1 })}>Previous</Button><Button variant="outline" disabled={report.page >= report.totalPages} onClick={() => update({ page: report.page + 1 })}>Next</Button></div></nav>
      <Breakdown key={`${request.current}`} report={report} />
      <details className="min-w-0 rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Read-only pricing configuration</summary><p className="my-3 text-sm text-muted-foreground">Current environment-configured USD rates. Configure rates through deployment configuration, not this screen. Historical snapshots are not repriced. Missing rates are not zero.</p>{report.pricing.length ? <div role="region" aria-label="Configured pricing" tabIndex={0} className="max-h-96 max-w-full overflow-auto"><Table><TableHeader><TableRow><TableHead>Model / alias / region</TableHead>{rates.map(([key, title]) => <TableHead key={key}>{title} (USD)</TableHead>)}</TableRow></TableHeader><TableBody>{report.pricing.map((price, index) => <TableRow key={index}><TableCell><div className="w-56 break-all">{price.modelId || "Unspecified model"}{price.aliasOf && <p className="text-xs text-muted-foreground">Alias of {price.aliasOf}</p>}{price.region && <p className="text-xs text-muted-foreground">{price.region}</p>}</div></TableCell>{rates.map(([key]) => <TableCell key={key} className="whitespace-nowrap">{typeof price[key] === "number" ? usd(price[key] as number) : "Not configured"}</TableCell>)}</TableRow>)}</TableBody></Table></div> : <p className="text-sm text-muted-foreground">No current pricing rates configured. Historical priced snapshots may still contribute to the known subtotal.</p>}</details>
      <details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Reporting limitations</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">{report.limitations.map((text) => <li key={text}>{text}</li>)}</ul></details>
    </>}
  </div>;
}