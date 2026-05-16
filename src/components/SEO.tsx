/**
 * SEO Component
 *
 * A small reusable wrapper around react-helmet-async that sets the per-route
 * SEO tags every page needs: <title>, meta description, canonical URL,
 * Open Graph tags, and an optional JSON-LD structured data block.
 *
 * Each public route in the app should render <SEO ... /> near the top of its
 * JSX so crawlers (and JS-executing social previews) see route-specific tags
 * instead of the generic sitewide ones in index.html.
 */
import { Helmet } from "react-helmet-async";

// Canonical site origin used for absolute URLs in canonical/og:url tags.
// Crawlers redirect the lovable.app subdomain to this published domain.
const SITE_URL = "https://bingeguide-app.lovable.app";

interface SEOProps {
  /** Page title (kept under ~60 characters for search engines). */
  title: string;
  /** Meta description (50-160 chars recommended). */
  description: string;
  /** Path-only canonical (e.g. "/about"). The site origin is prepended. */
  path: string;
  /** Open Graph type — "website" for most pages, "article"/"video.movie" etc. for specific content. */
  ogType?: string;
  /** Optional absolute image URL for social previews. */
  image?: string;
  /** Optional JSON-LD structured data object (will be JSON-stringified). */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export const SEO = ({
  title,
  description,
  path,
  ogType = "website",
  image,
  jsonLd,
}: SEOProps) => {
  // Build the absolute canonical/og URL from the relative path.
  const url = `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  // Allow callers to pass a single JSON-LD object or an array of them.
  const jsonLdBlocks = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd
      : [jsonLd]
    : [];

  return (
    <Helmet>
      {/* Primary page metadata */}
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* Canonical URL — tells search engines the preferred URL for this content */}
      <link rel="canonical" href={url} />

      {/* Open Graph tags — used by JS-executing crawlers for social previews */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      {image && <meta property="og:image" content={image} />}

      {/* Twitter card mirrors og:* for Twitter/X previews */}
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}

      {/* Optional JSON-LD structured data blocks */}
      {jsonLdBlocks.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
};
