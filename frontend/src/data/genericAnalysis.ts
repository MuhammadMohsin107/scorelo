// ─── Generic sub-pillar analysis builder ─────────────────────────────
// Converts a GenericSubPillarConfig + detail table + the pillar's raw
// findings into the shared SubPillarAnalysis contract. Moved out of
// NonSeoSubPillarPage so the seed-data export script (a node script,
// no React) can reuse exactly the same conversion the page performs.

import type { CellValue, EvidenceConfig, EvidenceRow, SubPillarAnalysis, SubPillarFinding } from './seo/subpillar.model';
import type { GenericSubPillarConfig, GenericSubPillarDetails, GenericTableColumn, GenericTableRow, TableCellValue } from '../pages/pillarCatalogs/genericTypes';
import type { Finding } from './pillars/finding.types';
import { findings as contentFindings } from './content/content.mock';
import { findings as speedFindings } from './speed/speed.mock';
import { findings as croFindings } from './cro/cro.mock';
import { findings as aiFindings } from './ai-discovery/ai-discovery.mock';

export const findingsByPillar: Record<string, Finding[]> = {
  content: contentFindings,
  speed: speedFindings,
  cro: croFindings,
  'ai-discovery': aiFindings,
};

const severityFor: Record<string, SubPillarFinding['severity']> = { critical: 'critical', high: 'high', medium: 'medium', low: 'low' };

function genericColumnToEvidence(column: GenericTableColumn): EvidenceConfig['columns'][number] {
  const variant = column.variant === 'mono' ? 'mono' : column.variant === 'muted' ? 'muted' : column.variant === 'number' ? 'number' : column.variant === 'status' ? 'status' : 'text';
  return { key: column.key, header: column.header, align: column.align, variant };
}

// Evidence cells don't render a bool icon variant (see genericColumnToEvidence's 'text' fallback for 'bool' columns),
// so booleans are normalized to the same Yes/No wording used by the generic table's check/dash icon labels.
function normalizeCellValue(value: TableCellValue): CellValue {
  return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
}

function normalizeCells(cells: Record<string, TableCellValue>): Record<string, CellValue> {
  return Object.fromEntries(
    Object.entries(cells).map(([key, value]): [string, CellValue] => [key, normalizeCellValue(value)]),
  );
}

function buildFallbackEvidence(config: GenericSubPillarConfig, findings: SubPillarFinding[]): EvidenceConfig {
  const rows: EvidenceRow[] = findings.map((finding, index) => ({ id: finding.id, status: finding.issueType, cells: { item: `${config.key}-sample-${index + 1}`, issue: finding.title, affected: finding.affected }, current: { label: 'Detected', value: finding.title, meta: `${finding.affected.toLocaleString()} affected` }, suggested: { label: 'Recommendation', value: finding.recommendation } }));
  return { title: `${config.title} Evidence`, caption: `Evidence sampled from the latest ${config.title} analysis`, searchPlaceholder: 'Search evidence…', searchKeys: ['item', 'issue'], columns: [{ key: 'item', header: 'Resource', variant: 'mono' }, { key: 'issue', header: 'Finding', variant: 'text' }, { key: 'affected', header: 'Affected', variant: 'number', align: 'right' }, { key: 'status', header: 'Issue', variant: 'status' }, { key: 'action', header: 'Action', variant: 'action', align: 'right' }], rows, sorts: [], sampleNoun: config.analyzedLabel.toLowerCase() };
}

export function buildAnalysis(routeKey: string, config: GenericSubPillarConfig, details?: GenericSubPillarDetails): SubPillarAnalysis {
  const sourceFindings = findingsByPillar[config.pillar as keyof typeof findingsByPillar] ?? [];
  const findings: SubPillarFinding[] = sourceFindings.filter((finding) => finding.areaKey === config.key).map((finding) => ({ id: finding.id, issueType: finding.title, title: finding.title, severity: severityFor[finding.severity], affected: finding.affected, impact: finding.scoreLift >= 3 ? 'High' : finding.scoreLift >= 2 ? 'Medium' : 'Low', effort: finding.resolution === 'Automated' ? 'Low' : 'Medium', whatIsWrong: finding.problem, whyItMatters: finding.impact, recommendation: finding.ctaLabel }));
  const table = details?.table;
  const evidence: EvidenceConfig = table ? { title: table.title, caption: table.subtitle, searchPlaceholder: table.searchPlaceholder, searchKeys: table.searchKeys ?? table.columns.map((column) => column.key), columns: [...table.columns.map(genericColumnToEvidence), { key: 'action', header: 'Action', variant: 'action', align: 'right' }], rows: table.rows.map((row: GenericTableRow) => ({ id: row.id, status: row.status, facet: row.status, cells: normalizeCells(row.cells), current: { label: 'Detected', value: String(row.cells[table.columns[0]?.key] ?? row.id), meta: String(row.cells[table.columns[1]?.key] ?? '') }, suggested: { label: 'Recommendation', value: String(row.cells.recommendation ?? row.cells[table.columns[table.columns.length - 1]?.key] ?? 'Review this item') } })), sorts: [], sampleNoun: config.analyzedLabel.toLowerCase() } : buildFallbackEvidence(config, findings);
  const issues = findings.reduce((sum, finding) => sum + finding.affected, 0);
  const critical = findings.filter((finding) => finding.severity === 'critical').reduce((sum, finding) => sum + finding.affected, 0);
  return { slug: routeKey, title: config.title, description: config.description, supportsBulkFix: true, bulkFixMode: 'generic', summary: `${config.healthy.toLocaleString()} of ${config.analyzed.toLocaleString()} ${config.analyzedLabel.toLowerCase()} meet the current ${config.title.toLowerCase()} standard.`, healthChip: `${config.analyzed > 0 ? ((config.healthy / config.analyzed) * 100).toFixed(1) : '0.0'}% healthy`, totals: { score: config.score, analyzed: config.analyzed, healthy: config.healthy, issues: Math.max(issues, config.analyzed - config.healthy), critical, analyzedLabel: config.analyzedLabel, healthyLabel: 'Healthy', issuesLabel: 'Issues', criticalLabel: 'Critical', contextLabel: config.metrics[0]?.label ?? 'Current standard', contextValue: String(config.metrics[0]?.value ?? 'Available') }, findings, evidence, relatedAreas: [], lastAnalyzed: 'Today, 10:42 AM' };
}
