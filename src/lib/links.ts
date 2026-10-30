/**
 * Token page URL: the readable slug ("/tokens/JOB-SOL") when known, else the id (the page then swaps to the slug).
 */
export function tokenPath(token: { slug?: string | null; id?: number } | null | undefined, id?: number | null): string {
  return `/tokens/${token?.slug ?? token?.id ?? id}`
}
