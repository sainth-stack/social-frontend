"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { ArrowDown, Check, ImageIcon } from "lucide-react";
import { platforms } from "@/content/site";
import { PlatformIcon } from "./Brand";

const samples = [
  {
    name: "Product launch",
    brief: "Introduce our new collection of home essentials to design-conscious homeowners. Use clear, practical language.",
    caption: "Introducing the everyday collection. Home essentials with natural textures and practical details, designed to work together in your space. Explore the collection from Form & Field.",
    tags: "#FormAndField #EverydayLiving",
    title: "Designed for everyday living.",
    note: "THE EVERYDAY COLLECTION",
  },
  {
    name: "Practical tip",
    brief: "Share a practical styling tip for a small living room. Focus on one change readers can make today.",
    caption: "Give each corner a purpose. Pair a reading chair with a compact side table and a task light to create a useful space without adding bulky furniture.",
    tags: "#SmallSpaceDesign #InteriorStyling",
    title: "Make each corner work.",
    note: "SMALL-SPACE STYLING",
  },
  {
    name: "Brand story",
    brief: "Explain Form & Field’s approach to useful, considered design. Keep the story concise and specific.",
    caption: "At Form & Field, we start with how a room is used. We choose simple forms, natural textures and practical details to create pieces that fit everyday routines.",
    tags: "#FormAndField #ConsideredDesign",
    title: "Useful by design.",
    note: "OUR DESIGN APPROACH",
  },
] as const;

export function StudioDemo() {
  const [selected, setSelected] = useState(0);
  const previewId = useId();
  const sample = samples[selected] ?? samples[0];
  const platform = platforms.find((item) => item.id === "instagram")!;

  return (
    <div className="preview-window overflow-hidden bg-background">
      <div className="window-heading flex items-center justify-between gap-2 border-b px-4 py-4 sm:px-5">
        <p className="text-sm font-semibold">Content Studio</p>
        <span className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted-foreground">Try a sample</span>
      </div>
      <div className="p-4 sm:p-5">
        <div role="group" aria-label="Choose a sample brief" className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1">
          {samples.map((item, index) => (
            <button key={item.name} type="button" aria-pressed={selected === index} aria-controls={previewId} onClick={() => setSelected(index)} className={`min-h-11 rounded-lg px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-sm ${selected === index ? "bg-background text-foreground shadow-card" : "text-muted-foreground hover:bg-background/70 hover:text-foreground"}`}>
              {item.name}
            </button>
          ))}
        </div>
        <div id={previewId} aria-live="polite" aria-atomic="true">
          <div className="mt-5 rounded-xl border p-4">
            <p className="text-xs font-semibold text-muted-foreground">Content brief</p>
            <p className="mt-2 text-sm leading-relaxed">{sample.brief}</p>
            <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">Warm & direct</span><span className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted-foreground">Form & Field</span></div>
          </div>
          <div className="flex items-center justify-center gap-2 py-3 text-xs font-medium text-primary"><ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /> Example draft</div>
          <div className="overflow-hidden rounded-2xl border">
            <div className="flex items-center gap-2.5 border-b px-4 py-3">
              <PlatformIcon name={platform.name} color={platform.color} size={25} />
              <p className="text-xs font-semibold">formandfield</p>
              <span className="ml-auto text-xs text-muted-foreground">Post preview</span>
            </div>
            <div className="bg-background p-5 text-foreground sm:p-6">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground">{sample.note}</p>
              <p className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{sample.title}</p>
              <p className="mt-4 text-xs font-medium">Form & Field</p>
            </div>
            <Image src="/images/brand-interior.webp" alt="A sunlit contemporary interior with a wood table and upholstered seating." width={1200} height={801} sizes="(min-width: 1280px) 480px, (min-width: 1024px) 40vw, (min-width: 640px) 560px, 85vw" className="aspect-4/3 w-full object-cover" />
            <div className="p-4">
              <p className="text-sm leading-relaxed">{sample.caption}</p>
              <p className="mt-2 text-xs font-medium text-primary">{sample.tags}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />Sample creative</span><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-mint-foreground" aria-hidden="true" />Editable draft</span></div>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Sample copy and photography, not live AI generation. Review every draft before publishing.</p>
      </div>
    </div>
  );
}