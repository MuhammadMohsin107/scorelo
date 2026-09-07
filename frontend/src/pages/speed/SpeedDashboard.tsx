import { AlertTriangle, Image as ImageIcon, Layers, MousePointerClick, Zap } from 'lucide-react';
import PillarDashboard from '../../components/pillars/PillarDashboard';

/**
 * /speed — the Speed pillar dashboard.
 *
 * Layout comes from components/pillars/PillarDashboard, shared by all five pillars; this file is
 * Speed's copy and nothing else. All numbers come from the audit the shared component fetches.
 */

/** Static copy per sub-pillar — descriptions are page text, never a measurement. */
const areaDescriptions: Record<string, string> = {
  cwv: 'Track LCP, INP, and CLS across every page against field-data thresholds.',
  'image-weight': 'Find oversized, unoptimized, and legacy-format images slowing your storefront.',
  'app-bloat': 'Audit third-party apps and scripts for blocking, heavy, or unused code.',
  'theme-weight': 'Trim theme payload, redundant fonts, and missing lazy-load coverage.',
};

export default function SpeedDashboard() {
  return (
    <PillarDashboard
      pillar="speed"
      title="Speed"
      icon={Zap}
      description="Improve your store's load times, Core Web Vitals, and page weight across every performance area."
      areaDescriptions={areaDescriptions}
      healthNote="Resolving critical issues first will have the largest impact on page experience and rankings."
      emptyDescription="Once an audit has measured your store, performance scores and prioritised issues for all 4 speed areas appear here."
      kpiIcons={{
        'Open Issues': { icon: AlertTriangle, accent: 'warning' },
        'Critical Issues': { icon: ImageIcon, accent: 'critical' },
        'High Priority': { icon: MousePointerClick, accent: 'warning' },
        'Areas Measured': { icon: Layers, accent: 'info' },
      }}
    />
  );
}
