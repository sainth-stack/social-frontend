import { forwardRef, type SVGProps } from "react";
import type { LucideIcon } from "lucide-react";

type IconProps = SVGProps<SVGSVGElement>;

function icon(
  displayName: string,
  render: (props: IconProps) => React.ReactElement,
): LucideIcon {
  const Component = forwardRef<SVGSVGElement, IconProps>((props, ref) =>
    render({ ...props, ref }),
  );
  Component.displayName = displayName;
  return Component as LucideIcon;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Home / overview — four balanced tiles (SaaS dashboard convention). */
export const ProductDashboardIcon = icon("ProductDashboardIcon", ({ className, ref, ...props }) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={className}
    aria-hidden
    {...props}
  >
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" {...stroke} />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" {...stroke} />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" {...stroke} />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" {...stroke} />
  </svg>
));

/** Content studio — artboard + pen (creation, not “magic sparkles”). */
export const ProductAIStudioIcon = icon("ProductAIStudioIcon", ({ className, ref, ...props }) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={className}
    aria-hidden
    {...props}
  >
    <rect x="3" y="4" width="18" height="16" rx="2.5" {...stroke} />
    <path d="M3 9h18M8 4v5M7 13h4M7 16h2m5 1 4-4m-4 0h4v4" {...stroke} />
  </svg>
));

/** Compact mark for page headers and CTAs. */
export const ProductGenerateIcon = icon("ProductGenerateIcon", ({ className, ref, ...props }) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={className}
    aria-hidden
    {...props}
  >
    <path d="M6 5.5h9a2 2 0 0 1 2 2v9.5" {...stroke} />
    <path d="M6 9.5h7M6 12.5h5" {...stroke} />
    <path d="m13.5 19.5 6-6 1.5 1.5-6 6H12v-1.5Z" {...stroke} />
  </svg>
));

export const ProductPublishIcon = icon("ProductPublishIcon", ({ className, ref, ...props }) => (
  <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} aria-hidden {...props}>
    <path d="M12 16V3m-5 5 5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" {...stroke} />
  </svg>
));
