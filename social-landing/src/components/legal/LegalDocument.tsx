import Link from "next/link";
import { BrandLockup } from "@/components/landing/Brand";
import { SiteFooter } from "@/components/landing/Closing";
import { legalLinks, legalMeta, type LegalBlock, type LegalDocument as LegalDocumentType } from "@/content/legal";
import { brand } from "@/content/site";

function Block({ block }: { block: LegalBlock }) {
  if (block.type === "p") return <p>{block.text}</p>;
  if (block.type === "subheading") return <h3 className="legal-subheading">{block.text}</h3>;
  if (block.type === "ul") {
    return (
      <ul className="legal-list">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if (block.type === "ol") {
    return (
      <ol className="legal-list legal-list-ordered">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    );
  }
  return (
    <div className="legal-table-wrap" tabIndex={0} role="region" aria-label="Details">
      <table className="legal-table">
        <thead>
          <tr>
            {block.headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.join("|")}>
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={cell} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={cell}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function isCurrentLegalLink(slug: LegalDocumentType["slug"], href: string) {
  return slug === "privacy" ? href === legalMeta.privacyPath || href.endsWith(legalMeta.privacyPath) : href === legalMeta.termsPath || href.endsWith(legalMeta.termsPath);
}

export function LegalDocumentView({ document }: { document: LegalDocumentType }) {
  const other = legalLinks.find((link) => !isCurrentLegalLink(document.slug, link.href));

  return (
    <>
      <header className="legal-topbar">
        <div className="container-page legal-topbar-inner">
          <Link href="/" aria-label={`${brand.name} home`}>
            <BrandLockup />
          </Link>
          <nav className="legal-topbar-nav" aria-label="Legal documents">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={isCurrentLegalLink(document.slug, link.href) ? "is-active" : undefined}
                aria-current={isCurrentLegalLink(document.slug, link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="legal-page">
        <article className="container-page legal-article">
          <p className="eyebrow">{document.eyebrow}</p>
          <h1 className="legal-title">{document.title}</h1>
          <p className="legal-updated">
            {document.updatedLabel}: {document.updatedValue}
          </p>
          <p className="legal-operator">{document.operatorLine}</p>
          <p className="legal-intro">{document.intro}</p>

          {document.sections.map((section) => (
            <section key={section.id} id={section.id} className="legal-section">
              <h2>{section.title}</h2>
              {section.blocks.map((block, index) => (
                <Block key={`${section.id}-${index}`} block={block} />
              ))}
            </section>
          ))}

          {other ? (
            <p className="legal-crosslink">
              Also see our{" "}
              <Link href={other.href}>{other.label}</Link>.
            </p>
          ) : null}
        </article>
      </main>

      <SiteFooter />
    </>
  );
}
