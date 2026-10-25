"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import adminApi from "@/api/endpoints/admin.api";
import { AdminTableView } from "./AdminMobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { selectAccessToken, selectUser } from "@/features/auth/authSlice";
import { getStoredAccessToken } from "@/lib/auth/session";
import { useAppSelector } from "@/store/hooks";
import type { MarketingAnalytics } from "@/types/admin";

export default function AdminMarketingAnalytics() {
  const user = useAppSelector(selectUser);
  const token = useAppSelector(selectAccessToken);
  if (!user?.isPlatformAdmin) return <p role="alert">Platform administrator access is required.</p>;
  return <MarketingContent key={`${user.id}:${token}`} />;
}

function MarketingContent() {
  const [data, setData] = useState<MarketingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const requestId = useRef(0);
  const busy = useRef(true);
  const session = useRef(getStoredAccessToken());

  useEffect(() => {
    const id = ++requestId.current;
    const controller = new AbortController();
    const valid = () => id === requestId.current && !controller.signal.aborted && session.current === getStoredAccessToken();
    busy.current = true;
    setLoading(true);
    setError(false);
    void adminApi.getMarketingAnalytics(controller.signal).then((result) => {
      if (valid()) setData(result);
    }).catch(() => {
      if (valid()) setError(true);
    }).finally(() => {
      if (valid()) { busy.current = false; setLoading(false); }
    });
    return () => {
      ++requestId.current;
      controller.abort();
    };
  }, [attempt]);

  function refresh() {
    if (busy.current || session.current !== getStoredAccessToken()) return;
    busy.current = true;
    setLoading(true);
    setAttempt((value) => value + 1);
  }

  const cards = data ? [
    ["Page views", data.pageViews30d],
    ["Sign-up clicks", data.signupClicks30d],
    ["Contact clicks", data.contactClicks30d],
    ["Enquiries received", data.contacts30d],
  ] as const : [];

  return (
    <section aria-labelledby="marketing-heading" className="min-w-0 space-y-6 border-t border-border pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="marketing-heading" className="text-xl font-semibold tracking-tight">Marketing analytics</h2>
          <p className="mt-1 text-sm text-muted-foreground">Last 30 days (UTC). Event totals, not unique visitors. Sign-up clicks are not registrations.</p>
          <p className="mt-2 text-xs text-muted-foreground">Landing-page event collection respects Do Not Track (DNT) and Global Privacy Control, so some activity is not recorded.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
        <Button className="min-h-11 sm:min-h-0" variant="outline" disabled={loading} onClick={refresh}><RefreshCw className="mr-2 size-4" aria-hidden />Refresh marketing analytics</Button>
        <Button className="min-h-11 sm:min-h-0" variant="outline" asChild><Link href="/admin/contacts">View enquiries</Link></Button>
        </div>
      </div>
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm"><p>Marketing analytics could not be loaded. {data ? "Showing previously loaded data; it may be out of date." : "No totals are available."}</p><Button variant="outline" disabled={loading} onClick={refresh}>Retry marketing analytics</Button></div>}
      {loading && data && <p role="status" className="text-sm text-muted-foreground">Refreshing marketing analytics… Showing previously loaded data.</p>}
      <div aria-busy={loading} className="space-y-6">
      {loading && !data ? (
        <div role="status" aria-label="Loading marketing analytics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
          <span className="sr-only">Loading marketing analytics…</span>
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(([label, value]) => (
              <Card key={label}>
                <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground"><h3>{label}</h3></CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-semibold tracking-tight tabular-nums">{value.toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">Last 30 days · UTC</p></CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base"><h3>Enquiry status · all time</h3></CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-3">
                {([["New", data.newContacts], ["In progress", data.inProgressContacts], ["Resolved", data.resolvedContacts]] as const).map(([label, value]) => (
                  <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</dd></div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">Status counts include all enquiries, not just the last 30 days.</p>
            </CardContent>
          </Card>
          <Card className="min-w-0">
            <CardHeader><CardTitle className="text-base"><h3>Daily marketing activity</h3></CardTitle></CardHeader>
            <CardContent className="min-w-0">
              {cards.every(([, value]) => value === 0) && data.daily.every((day) => day.pageViews + day.signupClicks + day.contactClicks + day.contacts === 0) ? (
                <p className="pb-4 text-sm text-muted-foreground">No marketing activity recorded in the last 30 days.</p>
              ) : data.daily.length === 0 ? <p className="pb-4 text-sm text-muted-foreground">No daily breakdown returned. Aggregate totals are shown above.</p> : null}
              {data.daily.length > 0 ? (
                <AdminTableView><div className="overflow-x-auto rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:border" role="region" aria-label="Daily marketing totals" tabIndex={0}>
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Daily event and enquiry totals for the last 30 days. Dates are UTC.</caption>
                    <thead className="bg-muted/50"><tr>{["Date (UTC)", "Page views", "Sign-up clicks", "Contact clicks", "Enquiries"].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}</tr></thead>
                    <tbody>{data.daily.map((day) => <tr key={day.date} className="border-t"><th scope="row" className="block px-0 py-3 text-left font-medium md:table-cell md:whitespace-nowrap md:px-4 md:font-normal"><time dateTime={day.date}>{day.date.slice(0, 10)}</time><span aria-hidden="true" className="ml-1 text-xs text-muted-foreground md:hidden">UTC</span></th>{[["Page views", day.pageViews], ["Sign-up clicks", day.signupClicks], ["Contact clicks", day.contactClicks], ["Enquiries", day.contacts]].map(([label, value]) => <td key={label} data-label={label} className="px-4 py-3 tabular-nums">{Number(value).toLocaleString()}</td>)}</tr>)}</tbody>
                  </table>
                </div></AdminTableView>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}
      </div>
    </section>
  );
}