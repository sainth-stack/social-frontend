"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Megaphone,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { PlatformIcon } from "@/components/platform-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SocialPlatform } from "@/types/social-media.types";

const steps = ["Business", "About", "Goals", "Brand style", "Accounts", "Done"];

const goalOptions = [
  { id: "sales", label: "Increase sales", icon: TrendingUp },
  { id: "leads", label: "Generate leads", icon: Target },
  { id: "brand", label: "Build brand", icon: Sparkles },
  { id: "engagement", label: "Boost engagement", icon: Megaphone },
];

const platforms: SocialPlatform[] = ["instagram", "facebook", "linkedin", "x"];
const platformLabels: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    business: "",
    industry: "",
    website: "",
    description: "",
    products: "",
    goals: [] as string[],
    tone: "",
    audience: "",
    keywords: "",
    cta: "",
    accounts: [] as SocialPlatform[],
  });

  function update<K extends keyof typeof data>(k: K, v: (typeof data)[K]) {
    setData((d) => ({ ...d, [k]: v }));
  }

  function toggleGoal(id: string) {
    update(
      "goals",
      data.goals.includes(id) ? data.goals.filter((g) => g !== id) : [...data.goals, id],
    );
  }

  function toggleAccount(p: SocialPlatform) {
    update(
      "accounts",
      data.accounts.includes(p)
        ? data.accounts.filter((x) => x !== p)
        : [...data.accounts, p],
    );
  }

  const canNext = (() => {
    if (step === 0) return data.business.trim().length > 1;
    if (step === 1) return data.description.trim().length > 5;
    if (step === 2) return data.goals.length > 0;
    return true;
  })();

  function finish() {
    toast.success("Workspace ready");
    router.push("/dashboard/accounts");
  }

  function next() {
    if (step < steps.length - 1) setStep(step + 1);
    else finish();
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  function skipSetup() {
    router.push("/dashboard/accounts");
  }

  return (
    <div className="mx-auto w-full max-w-2xl py-4">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">OpsBrain AI</span>
        </Link>
        <button
          type="button"
          onClick={skipSetup}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Skip setup
        </button>
      </div>

      <div className="mb-8 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium",
                i < step
                  ? "border-primary bg-primary text-primary-foreground"
                  : i === step
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground",
              )}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            {i < steps.length - 1 ? (
              <div className={cn("h-px flex-1", i < step ? "bg-primary" : "bg-border")} />
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-elevated">
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Step {step + 1} of {steps.length}
        </div>

        {step === 0 && (
          <>
            <h2 className="text-xl font-semibold">Tell us about your business</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We&apos;ll tailor content and voice to fit you.
            </p>
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label>Business name</Label>
                <Input
                  value={data.business}
                  onChange={(e) => update("business", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Select
                  value={data.industry || undefined}
                  onValueChange={(v) => update("industry", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "E-commerce",
                      "SaaS",
                      "Coaching",
                      "Fitness",
                      "Food & Beverage",
                      "Real Estate",
                      "Agency",
                      "Other",
                    ].map((x) => (
                      <SelectItem key={x} value={x}>
                        {x}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input
                  placeholder="https://"
                  value={data.website}
                  onChange={(e) => update("website", e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="text-xl font-semibold">What do you do?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              One or two sentences is perfect.
            </p>
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={4}
                  placeholder="We design and sell modern home goods for small spaces."
                  value={data.description}
                  onChange={(e) => update("description", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Products or services</Label>
                <Textarea
                  rows={3}
                  placeholder="Handcrafted ceramics, curated lighting, subscription boxes…"
                  value={data.products}
                  onChange={(e) => update("products", e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-xl font-semibold">What are your goals?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick as many as apply — we&apos;ll bias content to match.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {goalOptions.map((g) => {
                const active = data.goals.includes(g.id);
                const Icon = g.icon;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGoal(g.id)}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all",
                      active
                        ? "border-primary bg-primary/5 shadow-soft"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">{g.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-xl font-semibold">Brand style</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This shapes tone, wording, and calls to action.
            </p>
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tone of voice</Label>
                  <Select
                    value={data.tone || undefined}
                    onValueChange={(v) => update("tone", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a tone" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Friendly", "Professional", "Playful", "Bold", "Warm", "Minimal"].map(
                        (x) => (
                          <SelectItem key={x} value={x}>
                            {x}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Primary CTA</Label>
                  <Input
                    placeholder="Shop now, Book a call…"
                    value={data.cta}
                    onChange={(e) => update("cta", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Target audience</Label>
                <Input
                  placeholder="Busy founders, home renters aged 25–40…"
                  value={data.audience}
                  onChange={(e) => update("audience", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Keywords</Label>
                <Input
                  placeholder="handmade, sustainable, small-batch"
                  value={data.keywords}
                  onChange={(e) => update("keywords", e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="text-xl font-semibold">Connect your accounts</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You can skip this and connect later from Accounts.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {platforms.map((p) => {
                const active = data.accounts.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleAccount(p)}
                    className={cn(
                      "flex items-center justify-between rounded-xl border p-4 transition-all",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <PlatformIcon platform={p} />
                      <span className="text-sm font-medium">{platformLabels[p]}</span>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {active ? "Selected" : "Connect"}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 5 && (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold">Your workspace is ready</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              We&apos;ve captured your brand profile. Connect accounts next to start publishing.
            </p>
            <Button className="mt-8" size="lg" onClick={finish}>
              Go to Accounts <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step < 5 && (
          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" onClick={back} disabled={step === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <div className="flex items-center gap-2">
              {step === 4 ? (
                <Button variant="outline" onClick={next}>
                  Skip
                </Button>
              ) : null}
              <Button onClick={next} disabled={!canNext}>
                {step === 4 ? "Finish" : "Continue"}{" "}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
