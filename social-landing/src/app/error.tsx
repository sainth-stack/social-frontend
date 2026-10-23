"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center px-6 text-center"><div><h1 className="text-3xl font-bold">Something didn’t load.</h1><p className="mt-4 text-muted-foreground">Please try again, or return to the homepage.</p><div className="mt-6 flex justify-center gap-3"><button onClick={reset} className="btn btn-primary">Try again</button><Link href="/" className="btn btn-outline">Go home</Link></div></div></main>;
}