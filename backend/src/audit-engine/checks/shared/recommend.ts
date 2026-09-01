import { htmlToText } from './html.js';

/**
 * ─── Deterministic recommendation rules ──────────────────────────────
 * Generates the `suggested` value that the Fix Center's review workflow edits. Every suggestion
 * is derived ONLY from the resource's own real content — a truncation of its existing text, or
 * an excerpt of its own description. Nothing is invented, no external model is involved, and
 * the same input always produces the same suggestion.
 *
 * A rule that cannot produce a defensible value returns null, and the row simply carries no
 * suggestion — an honest blank beats a fabricated one. (This is why duplicates get no
 * suggestion: any de-duplicating suffix we could invent would be arbitrary copy the merchant
 * never wrote.)
 */

/** Cuts at a word boundary at or under `max`, never mid-word, never with trailing punctuation. */
export function truncateAtWord(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max + 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : clean.slice(0, max);
  return cut.replace(/[\s,;:.\-–—|]+$/, '');
}

/**
 * Title suggestion for a too-long title: the same title, cut at a word boundary to fit.
 * For a too-short title: the title extended with the store name — both halves are real.
 * Returns null when no rule applies (missing/duplicate).
 */
export function suggestTitle(current: string, shopName: string, min: number, max: number): string | null {
  const title = current.trim();
  if (!title) return null;
  if (title.length > max) return truncateAtWord(title, max);
  if (title.length < min) {
    const extended = `${title} | ${shopName.trim()}`;
    // Only suggest when the extension actually lands the title in range — a suggestion that
    // itself fails validation would be worse than none.
    if (extended.length >= min && extended.length <= max) return extended;
    return null;
  }
  return null;
}

/**
 * Meta-description suggestion:
 *  · too long → the same description, word-truncated to fit;
 *  · missing/too short → an excerpt of the page's OWN body copy, when there is enough of it.
 * Returns null when the page has no usable copy to excerpt.
 */
export function suggestDescription(current: string, bodyHtml: string, min: number, max: number): string | null {
  const existing = current.trim();
  if (existing.length > max) return truncateAtWord(existing, max);

  const body = htmlToText(bodyHtml);
  if (body.length < min) return null;
  const excerpt = truncateAtWord(body, max);
  return excerpt.length >= min ? excerpt : null;
}
