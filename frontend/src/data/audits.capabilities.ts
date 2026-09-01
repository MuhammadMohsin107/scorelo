import { api } from '../lib/api';

/**
 * Which sub-pillars Scorelo's engine can actually measure.
 *
 * This exists so the UI can distinguish two empty states that look identical but mean opposite
 * things:
 *
 *   "No audit has been run yet"        → offer Run Audit; running one WILL populate the page.
 *   "Scorelo cannot measure this yet"  → do NOT offer Run Audit; running one changes nothing.
 *
 * Before this, every unimplemented sub-pillar offered a Run Audit button that started a real
 * (slow, rate-limited) audit and then returned the user to the same empty page — a dead end that
 * read as a broken feature.
 *
 * The list is derived on the backend from checkRegistry, so it cannot drift from what actually
 * runs. It is store-independent, so it is fetched once and cached for the session.
 */

const CAPABILITIES_PATH = '/audits/capabilities';

let cached: Promise<Set<string>> | null = null;

export function fetchImplementedSubPillars(): Promise<Set<string>> {
  cached ??= api
    .get<{ implementedSubPillars: string[] }>(CAPABILITIES_PATH)
    .then((data) => new Set(data.implementedSubPillars))
    // A failed capability lookup must not make working sub-pillars look unimplemented. Falling
    // back to an empty set would hide Run Audit everywhere; instead we rethrow-as-null so callers
    // treat capability as UNKNOWN and keep the previous (offer-the-run) behaviour.
    .catch(() => {
      cached = null;
      throw new Error('capabilities unavailable');
    });
  return cached;
}

/**
 * Resolves whether a sub-pillar is measurable.
 * Returns `null` when the capability list could not be loaded — meaning "unknown", which callers
 * should treat as "assume it works" rather than "assume it is broken".
 */
export async function isSubPillarImplemented(pillar: string, subPillar: string): Promise<boolean | null> {
  try {
    const implemented = await fetchImplementedSubPillars();
    return implemented.has(`${pillar}/${subPillar}`);
  } catch {
    return null;
  }
}
