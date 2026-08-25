// ─── Sub-pillar seed-data exporter ───────────────────────────────────
// One-shot migration tool: converts the hand-authored frontend analysis
// data (SEO analyses + generic pillar catalogs) into the JSON consumed
// by backend/src/db/seed.ts, so the database — not the frontend — holds
// the audit data. Run from frontend/:  npx tsx scripts/export-seed-data.ts
//
// Derivation rules (fields the frontend contract doesn't carry but the
// findings table requires):
//   - affectedLabel (SEO): last word of the evidence sampleNoun
//     ("crawled pages" → "pages"), falling back to "items".
//   - scoreLift (SEO): by severity — critical 3, high 2, medium/low 1.
//     Matches the values the previous hand-seeded findings used.
//   - evidence bullets: first-column values of up to two evidence rows
//     with the finding's issueType, plus an "N <label> affected" line;
//     when no rows match (generic tables use their own statuses), the
//     finding's problem statement is used instead.
// Non-SEO findings keep their real affectedLabel/scoreLift/resolution
// from the raw pillar finding (joined by id) — nothing is invented.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { seoAnalyses } from '../src/data/seo/analyses';
import { genericCatalog } from '../src/pages/pillarCatalogs/genericCatalog';
import { detailCatalog } from '../src/pages/pillarCatalogs/detailCatalog';
import { buildAnalysis, findingsByPillar } from '../src/data/genericAnalysis';
import type { EvidenceRow, SubPillarAnalysis, SubPillarFinding } from '../src/data/seo/subpillar.model';

interface SeedFinding {
  title: string;
  severity: string;
  affectedCount: number;
  affectedLabel: string;
  impact: string;
  scoreLift: number;
  resolutionType: string | null;
  problem: string;
  why: string;
  recommendation: string;
  evidence: string[];
  details: { issueType: string; effort: string };
}

interface SeedEntry {
  pillar: string;
  subPillar: string;
  score: number;
  analyzed: number;
  healthy: number;
  details: {
    summary: string;
    healthChip: string;
    contextLabel: string;
    contextValue: string;
    evidenceRows: EvidenceRow[];
  };
  findings: SeedFinding[];
}

const SCORE_LIFT_BY_SEVERITY: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 1 };

function affectedLabelFrom(sampleNoun: string): string {
  const lastWord = sampleNoun.trim().split(/\s+/).pop();
  return lastWord || 'items';
}

function evidenceBullets(finding: SubPillarFinding, rows: EvidenceRow[], affectedLabel: string, firstColumnKey: string | undefined): string[] {
  const matching = rows.filter((row) => row.status === finding.issueType);
  const samples = firstColumnKey
    ? matching.slice(0, 2).map((row) => String(row.cells[firstColumnKey] ?? row.id)).filter((value) => value.length > 0)
    : [];
  if (samples.length === 0) return [finding.whatIsWrong];
  return [...samples, `${finding.affected.toLocaleString()} ${affectedLabel} affected`];
}

function entryFromAnalysis(
  pillar: string,
  subPillar: string,
  analysis: SubPillarAnalysis,
  toSeedFinding: (finding: SubPillarFinding) => SeedFinding,
): SeedEntry {
  return {
    pillar,
    subPillar,
    score: analysis.totals.score,
    analyzed: analysis.totals.analyzed,
    healthy: analysis.totals.healthy,
    details: {
      summary: analysis.summary,
      healthChip: analysis.healthChip,
      contextLabel: analysis.totals.contextLabel,
      contextValue: analysis.totals.contextValue,
      evidenceRows: analysis.evidence.rows,
    },
    findings: analysis.findings.map(toSeedFinding),
  };
}

const outPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend/src/db/subpillar-seed.json');

// Already-migrated analyses are trimmed to empty presentation shells in the
// frontend, so they can't be regenerated from source — their existing JSON
// entry is authoritative and must be preserved on re-runs.
const existingEntries = new Map<string, SeedEntry>(
  existsSync(outPath)
    ? (JSON.parse(readFileSync(outPath, 'utf8')).entries as SeedEntry[]).map((entry) => [`${entry.pillar}/${entry.subPillar}`, entry])
    : [],
);

const entries: SeedEntry[] = [];

// ─── SEO (title-tags is already seeded by hand; schema is a bespoke page) ──
const seoSlugs = Object.keys(seoAnalyses).filter((slug) => slug !== 'title-tags' && slug !== 'schema');
for (const slug of seoSlugs) {
  const analysis = seoAnalyses[slug];
  if (analysis.totals.analyzed === 0) {
    const existing = existingEntries.get(`seo/${slug}`);
    if (!existing) throw new Error(`seo/${slug} is trimmed but has no existing JSON entry to preserve`);
    entries.push(existing);
    continue;
  }
  const affectedLabel = affectedLabelFrom(analysis.evidence.sampleNoun);
  const firstColumnKey = analysis.evidence.columns[0]?.key;
  entries.push(
    entryFromAnalysis('seo', slug, analysis, (finding) => ({
      title: finding.title,
      severity: finding.severity,
      affectedCount: finding.affected,
      affectedLabel,
      impact: finding.impact,
      scoreLift: SCORE_LIFT_BY_SEVERITY[finding.severity],
      resolutionType: null,
      problem: finding.whatIsWrong,
      why: finding.whyItMatters,
      recommendation: finding.recommendation,
      evidence: evidenceBullets(finding, analysis.evidence.rows, affectedLabel, firstColumnKey),
      details: { issueType: finding.issueType, effort: finding.effort },
    })),
  );
}

// ─── Generic pillars (content / speed / cro / ai-discovery) ───────────
for (const routeKey of Object.keys(genericCatalog)) {
  const config = genericCatalog[routeKey];
  const analysis = buildAnalysis(routeKey, config, detailCatalog[routeKey as keyof typeof detailCatalog]);
  const [pillar, subPillar] = [routeKey.slice(0, routeKey.indexOf('/')), routeKey.slice(routeKey.indexOf('/') + 1)];
  const rawById = new Map((findingsByPillar[config.pillar] ?? []).map((raw) => [raw.id, raw]));
  const firstColumnKey = analysis.evidence.columns[0]?.key;
  entries.push(
    entryFromAnalysis(pillar, subPillar, analysis, (finding) => {
      const raw = rawById.get(finding.id);
      if (!raw) throw new Error(`No raw finding for ${routeKey} / ${finding.id}`);
      return {
        title: finding.title,
        severity: finding.severity,
        affectedCount: raw.affected,
        affectedLabel: raw.affectedLabel,
        impact: finding.impact,
        scoreLift: raw.scoreLift,
        resolutionType: raw.resolution,
        problem: raw.problem,
        why: raw.impact,
        recommendation: raw.ctaLabel,
        evidence: evidenceBullets(finding, analysis.evidence.rows, raw.affectedLabel, firstColumnKey),
        details: { issueType: finding.issueType, effort: finding.effort },
      };
    }),
  );
}

writeFileSync(outPath, `${JSON.stringify({ entries }, null, 2)}\n`);
console.log(`[export-seed-data] wrote ${entries.length} sub-pillar entries (${entries.reduce((sum, entry) => sum + entry.findings.length, 0)} findings) to ${outPath}`);
