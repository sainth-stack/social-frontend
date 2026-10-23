import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center px-6 text-center"><div><p className="eyebrow">404 · Page not found</p><h1 className="mt-4 text-4xl font-bold">Let’s get you back on track.</h1><p className="mt-4 text-muted-foreground">This page may have moved, or the address may be incorrect.</p><Link href="/" className="btn btn-primary mt-8">Back to EarnedVoice</Link></div></main>;
}