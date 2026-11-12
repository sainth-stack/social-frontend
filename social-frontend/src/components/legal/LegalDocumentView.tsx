import Link from "next/link";
import { EarnedVoiceLogo } from "@/components/brand/EarnedVoiceLogo";
import { legalLinks, legalMeta, type LegalBlock, type LegalDocument } from "@shared/content/legal";
import { legalUrls, platformBrand } from "@/lib/brand";

function Block({ block }: { block: LegalBlock }) {
  if (block.type === "p") return <p className="mt-3.5 text-[15px] leading-[1.85] text-foreground/90">{block.text}</p>;
  if (block.type === "subheading") return <h3 className="mt-5 text-[15px] font-semibold tracking-tight">{block.text}</h3>;
  if (block.type === "ul" || block.type === "ol") {
    const List = block.type === "ol" ? "ol" : "ul";
    return (
      <List className={`mt-3.5 space-y-2.5 pl-5 text-[15px] leading-[1.85] text-foreground/90 ${block.type === "ol" ? "list-decimal" : "list-disc"}`}>
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </List>
    );
  }
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card" tabIndex={0} role="region" aria-label="Details">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {block.headers.map((header) => (
              <th key={header} scope="col" className="px-4 py-3 text-left font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.join("|")} className="border-b border-border last:border-0">
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={cell} scope="row" className="w-[40%] px-4 py-3 text-left font-semibold">
                    {cell}
                  </th>
                ) : (
                  <td key={cell} className="px-4 py-3 text-foreground/90">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function isCurrentLegalLink(slug: LegalDocument["slug"], href: string) {
  return slug === "privacy"
    ? href.endsWith(legalMeta.privacyPath)
    : href.endsWith(legalMeta.termsPath);
}

export function LegalDocumentView({ document }: { document: LegalDocument }) {
  const other = legalLinks.find((link) => !isCurrentLegalLink(document.slug, link.href));

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/login" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={platformBrand.name}>
            <EarnedVoiceLogo size={32} />
          </Link>
          <nav className="flex flex-wrap gap-3 text-sm text-muted-foreground" aria-label="Legal documents">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={isCurrentLegalLink(document.slug, link.href) ? "font-semibold text-primary" : "hover:text-primary"}
                aria-current={isCurrentLegalLink(document.slug, link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="px-4 py-10 sm:px-6 sm:py-14">
        <article className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{document.eyebrow}</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">{document.title}</h1>
          <p className="mt-3 text-sm font-semibold">
            {document.updatedLabel}: {document.updatedValue}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{document.operatorLine}</p>
          <p className="mt-7 text-base leading-[1.85]">{document.intro}</p>

          {document.sections.map((section) => (
            <section key={section.id} id={section.id} className="mt-10 scroll-mt-24 border-t border-border pt-8">
              <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{section.title}</h2>
              {section.blocks.map((block, index) => (
                <Block key={`${section.id}-${index}`} block={block} />
              ))}
            </section>
          ))}

          {other ? (
            <p className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
              Also see our{" "}
              <Link href={other.href} className="font-semibold text-primary underline-offset-4 hover:underline">
                {other.label}
              </Link>
              .
            </p>
          ) : null}

          <p className="mt-8 text-center text-xs text-muted-foreground">
            <Link href="/register" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
            {" · "}
            <Link href={legalUrls.privacy} className="font-medium text-primary hover:underline">
              Privacy Policy
            </Link>
          </p>
        </article>
      </main>
    </div>
  );
}
