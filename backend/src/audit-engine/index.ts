import type { AuditCheck } from './types.js';

/**
 * Every audit check the engine will run, in one flat registry.
 *
 * Empty until Phase D onward registers the real SEO/Content/Speed/CRO/AI-Discovery checks.
 * The runner groups by `pillar` at execution time and isolates each check's failure, so this
 * list can grow one check at a time with no runner changes and no risk to already-live checks.
 */
export const checkRegistry: AuditCheck[] = [];
