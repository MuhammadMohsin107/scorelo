import type { AuditCheck, SubPillarEvidenceRow, SubPillarFindingResult, SubPillarResult } from '../../types.js';
import { unavailableResult } from '../../types.js';
import { scoreSubPillar } from '../../scoring.js';
import type { StoreSnapshot } from '../../store-data/types.js';
import type { FetchedResource } from '../../storefront/types.js';

/**
 * ─── AI Discovery · agents.md / llms.txt ─────────────────────────────
 * Requests the two agent-facing files at the storefront root and reports what came back.
 *
 * THIS CHECK IS WHERE A PASSWORD-GATED STORE WOULD PRODUCE ITS MOST CONVINCING LIE.
 * Shopify's access gate answers EVERY url with HTTP 200 and the password page — so on a gated
 * store `/agents.md` returns 200 and roughly 11KB of real HTML. A check that reasoned from the
 * status code, or from "is the body non-empty", would report both files as present and
 * substantial on a store that has neither. The crawler flags each gated response and withholds
 * its body for exactly this reason, and this check treats a gated response as NOT MEASURED rather
 * than as evidence of anything.
 *
 * A 404 is a real, measured answer: the file is genuinely absent. That is a finding, not an
 * unavailability — the distinction being that Scorelo looked and the server told it.
 *
 * WHAT COUNTS AS PRESENT
 * A 2xx response, not gated, whose body has actual content and is not HTML. A Shopify store with
 * no such file typically serves the 404 page as HTML with a 404 status; some themes answer 200
 * with an HTML error page, which is why content type is checked as well as status.
 */

const HEALTHY = 'Healthy';
const NEEDS_WORK = 'Needs Work';

/** Below this a file exists but says nothing an agent could use. */
const MIN_USEFUL_BYTES = 40;

interface Assessment {
  present: boolean;
  status: string;
  detail: string;
  recommendation: string;
  /** True when the response could not be interpreted at all — excluded from scoring. */
  unmeasurable: boolean;
}

function assess(resource: FetchedResource | null, filename: string): Assessment {
  if (!resource || resource.reason === 'timeout' || resource.reason === 'dns' || resource.reason === 'connection' || resource.reason === 'ssl') {
    return {
      present: false,
      status: NEEDS_WORK,
      detail: 'Scorelo could not reach this URL',
      recommendation: `Could not be checked — Scorelo could not load /${filename}.`,
      unmeasurable: true,
    };
  }

  // The gate's 200 is not the file's 200.
  if (resource.passwordGated) {
    return {
      present: false,
      status: NEEDS_WORK,
      detail: 'Storefront password page was returned instead of the file',
      recommendation: `Could not be checked while the storefront is password protected — /${filename} cannot be distinguished from the password screen.`,
      unmeasurable: true,
    };
  }

  if (resource.status === 404 || resource.status === 410) {
    return {
      present: false,
      status: NEEDS_WORK,
      detail: `HTTP ${resource.status} — the file is not published`,
      recommendation: `Publish /${filename} at your storefront root so AI assistants can read how to use your store.`,
      unmeasurable: false,
    };
  }

  if (resource.status < 200 || resource.status >= 300) {
    return {
      present: false,
      status: NEEDS_WORK,
      detail: `HTTP ${resource.status}`,
      recommendation: `The server answered /${filename} with HTTP ${resource.status}. Publish the file, or fix the error.`,
      unmeasurable: false,
    };
  }

  const body = resource.body ?? '';
  const looksHtml = /^\s*<(!doctype|html)\b/i.test(body) || /text\/html/i.test(resource.contentType ?? '');
  if (looksHtml) {
    // 200 + HTML at a .md/.txt path is a theme's catch-all page, not the file.
    return {
      present: false,
      status: NEEDS_WORK,
      detail: 'The server returned an HTML page rather than the file',
      recommendation: `/${filename} is answering with your theme's HTML, which means the file itself is not published.`,
      unmeasurable: false,
    };
  }

  if (body.trim().length < MIN_USEFUL_BYTES) {
    return {
      present: true,
      status: NEEDS_WORK,
      detail: `Published but only ${body.trim().length} bytes`,
      recommendation: `Expand /${filename} — an almost-empty file gives an agent nothing to act on.`,
      unmeasurable: false,
    };
  }

  return {
    present: true,
    status: HEALTHY,
    detail: `Published, ${body.trim().length} bytes`,
    recommendation: '—',
    unmeasurable: false,
  };
}

export const agentsMdCheck: AuditCheck = {
  id: 'ai-discovery.agents-md',
  pillar: 'ai-discovery',
  subPillar: 'agents-md',

  execute(snapshot: StoreSnapshot): SubPillarResult {
    const crawl = snapshot.crawl;
    if (!crawl) {
      return unavailableResult('agents-md', 'Storefront crawling is switched off for this Scorelo instance, so agents.md and llms.txt could not be checked.');
    }

    const files = [
      { filename: 'agents.md', resource: crawl.agentsMd, label: 'agents.md' },
      { filename: 'llms.txt', resource: crawl.llmsTxt, label: 'llms.txt' },
    ];

    const assessments = files.map((file) => ({ ...file, assessment: assess(file.resource, file.filename) }));
    const measurable = assessments.filter((entry) => !entry.assessment.unmeasurable);

    // Nothing could be interpreted — gated, or the storefront was unreachable. Reported as not
    // measured, never as "no agent files", because those are different facts about the store.
    if (measurable.length === 0) {
      return unavailableResult(
        'agents-md',
        crawl.passwordGated
          ? 'Your storefront is password protected, so every URL returns the password screen and Scorelo cannot tell whether agents.md or llms.txt exist. Remove the password under Online Store → Preferences in Shopify, then run the audit again.'
          : 'Scorelo could not reach your storefront, so it could not check whether agents.md or llms.txt exist.',
      );
    }

    const rows: SubPillarEvidenceRow[] = assessments.map((entry) => ({
      id: `file:${entry.filename}`,
      status: entry.assessment.unmeasurable ? NEEDS_WORK : entry.assessment.status,
      facet: entry.assessment.unmeasurable ? NEEDS_WORK : entry.assessment.status,
      cells: {
        signal: `/${entry.filename}`,
        detail: entry.assessment.detail,
        coverage: entry.assessment.present ? 100 : 0,
        status: entry.assessment.unmeasurable ? NEEDS_WORK : entry.assessment.status,
        recommendation: entry.assessment.recommendation,
      },
      current: {
        label: 'Requested',
        value: entry.assessment.detail,
        meta: entry.resource ? entry.resource.url : `${crawl.origin}/${entry.filename}`,
      },
      suggested: { label: 'Recommendation', value: entry.assessment.recommendation },
    }));

    const analyzed = measurable.length;
    const healthy = measurable.filter((entry) => entry.assessment.status === HEALTHY).length;
    const absent = measurable.filter((entry) => !entry.assessment.present);
    const findings: SubPillarFindingResult[] = [];

    if (absent.length > 0) {
      findings.push({
        title: absent.length === measurable.length
          ? 'No agent-readable instructions published'
          : 'One agent-readable file is missing',
        // Neither file is an established standard yet, so an absent file is an opportunity rather
        // than a defect. Scoring it 'high' would put a store in the red for not adopting a
        // convention most of the web has not adopted either.
        severity: 'low',
        affectedCount: absent.length,
        affectedLabel: absent.length === 1 ? 'file' : 'files',
        impact: 'Medium',
        scoreLift: Math.round((absent.length / analyzed) * 100),
        resolutionType: 'content',
        problem: `${absent.map((entry) => `/${entry.filename}`).join(' and ')} ${absent.length === 1 ? 'is' : 'are'} not published at your storefront root.`,
        why: 'AI shopping assistants increasingly look for a plain-text file at a known path describing what a site sells and how it may be used. Without one they fall back to guessing from your HTML, which gives you no say in how your store is represented.',
        recommendation: 'Publish a short llms.txt (and optionally agents.md) at your storefront root covering what you sell, your key collections, shipping and returns, and how you want AI assistants to describe you.',
        evidence: absent.map((entry) => `${crawl.origin}/${entry.filename}: ${entry.assessment.detail}.`),
        evidenceRows: rows,
        details: { issueType: NEEDS_WORK, effort: 'Low' },
      });
    }

    const thin = measurable.filter((entry) => entry.assessment.present && entry.assessment.status !== HEALTHY);
    if (thin.length > 0) {
      findings.push({
        title: 'Agent instruction file is too thin to be useful',
        severity: 'low',
        affectedCount: thin.length,
        affectedLabel: 'files',
        impact: 'Low',
        scoreLift: Math.round((thin.length / analyzed) * 100),
        resolutionType: 'content',
        problem: `${thin.map((entry) => `/${entry.filename}`).join(' and ')} exists but contains almost no content.`,
        why: 'An empty file is worse than none: it signals the convention is supported while giving an agent nothing to read.',
        recommendation: 'Describe what you sell, your main collections, and your shipping and returns terms.',
        evidence: thin.map((entry) => `${crawl.origin}/${entry.filename}: ${entry.assessment.detail}.`),
        details: { issueType: NEEDS_WORK, effort: 'Low' },
      });
    }

    const skipped = assessments.filter((entry) => entry.assessment.unmeasurable);

    return {
      subPillar: 'agents-md',
      status: 'ok',
      score: scoreSubPillar(analyzed, healthy, findings),
      analyzedCount: analyzed,
      healthyCount: healthy,
      details: {
        status: 'ok',
        summary: `${healthy} of ${analyzed} agent-readable ${analyzed === 1 ? 'file was' : 'files were'} found at your storefront root.${skipped.length > 0 ? ` ${skipped.map((entry) => `/${entry.filename}`).join(' and ')} could not be checked.` : ''} Scorelo requested each file directly rather than inferring it.`,
        healthChip: `${((healthy / analyzed) * 100).toFixed(1)}% healthy`,
        contextLabel: 'Files published',
        contextValue: `${measurable.filter((entry) => entry.assessment.present).length} of ${analyzed}`,
        evidenceRows: rows,
      },
      findings,
    };
  },
};
