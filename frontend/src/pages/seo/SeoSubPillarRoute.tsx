import { Navigate, useParams } from 'react-router-dom';
import { seoAnalyses } from '../../data/seo/analyses';
import SeoSubPillarPage from './SeoSubPillarPage';

/**
 * Resolves an SEO sub-pillar slug to its analysis and renders the shared
 * master template. Unknown slugs fall back to the SEO pillar dashboard.
 */
export default function SeoSubPillarRoute() {
  const { subPillar } = useParams<{ subPillar: string }>();
  const analysis = subPillar ? seoAnalyses[subPillar] : undefined;

  if (!analysis) return <Navigate to="/seo" replace />;

  // key forces a clean remount (and reload) when moving between sub-pillars.
  return <SeoSubPillarPage key={analysis.slug} analysis={analysis} />;
}
