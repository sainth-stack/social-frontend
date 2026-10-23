"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";

export function ContactForm() {
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "contact", ...Object.fromEntries(values) }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        throw new Error(data && typeof data === "object" && "detail" in data && typeof data.detail === "string" ? data.detail : "Your message could not be saved. Please try again.");
      }
      form.reset();
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error && reason.name !== "TimeoutError" ? reason.message : "The request timed out. Please try again.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  const field = "mt-2 block min-h-11 w-full rounded-xl border bg-background px-3 py-2 text-base outline-offset-2 focus-visible:outline-primary";

  return <section id="contact" aria-labelledby="contact-heading" className="section-y mb-16 border-y bg-surface md:mb-20">
    <div className="container-page grid items-start gap-10 lg:grid-cols-2 lg:gap-20">
      <div><p className="eyebrow">Contact our team</p><h2 id="contact-heading" className="section-heading mt-4">Let’s talk about your workflow.</h2><p className="section-intro mt-5">Tell us about your business, team or Scale requirements. Your enquiry goes directly to our team for review.</p><p className="mt-5 text-sm text-muted-foreground">We use these details to respond to your enquiry. Do not include passwords, payment details or confidential customer data.</p></div>
      {success ? <div role="status" className="card-panel min-w-0 p-6 sm:p-8"><h3 className="text-xl font-semibold">Your message has been received.</h3><p className="mt-3 text-muted-foreground">Our team can now review your enquiry and reply to the email you provided.</p><button type="button" onClick={() => setSuccess(false)} className="btn btn-outline mt-6">Send another message</button></div> : <form onSubmit={submit} className="card-panel grid min-w-0 gap-5 p-6 sm:p-8" aria-busy={pending}>
        <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium" htmlFor="contact-name">Name<input className={field} id="contact-name" name="name" autoComplete="name" required minLength={2} maxLength={100} /></label><label className="text-sm font-medium" htmlFor="contact-email">Work email<input className={field} id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} /></label></div>
        <label className="text-sm font-medium" htmlFor="contact-company">Company <span className="font-normal text-muted-foreground">(optional)</span><input className={field} id="contact-company" name="company" autoComplete="organization" maxLength={160} /></label>
        <label className="text-sm font-medium" htmlFor="contact-message">How can we help?<textarea className={`${field} min-h-36 resize-y`} id="contact-message" name="message" required minLength={10} maxLength={5000} /></label>
        <div hidden aria-hidden="true"><label htmlFor="contact-website">Leave empty</label><input id="contact-website" name="website" tabIndex={-1} autoComplete="off" /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={pending} className="btn btn-primary w-full sm:w-fit">{pending ? "Sending…" : "Send enquiry"}</button>
      </form>}
    </div>
  </section>;
}