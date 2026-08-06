/**
 * "Available On" section
 * ----------------------
 * Shows where a title can be watched in India, enriched by the external
 * availability provider (currently Watchmode) through a secure Edge Function.
 *
 * Behaviour:
 *  - While loading it shows nothing (the existing TMDB "Watch Now" block is
 *    still on the page, so the user never sees an empty gap).
 *  - If the provider has no data, the component renders nothing at all —
 *    the page falls back to the TMDB providers already displayed.
 */

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  fetchStreamingAvailability,
  type AvailabilityOffer,
} from '@/lib/streamingAvailability';

interface AvailableOnProps {
  contentType: 'movie' | 'tv';
  tmdbId: number;
  imdbId?: string | null;
  title?: string | null;
  year?: string | number | null;
}

/** Human friendly group headings, in the order we want to display them. */
const GROUPS: { key: AvailabilityOffer['type']; label: string }[] = [
  { key: 'stream', label: 'Streaming' },
  { key: 'free', label: 'Free' },
  { key: 'rent', label: 'Rent' },
  { key: 'buy', label: 'Buy' },
  { key: 'other', label: 'Other' },
];

export const AvailableOn = ({ contentType, tmdbId, imdbId, title, year }: AvailableOnProps) => {
  const { data } = useQuery({
    queryKey: ['streaming-availability', contentType, tmdbId],
    queryFn: () => fetchStreamingAvailability({ contentType, tmdbId, imdbId, title, year }),
    enabled: !!tmdbId,
    // The backend caches for 24h; keep the browser copy fresh for 1 hour.
    staleTime: 60 * 60 * 1000,
  });

  const offers = data?.offers ?? [];
  if (offers.length === 0) return null; // Graceful fallback: render nothing.

  return (
    <section className="bg-card/60 border border-border rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <PlayCircle className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold text-foreground">Available On</h2>
      </div>

      <div className="space-y-5">
        {GROUPS.map(({ key, label }) => {
          const groupOffers = offers.filter((offer) => offer.type === key);
          if (groupOffers.length === 0) return null;

          return (
            <div key={key} className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {label}
              </p>
              <div className="flex flex-wrap gap-3">
                {groupOffers.map((offer, index) => {
                  // Each card links out to the platform when a deep link exists.
                  const Wrapper = offer.web_url ? 'a' : 'div';
                  return (
                    <Wrapper
                      key={`${offer.provider_name}-${index}`}
                      {...(offer.web_url
                        ? { href: offer.web_url, target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                      className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3 py-2 transition-colors hover:border-primary"
                    >
                      {offer.logo_url ? (
                        <img
                          src={offer.logo_url}
                          alt={`${offer.provider_name} logo`}
                          loading="lazy"
                          className="h-10 w-10 rounded-lg object-contain"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xs font-bold">
                          {offer.provider_name.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {offer.provider_name}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {/* Show price for rent/buy when the provider reports it. */}
                          {offer.price
                            ? `${offer.currency === 'INR' ? '₹' : ''}${offer.price}`
                            : label}
                          {offer.format ? <Badge variant="secondary">{offer.format}</Badge> : null}
                          {offer.web_url ? <ExternalLink className="h-3 w-3" /> : null}
                        </span>
                      </div>
                    </Wrapper>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Availability data provided by Watchmode. Prices and platforms may change.
      </p>
    </section>
  );
};
