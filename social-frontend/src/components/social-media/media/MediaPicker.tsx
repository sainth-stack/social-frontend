"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import apiClient from "@/api/client";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormInput } from "@/components/ui/form-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MediaAsset, MediaAssetListResponse, MediaAssetType, StockProvider, StockMediaItem, StockSearchResponse } from "@/types/social-media.types";
import { httpsUrl, mediaPreviewUrl, IMAGE_MIME_TYPES, validateMediaFile, VIDEO_MIME_TYPES } from "./media-picker-utils";

const stockApi = socialMediaApi;
const DEFAULT_TYPES: MediaAssetType[] = ["image", "video"];
const PAGE_SIZE = 12;

export type MediaPickerProps = {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: MediaAsset) => Promise<boolean | void> | boolean | void;
  allowedTypes?: MediaAssetType[];
  contextKey?: string;
  initialQuery?: string;
};

function ExternalLink({ url, children }: { url?: string; children: React.ReactNode }) {
  const href = httpsUrl(url);
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="text-primary underline underline-offset-2">{children}</a> : <span>{children}</span>;
}

function StockCredit({ item }: { item: StockMediaItem }) {
  return <div className="space-y-1 break-words text-xs text-muted-foreground">
    <p>{item.attributionText}</p>
    <p><ExternalLink url={item.creatorUrl}>{item.creatorName || "Creator"}</ExternalLink>{" · "}<ExternalLink url={item.providerPageUrl}>Pexels</ExternalLink>{" · "}<ExternalLink url={item.licenseUrl}>License</ExternalLink></p>
  </div>;
}

export default function MediaPicker({ allowedTypes = DEFAULT_TYPES, ...props }: MediaPickerProps) {
  const types = DEFAULT_TYPES.filter(type => allowedTypes.includes(type));
  return props.open ? <PickerSession key={JSON.stringify([props.workspaceId, props.contextKey, types])} {...props} allowedTypes={types} /> : null;
}

function PickerSession({ workspaceId, onOpenChange, onSelect, allowedTypes = DEFAULT_TYPES, initialQuery = "" }: MediaPickerProps) {
  const [tab, setTab] = useState("upload");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState<MediaAsset | null>(null);
  const [stockChosen, setStockChosen] = useState<StockMediaItem | null>(null);
  const [libraryQuery, setLibraryQuery] = useState(initialQuery);
  const [libraryType, setLibraryType] = useState<"all" | MediaAssetType>(allowedTypes.length === 1 ? allowedTypes[0] : "all");
  const [libraryPage, setLibraryPage] = useState(1);
  const [library, setLibrary] = useState<MediaAssetListResponse | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [libraryRetry, setLibraryRetry] = useState(0);
  const [providers, setProviders] = useState<StockProvider[] | null>(null);
  const [providerError, setProviderError] = useState("");
  const [providerRetry, setProviderRetry] = useState(0);
  const [stockQuery, setStockQuery] = useState(initialQuery);
  const [stockType, setStockType] = useState<MediaAssetType>(allowedTypes[0] ?? "image");
  const [stockRequest, setStockRequest] = useState<{ query: string; mediaType: MediaAssetType; page: number } | null>(null);
  const [stock, setStock] = useState<StockSearchResponse | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState("");
  const [stockRetry, setStockRetry] = useState(0);
  const alive = useRef(true);
  const locked = useRef(false);
  const intent = useRef(0);
  const reads = useRef(new Set<AbortController>());
  const onSelectRef = useRef(onSelect);
  const onOpenChangeRef = useRef(onOpenChange);
  const inputId = useId();
  const provider = providers?.find(item => item.id === "pexels" && item.available && item.mediaTypes.includes(stockType));

  useLayoutEffect(() => {
    onSelectRef.current = onSelect;
    onOpenChangeRef.current = onOpenChange;
  }, [onSelect, onOpenChange]);

  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      intent.current += 1;
      reads.current.forEach(controller => controller.abort());
    };
  }, []);

  function close() {
    alive.current = false;
    intent.current += 1;
    reads.current.forEach(controller => controller.abort());
    onOpenChangeRef.current(false);
  }

  function changeIntent() {
    intent.current += 1;
    setChosen(null);
    setStockChosen(null);
    setError("");
    setStatus("");
  }

  async function operate(message: string, load: (current: () => boolean) => Promise<MediaAsset | null>) {
    if (locked.current || !alive.current || !workspaceId || !allowedTypes.length) return;
    locked.current = true;
    const version = intent.current;
    const current = () => alive.current && intent.current === version;
    setBusy(true);
    setError("");
    setStatus(message);
    try {
      const asset = await load(current);
      if (!current() || !asset) return;
      if (!allowedTypes.includes(asset.mediaType)) throw new Error("This media type is not allowed here.");
      if (!mediaPreviewUrl(asset.url)) throw new Error("This asset does not have a secure HTTPS media URL.");
      setStatus("Attaching media…");
      const success = await onSelectRef.current(asset);
      if (current()) {
        if (success !== false) close();
        else setStatus("Media was not attached. You can try again.");
      }
    } catch (reason) {
      if (current()) {
        setStatus("");
        setError(reason instanceof Error && !('response' in reason) ? reason.message : "Unable to use this media. Please try again.");
      }
    } finally {
      locked.current = false;
      if (alive.current) {
        setBusy(false);
        if (!current()) setStatus("");
      }
    }
  }

  function upload(files: File[]) {
    if (locked.current) return;
    if (files.length !== 1) {
      setError("Choose one file at a time.");
      return;
    }
    const file = files[0];
    const validation = validateMediaFile(file, allowedTypes);
    if (validation !== "image" && validation !== "video") {
      setError(validation);
      return;
    }
    void operate("Uploading media…", async current => {
      const result = validation === "image" ? await socialMediaApi.uploadImage(workspaceId, file) : await socialMediaApi.uploadVideo(workspaceId, file);
      if (!current()) return null;
      if (!result.assetId) throw new Error("The upload did not return a saved media asset. Please try again.");
      setStatus("Loading saved media…");
      return socialMediaApi.getMediaAsset(workspaceId, result.assetId);
    });
  }

  useEffect(() => {
    if (tab !== "library" || !workspaceId || !allowedTypes.length) return;
    const controller = new AbortController();
    reads.current.add(controller);
    setLibraryLoading(true);
    setLibraryError("");
    setLibrary(null);
    const timer = setTimeout(() => {
      void apiClient.get<MediaAssetListResponse>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/social/media-assets`, {
        params: { search: libraryQuery.trim() || undefined, mediaType: libraryType === "all" ? undefined : libraryType, page: libraryPage, pageSize: PAGE_SIZE },
        signal: controller.signal,
      }).then(({ data }) => {
        if (!controller.signal.aborted && alive.current) setLibrary(data);
      }).catch(() => {
        if (!controller.signal.aborted && alive.current) setLibraryError("Unable to load your media. Please try again.");
      }).finally(() => {
        if (!controller.signal.aborted && alive.current) setLibraryLoading(false);
      });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); reads.current.delete(controller); };
  }, [tab, workspaceId, libraryQuery, libraryType, libraryPage, libraryRetry, allowedTypes.length]);

  useEffect(() => {
    if (tab !== "stock" || !workspaceId || !allowedTypes.length) return;
    const controller = new AbortController();
    reads.current.add(controller);
    setProviders(null);
    setProviderError("");
    void stockApi.getStockProviders(workspaceId, controller.signal).then(result => {
      if (!controller.signal.aborted && alive.current) setProviders(result.items);
    }).catch(() => {
      if (!controller.signal.aborted && alive.current) setProviderError("Unable to check stock availability. Please try again.");
    });
    return () => { controller.abort(); reads.current.delete(controller); };
  }, [tab, workspaceId, providerRetry, allowedTypes.length]);

  useEffect(() => {
    if (tab !== "stock" || !stockRequest || !provider) return;
    const controller = new AbortController();
    reads.current.add(controller);
    setStockLoading(true);
    setStockError("");
    setStock(null);
    void stockApi.searchStock(workspaceId, { ...stockRequest, pageSize: PAGE_SIZE }, controller.signal).then(result => {
      if (!controller.signal.aborted && alive.current) setStock(result);
    }).catch(() => {
      if (!controller.signal.aborted && alive.current) setStockError("Unable to search stock media. Please try again.");
    }).finally(() => {
      if (!controller.signal.aborted && alive.current) setStockLoading(false);
    });
    return () => { controller.abort(); reads.current.delete(controller); };
  }, [tab, workspaceId, stockRequest, provider, stockRetry]);

  const disabled = busy || !workspaceId || !allowedTypes.length;
  const libraryItems = library?.items.filter(asset => allowedTypes.includes(asset.mediaType)) ?? [];

  return <Dialog open onOpenChange={value => { if (!value) close(); }}><DialogContent className="max-w-3xl min-w-0">
    <DialogHeader>
      <DialogTitle>Choose media</DialogTitle>
      <DialogDescription>Upload a file, choose saved media, or import licensed stock.</DialogDescription>
    </DialogHeader>
    {!workspaceId && <p role="alert" className="text-sm text-destructive">Choose a workspace to use media.</p>}
    {!allowedTypes.length && <p role="status">No media types are allowed here.</p>}
    {allowedTypes.includes("video") && <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Videos are draft-only. Attaching a video does not publish or schedule it.</p>}
    <Tabs value={tab} onValueChange={value => { changeIntent(); setTab(value); }} className="min-w-0 space-y-4">
      <TabsList aria-label="Media source" className="grid h-auto grid-cols-3">
        <TabsTrigger value="upload" className="min-h-11 whitespace-normal px-2">Upload or paste</TabsTrigger>
        <TabsTrigger value="library" className="min-h-11 whitespace-normal px-2">Your media</TabsTrigger>
        <TabsTrigger value="stock" className="min-h-11 px-2">Stock</TabsTrigger>
      </TabsList>
      <TabsContent value="upload" className="space-y-3">
        <div role="region" aria-label="Upload dropzone" tabIndex={0} aria-disabled={disabled} className="space-y-4 rounded-lg border border-dashed border-input bg-muted/30 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onPaste={event => {
            const files = Array.from(event.clipboardData.files).filter(file => file.type.startsWith("image/"));
            if (files.length) { event.preventDefault(); upload(files); }
          }}
          onDragOver={event => event.preventDefault()}
          onDrop={event => { event.preventDefault(); upload(Array.from(event.dataTransfer.files)); }}>
          <p className="text-sm font-medium">Drop a file here, paste an image, or choose a file.</p>
          <p className="text-xs text-muted-foreground">{allowedTypes.includes("image") && "JPEG, PNG, WebP up to 8 MiB. "}{allowedTypes.includes("video") && "MP4, WebM up to 50 MiB. "}Text and URLs are not uploaded from the clipboard.</p>
          <label htmlFor={inputId} className="block text-sm font-medium">Choose a media file</label>
          <input id={inputId} type="file" disabled={disabled} accept={[...(allowedTypes.includes("image") ? IMAGE_MIME_TYPES : []), ...(allowedTypes.includes("video") ? VIDEO_MIME_TYPES : [])].join(",")} className="block w-full min-w-0 text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-2 file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; if (files.length) upload(files); }} />
        </div>
      </TabsContent>
      <TabsContent value="library" className="space-y-4" aria-busy={libraryLoading}>
        <FormInput label="Search your media" value={libraryQuery} disabled={disabled} maxLength={200} onChange={event => { changeIntent(); setLibraryQuery(event.target.value); setLibraryPage(1); }} />
        <div role="group" aria-label="Library media type" className="flex flex-wrap gap-2">
          {([...(allowedTypes.length > 1 ? ["all" as const] : []), ...allowedTypes]).map(type => <Button key={type} type="button" disabled={disabled} variant={libraryType === type ? "secondary" : "outline"} aria-pressed={libraryType === type} onClick={() => { changeIntent(); setLibraryType(type); setLibraryPage(1); }}>{type === "all" ? "All media" : type === "image" ? "Images" : "Videos"}</Button>)}
        </div>
        {libraryLoading && <p role="status">Loading your media…</p>}
        {libraryError && <div role="alert"><p>{libraryError}</p><Button variant="outline" disabled={disabled} onClick={() => setLibraryRetry(value => value + 1)}>Retry media</Button></div>}
        {library && !libraryItems.length && <p className="text-sm text-muted-foreground">No saved media matches. Try another search or upload a file.</p>}
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">
          {libraryItems.map((asset, index) => <Button key={asset.id} variant="outline" disabled={disabled} aria-pressed={chosen?.id === asset.id} aria-label={`Choose ${asset.mediaType} ${index + 1}`} className="h-auto min-w-0 flex-col overflow-hidden p-2" onClick={() => { changeIntent(); setChosen(asset); }}>
            {asset.mediaType === "image" && mediaPreviewUrl(asset.url) ? <img src={mediaPreviewUrl(asset.url)} alt="Saved media thumbnail" loading="lazy" referrerPolicy="no-referrer" className="aspect-video w-full rounded-md object-cover" /> : <span className="flex aspect-video w-full items-center justify-center rounded-md bg-muted text-muted-foreground">Video</span>}
            <span className="text-xs">{asset.mediaType === "image" ? "Image" : "Video"} {index + 1}</span>
          </Button>)}
        </div>
        {library && <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" disabled={disabled || libraryLoading || libraryPage <= 1} onClick={() => { changeIntent(); setLibraryPage(value => value - 1); }}>Previous media</Button>
          <span className="text-xs text-muted-foreground">Page {libraryPage} of {Math.max(1, library.totalPages)}</span>
          <Button variant="outline" disabled={disabled || libraryLoading || libraryPage >= library.totalPages} onClick={() => { changeIntent(); setLibraryPage(value => value + 1); }}>Next media</Button>
        </div>}
        {chosen && <div className="space-y-3 rounded-lg border p-3">
          {chosen.mediaType === "video" && mediaPreviewUrl(chosen.url) && <video src={mediaPreviewUrl(chosen.url)} controls playsInline preload="none" aria-label="Selected video preview" className="max-h-64 w-full rounded-lg" />}
          <Button disabled={disabled} onClick={() => void operate("Selecting media…", async () => chosen)}>Use selected media</Button>
        </div>}
      </TabsContent>
      <TabsContent value="stock" className="space-y-4" aria-busy={stockLoading}>
        {!providers && !providerError && <p role="status">Checking stock availability…</p>}
        {providerError && <div role="alert"><p>{providerError}</p><Button variant="outline" disabled={disabled} onClick={() => setProviderRetry(value => value + 1)}>Retry availability</Button></div>}
        {providers && !providers.some(item => item.id === "pexels" && item.available && item.mediaTypes.some(type => allowedTypes.includes(type))) && <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">Stock media is not configured for this workspace. You can upload a file or choose from your media instead.</p>}
        <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (!stockQuery.trim() || disabled || !provider) return; changeIntent(); setStockRequest({ query: stockQuery.trim(), mediaType: stockType, page: 1 }); }}>
          <FormInput label="Search stock" value={stockQuery} disabled={disabled || !provider} maxLength={200} onChange={event => setStockQuery(event.target.value)} />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Stock media type">
            {allowedTypes.map(type => <Button key={type} type="button" disabled={disabled || !providers?.some(item => item.id === "pexels" && item.available && item.mediaTypes.includes(type))} variant={stockType === type ? "secondary" : "outline"} aria-pressed={stockType === type} onClick={() => { changeIntent(); setStockType(type); setStockRequest(null); setStock(null); setStockError(""); }}>{type === "image" ? "Photos" : "Videos"}</Button>)}
            <Button type="submit" disabled={disabled || !provider || !stockQuery.trim()}>Search stock media</Button>
          </div>
        </form>
        {stockLoading && <p role="status">Searching stock media…</p>}
        {stockError && <div role="alert"><p>{stockError}</p><Button variant="outline" disabled={disabled} onClick={() => setStockRetry(value => value + 1)}>Retry stock search</Button></div>}
        {stock && !stock.items.length && <p className="text-sm text-muted-foreground">No stock media matches. Try another search.</p>}
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">
          {stock?.items.filter(item => allowedTypes.includes(item.mediaType) && item.mediaType === stockType).map((item, index) => <div key={`${item.mediaType}-${item.id}`} className="min-w-0 space-y-2 rounded-lg border p-2">
            <Button variant="ghost" disabled={disabled} aria-pressed={stockChosen?.id === item.id && stockChosen.mediaType === item.mediaType} aria-label={`Preview stock ${item.mediaType} ${index + 1}`} className="h-auto w-full min-w-0 flex-col p-0" onClick={() => { changeIntent(); setStockChosen(item); }}>
              {mediaPreviewUrl(item.thumbnailUrl) ? <img src={mediaPreviewUrl(item.thumbnailUrl)} alt="Stock media thumbnail" loading="lazy" referrerPolicy="no-referrer" className="aspect-video w-full rounded-md object-cover" /> : <span className="flex aspect-video w-full items-center justify-center bg-muted">Preview unavailable</span>}
              <span className="text-xs">{item.mediaType === "video" ? "Video" : "Photo"} {index + 1}</span>
            </Button>
            <StockCredit item={item} />
          </div>)}
        </div>
        {stock && stockRequest && <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" disabled={disabled || stockLoading || stockRequest.page <= 1} onClick={() => { changeIntent(); setStockRequest({ ...stockRequest, page: stockRequest.page - 1 }); }}>Previous stock</Button>
          <span className="text-xs text-muted-foreground">Page {stockRequest.page}</span>
          <Button variant="outline" disabled={disabled || stockLoading || !stock.hasMore} onClick={() => { changeIntent(); setStockRequest({ ...stockRequest, page: stockRequest.page + 1 }); }}>Next stock</Button>
        </div>}
        {stockChosen && <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          {stockChosen.mediaType === "video" && mediaPreviewUrl(stockChosen.previewUrl) && <video src={mediaPreviewUrl(stockChosen.previewUrl)} poster={mediaPreviewUrl(stockChosen.thumbnailUrl)} controls playsInline preload="none" aria-label="Selected stock video preview" className="max-h-64 w-full rounded-lg" />}
          {stockChosen.mediaType === "image" && mediaPreviewUrl(stockChosen.previewUrl) && <img src={mediaPreviewUrl(stockChosen.previewUrl)} alt="Selected stock media preview" referrerPolicy="no-referrer" className="max-h-64 w-full rounded-lg object-contain" />}
          <StockCredit item={stockChosen} />
          <Button disabled={disabled || !provider} onClick={() => void operate("Importing stock media…", () => stockApi.importStock(workspaceId, { provider: "pexels", id: stockChosen.id, mediaType: stockChosen.mediaType }))}>Import and use media</Button>
        </div>}
      </TabsContent>
    </Tabs>
    <div aria-live="polite" aria-atomic="true" role="status" className="text-sm text-muted-foreground">{status}</div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex justify-end"><Button type="button" variant="outline" onClick={close}>Cancel</Button></div>
  </DialogContent></Dialog>;
}