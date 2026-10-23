"use client";

import { useEffect, useRef, useState } from "react";
import { Inbox, RefreshCw } from "lucide-react";
import adminApi from "@/api/endpoints/admin.api";
import { PageHeader } from "@/components/layouts/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { selectAccessToken, selectUser } from "@/features/auth/authSlice";
import { getStoredAccessToken } from "@/lib/auth/session";
import { useAppSelector } from "@/store/hooks";
import type { ContactList, ContactSubmission } from "@/types/admin";

type Status = ContactSubmission["status"];
type Filters = { search: string; status: Status | "all"; page: number };
const statuses: { value: Status; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
];

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

function ContactCard({ contact, savingId, disabled, onSave }: {
  contact: ContactSubmission;
  savingId: string | null;
  disabled: boolean;
  onSave: (id: string, status: Status) => Promise<void>;
}) {
  const [status, setStatus] = useState(contact.status);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1 break-words">
            <h2 className="font-semibold">{contact.name}</h2>
            <a href={`mailto:${contact.email}`} className="break-all text-sm text-primary underline underline-offset-4">{contact.email}</a>
            <p className="text-sm text-muted-foreground">{contact.company || "No company provided"}</p>
            <p className="text-xs text-muted-foreground">Received <time dateTime={contact.createdAt}>{dateLabel(contact.createdAt)}</time></p>
            <p className="text-xs text-muted-foreground">Updated <time dateTime={contact.updatedAt}>{dateLabel(contact.updatedAt)}</time></p>
          </div>
          <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
            <div className="w-44 space-y-1">
              <label htmlFor={`status-${contact.id}`} className="text-xs font-medium">Status</label>
              <Select value={status} onValueChange={(value) => setStatus(value as Status)} disabled={disabled}>
                <SelectTrigger id={`status-${contact.id}`} aria-label={`Status for ${contact.name}`}><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={() => void onSave(contact.id, status)} disabled={status === contact.status || disabled} aria-label={`Save status for ${contact.name}`}>
              {savingId === contact.id ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
        <details className="rounded-lg border bg-muted/20 p-3">
          <summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Read message from {contact.name}</summary>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{contact.message}</p>
        </details>
      </CardContent>
    </Card>
  );
}

export default function AdminContacts() {
  const user = useAppSelector(selectUser);
  const token = useAppSelector(selectAccessToken);
  if (!user?.isPlatformAdmin) return <p role="alert">Platform administrator access is required.</p>;
  return <ContactsContent key={`${user.id}:${token}`} />;
}

function ContactsContent() {
  const [filters, setFilters] = useState<Filters>({ search: "", status: "all", page: 1 });
  const [result, setResult] = useState<ContactList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [notice, setNotice] = useState("");
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const saving = useRef(false);
  const mounted = useRef(false);
  const busy = useRef(true);
  const filterVersion = useRef(0);
  const session = useRef(getStoredAccessToken());

  function current() { return mounted.current && session.current === getStoredAccessToken(); }

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ++requestId.current; controller.current?.abort(); };
  }, []);

  function invalidate() {
    ++requestId.current;
    controller.current?.abort();
    busy.current = true;
    setResult(null);
    setLoading(true);
    setError(false);
  }

  function changeFilters(next: Filters) {
    if (!current()) return;
    ++filterVersion.current;
    invalidate();
    setNotice("");
    setSaveError(false);
    setFilters(next);
  }

  function refresh() {
    if (saving.current || busy.current || !current()) return;
    busy.current = true;
    ++requestId.current;
    controller.current?.abort();
    setLoading(true);
    setError(false);
    setRevision((value) => value + 1);
  }

  useEffect(() => {
    const id = ++requestId.current;
    const abort = new AbortController();
    controller.current = abort;
    const valid = () => id === requestId.current && !abort.signal.aborted && current();
    busy.current = true;
    setLoading(true);
    setError(false);
    const timer = setTimeout(() => {
      if (!valid()) return;
      void adminApi.listContacts({
        search: filters.search.trim() || undefined,
        status: filters.status === "all" ? undefined : filters.status,
        page: filters.page,
        pageSize: 20,
      }, abort.signal).then((response) => {
        if (!valid()) return;
        if (filters.page > Math.max(1, response.totalPages)) {
          setResult(null);
          setFilters((current) => ({ ...current, page: Math.max(1, response.totalPages) }));
          return;
        }
        setResult(response);
      }).catch(() => {
        if (valid()) setError(true);
      }).finally(() => {
        if (valid()) { busy.current = false; setLoading(false); }
      });
    }, filters.search.trim() ? 300 : 0);
    return () => {
      clearTimeout(timer);
      ++requestId.current;
      abort.abort();
    };
  }, [filters, revision]);

  async function saveContact(id: string, status: Status) {
    if (saving.current || busy.current || error || !current()) return;
    const contact = result?.items.find((item) => item.id === id);
    if (!contact || contact.status === status) return;
    const version = filterVersion.current;
    saving.current = true;
    setSavingId(id);
    setSaveError(false);
    setNotice("");
    try {
      await adminApi.updateContact(id, { status });
      if (!current()) return;
      invalidate();
      if (version === filterVersion.current) setNotice("Enquiry status saved.");
      setRevision((value) => value + 1);
    } catch {
      if (current() && version === filterVersion.current) setSaveError(true);
    } finally {
      saving.current = false;
      if (current()) setSavingId(null);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader icon={Inbox} title="Enquiries" description="Review contact submissions and track follow-ups across the platform." />
        <Button variant="outline" disabled={loading || savingId !== null} onClick={refresh}><RefreshCw className="mr-2 size-4" aria-hidden />Refresh enquiries</Button>
      </header>
      <Card><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="contact-search" className="text-sm font-medium">Search enquiries</label>
          <Input id="contact-search" value={filters.search} placeholder="Name, email, company or message" onChange={(event) => changeFilters({ ...filters, search: event.target.value, page: 1 })} />
        </div>
        <div className="space-y-1.5 sm:w-48">
          <label htmlFor="contact-filter" className="text-sm font-medium">Filter status</label>
          <Select value={filters.status} onValueChange={(value) => changeFilters({ ...filters, status: value as Filters["status"], page: 1 })}>
            <SelectTrigger id="contact-filter" aria-label="Filter status"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem>{statuses.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CardContent></Card>
      {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
      {saveError ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">Could not save the enquiry status. Select the status and press Save to retry.</p> : null}
      {loading && result && <p role="status" className="text-sm text-muted-foreground">Refreshing enquiries… Showing previously loaded data.</p>}
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm"><p>Enquiries could not be loaded. {result ? "Showing previously loaded data; it may be out of date. Refresh before saving changes." : "No results are available."}</p><Button variant="outline" disabled={loading || savingId !== null} onClick={refresh}>Retry enquiries</Button></div>}
      <div aria-busy={loading} className="space-y-4">
      {loading && !result ? (
        <div role="status" aria-label="Loading enquiries" className="space-y-4"><span className="sr-only">Loading enquiries…</span>{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-48 rounded-xl" />)}</div>
      ) : result ? (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">{result.total.toLocaleString()} {result.total === 1 ? "enquiry" : "enquiries"} matching current filters</p>
          {result.items.length === 0 ? (
            <div className="space-y-3 rounded-xl border bg-card p-8 text-center">
              <h2 className="font-semibold">No enquiries found</h2>
              <p className="text-sm text-muted-foreground">{filters.search || filters.status !== "all" ? "Try another search or clear your filters." : "Contact submissions will appear here when they arrive."}</p>
              {filters.search || filters.status !== "all" ? <Button variant="outline" onClick={() => changeFilters({ search: "", status: "all", page: 1 })}>Clear filters</Button> : null}
            </div>
          ) : <div className="space-y-4">{result.items.map((contact) => <ContactCard key={`${contact.id}-${contact.updatedAt}-${contact.status}`} contact={contact} savingId={savingId} disabled={loading || error || savingId !== null} onSave={saveContact} />)}</div>}
          <nav aria-label="Enquiry pagination" className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Page {result.page} of {Math.max(1, result.totalPages)}</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={loading || result.page <= 1} onClick={() => changeFilters({ ...filters, page: result.page - 1 })}>Previous</Button>
              <Button variant="outline" disabled={loading || result.page >= result.totalPages} onClick={() => changeFilters({ ...filters, page: result.page + 1 })}>Next</Button>
            </div>
          </nav>
        </>
      ) : null}
      </div>
    </div>
  );
}