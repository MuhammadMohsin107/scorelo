import { AlertOctagon, FileSearch, Lightbulb, Sparkles } from 'lucide-react';
import PillarDashboard from '../../components/pillars/PillarDashboard';

/**
 * /ai-discovery — the AI Discovery pillar dashboard.
 *
 * Layout comes from components/pillars/PillarDashboard, shared by all five pillars; this file is
 * AI Discovery's copy and nothing else. All numbers come from the audit the shared component
 * fetches.
 */

/** Static copy per sub-pillar — descriptions are page text, never a measurement. */
const areaDescriptions: Record<string, string> = {
  'agents-md': 'Track AI-crawler access, agents.md and llms.txt file presence, and directive coverage.',
  'agentic-attrs': 'Ensure price, availability, identifier, and purchase-action signals are agent-readable.',
  'answerable-qa': 'Provide genuine, product-specific answers and FAQ schema for AI assistants.',
  feed: 'Keep product feed attributes complete so AI shopping agents can list and compare products.',
};

export default function AiDiscoveryDashboard() {
  return (
    <PillarDashboard
      pillar="ai-discovery"
      title="AI Discovery"
      icon={Sparkles}
      description="Make your catalog readable, quotable, and purchasable for AI assistants and shopping agents."
      areaDescriptions={areaDescriptions}
      healthNote="Resolving critical crawler-access and attribute gaps first will have the largest impact on AI visibility."
      emptyDescription="Once an audit has measured your store, AI-readiness scores and prioritised issues for all 4 AI discovery areas appear here."
      kpiIcons={{
        'Open Issues': { icon: Lightbulb, accent: 'warning' },
        'Critical Issues': { icon: AlertOctagon, accent: 'critical' },
        'High Priority': { icon: Sparkles, accent: 'warning' },
        'Areas Measured': { icon: FileSearch, accent: 'info' },
      }}
    />
  );
}
