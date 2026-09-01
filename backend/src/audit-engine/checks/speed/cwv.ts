import type { AuditCheck, SubPillarResult } from '../../types.js';
import { unavailableResult } from '../../types.js';
import type { StoreSnapshot } from '../../store-data/types.js';

/**
 * ─── Speed · Core Web Vitals ─────────────────────────────────────────
 * LCP, INP and CLS are RENDER-TIME measurements: they only exist inside a real browser loading
 * the real public page. Nothing in the Admin API approximates them, and fabricating them from
 * catalogue data would be exactly the kind of invented score this engine exists to prevent.
 *
 * This check is registered so CWV participates honestly in every audit: it inspects the
 * snapshot's storefront probes and reports PRECISELY why measurement is not possible, in the
 * merchant's terms, instead of leaving a silent gap. When lab tooling (Lighthouse) is wired up
 * AND the storefront is publicly reachable, this file is where the real measurement lands.
 */
export const cwvCheck: AuditCheck = {
  id: 'speed.cwv',
  pillar: 'speed',
  subPillar: 'cwv',

  execute(snapshot: StoreSnapshot): SubPillarResult {
    // Password gating is the more specific, merchant-actionable reason — report it first.
    if (snapshot.storefront?.passwordProtected) {
      return unavailableResult(
        'cwv',
        'Core Web Vitals are measured by loading your live storefront in a browser, and your storefront is currently password-protected — every page redirects to the password screen. Remove the storefront password (Shopify admin → Online Store → Preferences) to enable this measurement.',
      );
    }
    if (!snapshot.coverage.storefront) {
      return unavailableResult('cwv', 'Your storefront could not be reached to attempt a measurement.');
    }
    return unavailableResult(
      'cwv',
      'Core Web Vitals need a lab measurement (a real browser loading your storefront), which is not yet configured on this Scorelo server. No metric is estimated in its place.',
    );
  },
};
