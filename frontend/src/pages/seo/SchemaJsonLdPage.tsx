import { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  BookOpen, Building2, CheckCircle2, FileJson, Globe2, HelpCircle,
  Info, Layers3, Link2, List, Package, PlayCircle, RefreshCw, Search,
  Settings2, ShieldCheck, Star, ToggleLeft, Video, Copy, Check,
} from 'lucide-react';
import { schemaAnalysis } from '../../data/seo/analyses/schema';
import type { SubPillarFinding } from '../../data/seo/subpillar.model';
import ScoreCard from '../../components/seo/subpillar/ScoreCard';
import HealthCard from '../../components/seo/subpillar/HealthCard';
import PageSettingsPanel from '../../components/settings/PageSettingsPanel';
import {
  defaultSchemaPageSettings,
  schemaPageSettingsDefinition,
  type PageSettingValue,
} from '../../data/pageSettings.registry';
import { fetchSubPillarSettings, saveSubPillarSettings } from '../../data/pageSettings.repository';

type SchemaId = 'product' | 'productGroup' | 'offer' | 'aggregateRating' | 'article' | 'page' | 'collectionPage' | 'itemList' | 'website' | 'breadcrumb' | 'faq' | 'video' | 'localBusiness' | 'organization' | 'review';
type Icon = ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;

interface SchemaDefinition {
  id: SchemaId;
  name: string;
  description: string;
  icon: Icon;
  auto: boolean;
}

const definitions: SchemaDefinition[] = [
  { id: 'product', name: 'Product', description: 'Product, offer, and availability details for eligible pages.', icon: Package, auto: false },
  { id: 'productGroup', name: 'ProductGroup', description: 'Variant relationships for products with sizes, colours, or other options.', icon: Layers3, auto: false },
  { id: 'offer', name: 'Offer', description: 'Nested Product pricing, currency, availability, and shipping information.', icon: Package, auto: false },
  { id: 'aggregateRating', name: 'AggregateRating', description: 'Nested Product review summary from a genuine, visible review source.', icon: Star, auto: false },
  { id: 'organization', name: 'Organization', description: 'Brand identity, website, and support details for business schema.', icon: Building2, auto: true },
  { id: 'website', name: 'WebSite', description: 'Store-level identity and search-action information for the website.', icon: Globe2, auto: true },
  { id: 'article', name: 'Article / Blog Post', description: 'Editorial markup for article pages and blog content.', icon: BookOpen, auto: true },
  { id: 'page', name: 'Page', description: 'WebPage markup for important landing pages and merchant pages.', icon: Globe2, auto: true },
  { id: 'collectionPage', name: 'CollectionPage', description: 'Category and collection context for Shopify collection templates.', icon: List, auto: true },
  { id: 'itemList', name: 'ItemList', description: 'Ordered product listings inside collection and search result pages.', icon: List, auto: true },
  { id: 'breadcrumb', name: 'Breadcrumb', description: 'Navigation hierarchy and internal structure for supported pages.', icon: Link2, auto: true },
  { id: 'faq', name: 'FAQ', description: 'Question and answer blocks that are visible to shoppers.', icon: HelpCircle, auto: false },
  { id: 'video', name: 'Video', description: 'Video metadata with thumbnails, dates, and playback details.', icon: Video, auto: false },
  { id: 'localBusiness', name: 'Local Business', description: 'Store address, service information, and local business details.', icon: Building2, auto: false },
  { id: 'review', name: 'Product Reviews', description: 'Review schema when a verified review source is actually present.', icon: ShieldCheck, auto: false },
];

function buildJsonPreview(type: SchemaId) {
  const schemaType = type === 'productGroup' ? 'ProductGroup' : type === 'aggregateRating' ? 'AggregateRating' : type === 'collectionPage' ? 'CollectionPage' : type === 'itemList' ? 'ItemList' : type === 'website' ? 'WebSite' : type === 'offer' ? 'Offer' : type === 'article' ? 'Article' : type === 'faq' ? 'FAQPage' : type === 'breadcrumb' ? 'BreadcrumbList' : type === 'organization' ? 'Organization' : type === 'localBusiness' ? 'LocalBusiness' : type === 'video' ? 'VideoObject' : type === 'review' ? 'Review' : type === 'page' ? 'WebPage' : 'Product';
  const sample = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: 'Sample store object',
    url: 'https://www.example.com',
  };

  return JSON.stringify(sample, null, 2);
}

const previewRequirements: Record<SchemaId, string[]> = {
  product: ['name', 'url', 'offers'],
  productGroup: ['name', 'variesBy', 'hasVariant'],
  offer: ['price', 'priceCurrency', 'availability'],
  aggregateRating: ['ratingValue', 'reviewCount', 'itemReviewed'],
  article: ['headline', 'author', 'datePublished'],
  page: ['name', 'url', 'isPartOf'],
  collectionPage: ['name', 'url', 'mainEntity'],
  itemList: ['itemListElement', 'numberOfItems', 'url'],
  website: ['name', 'url', 'publisher'],
  breadcrumb: ['itemListElement', 'position', 'item'],
  faq: ['mainEntity', 'Question', 'acceptedAnswer'],
  video: ['name', 'thumbnailUrl', 'uploadDate'],
  localBusiness: ['name', 'address', 'openingHours'],
  organization: ['name', 'url', 'logo'],
  review: ['reviewRating', 'author', 'itemReviewed'],
};

export default function SchemaJsonLdPage() {
  const [pageSettings, setPageSettings] = useState<Record<string, PageSettingValue>>({ ...defaultSchemaPageSettings });
  // Last values loaded from / saved to the API — what "close without saving" reverts to.
  const savedSettingsRef = useRef<Record<string, PageSettingValue>>({ ...defaultSchemaPageSettings });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<SchemaId | null>(null);
  const [search, setSearch] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState('');
  const [copiedPreview, setCopiedPreview] = useState(false);

  useEffect(() => {
    let active = true;
    fetchSubPillarSettings('schema')
      .then((values) => { if (active) { savedSettingsRef.current = values; setPageSettings(values); } })
      .catch((error) => console.error('Failed to load page settings', error));
    return () => { active = false; };
  }, []);

  const updatePageSetting = (key: string, value: PageSettingValue) => {
    setPageSettings((current) => ({ ...current, [key]: value }));
  };

  const resetPageSettings = () => setPageSettings({ ...defaultSchemaPageSettings });

  const savePageSettings = () => {
    savedSettingsRef.current = pageSettings;
    saveSubPillarSettings('schema', pageSettings)
      .catch((error) => console.error('Failed to save page settings', error));
    setSettingsOpen(false);
  };

  const handleScan = () => {
    setIsScanning(true);
    setScanNotice('');
    window.setTimeout(() => {
      setIsScanning(false);
      setScanNotice('Schema re-scan preview complete. Connect a crawler to persist new findings.');
    }, 900);
  };

  const copyPreview = async () => {
    if (!selectedType || !navigator.clipboard) return;
    await navigator.clipboard.writeText(buildJsonPreview(selectedType));
    setCopiedPreview(true);
    window.setTimeout(() => setCopiedPreview(false), 1600);
  };

  const filteredFindings = schemaAnalysis.findings.filter((finding: SubPillarFinding) => {
    const haystack = `${finding.title} ${finding.whatIsWrong} ${finding.recommendation}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const selectedDefinition = selectedType
    ? definitions.find((definition) => definition.id === selectedType)
    : undefined;

  return (
    <div className="min-h-full bg-surface-50">
      <div className="mx-auto max-w-7xl px-5 pb-14 pt-6 md:px-8">
        <header className="mt-5 flex flex-col gap-5 border-b border-surface-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-surface-500">SEO</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-surface-950">Schema / JSON-LD</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-surface-600">
              Manage structured data for the store, preview generated markup, and keep the client settings scoped to this page only.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setSettingsOpen(true)} className="btn-secondary">
              <Settings2 size={14} />
              Client settings
            </button>
            <button type="button" onClick={handleScan} disabled={isScanning} className="btn-primary">
              <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
              {isScanning ? 'Scanning...' : 'Re-analyze'}
            </button>
          </div>
        </header>

        {scanNotice && (
          <div className="mt-4 rounded-lg border border-success-100 bg-success-50 px-3 py-2 text-xs text-success-700">
            <CheckCircle2 size={14} className="mr-2 inline" />
            {scanNotice}
          </div>
        )}

        <section className="mt-6" aria-labelledby="crawl-health-title">
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">Latest crawl evidence</p>
            <h2 id="crawl-health-title" className="mt-1 text-xl font-semibold text-surface-950">Structured data health</h2>
          </div>
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 xl:col-span-7">
              <ScoreCard totals={schemaAnalysis.totals} summary={schemaAnalysis.summary} healthChip={schemaAnalysis.healthChip} />
            </div>
            <div className="col-span-12 xl:col-span-5">
              <HealthCard totals={schemaAnalysis.totals} findings={schemaAnalysis.findings} onSelectIssue={() => undefined} />
            </div>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="schema-types-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">Management</p>
              <h2 id="schema-types-title" className="mt-1 text-xl font-semibold text-surface-950">Schema types</h2>
            </div>
            <span className="inline-flex items-center gap-2 text-xs text-surface-500">
              <ToggleLeft size={15} className="text-brand-600" />
              Saved in this browser
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {definitions.map((definition) => {
              const Icon = definition.icon;
              const active = selectedType === definition.id;

              return (
                <article key={definition.id} className={`flex min-h-[210px] flex-col rounded-xl border p-5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:border-surface-300 hover:bg-surface-50 hover:shadow-[0_14px_30px_-20px_rgba(15,23,42,0.55)] ${active ? 'border-brand-200 bg-brand-50/40' : 'border-surface-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                        <Icon size={17} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-surface-900">{definition.name}</h3>
                        <p className="mt-0.5 text-[11px] text-surface-400">
                          {definition.auto ? 'Uses available store data' : 'Guided configuration'}
                        </p>
                      </div>
                    </div>
                    <button type="button" className="rounded p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-700" aria-label={`About ${definition.name}`} title={definition.description}>
                      <Info size={15} />
                    </button>
                  </div>

                  <p className="mt-4 min-h-10 text-xs leading-5 text-surface-600">{definition.description}</p>

                  <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                    <button type="button" onClick={() => { setSelectedType(null); setSettingsOpen(true); }} className="btn-secondary h-9 px-3 text-xs">
                      Set up
                    </button>
                    <button type="button" onClick={() => setSelectedType(definition.id)} className="btn-ghost h-9 px-2 text-xs">
                      <PlayCircle size={14} />
                      Preview
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-8 rounded-xl border border-surface-200 bg-white shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-200 px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">Inspection</p>
              <h2 className="mt-1 text-lg font-semibold text-surface-950">Issue review</h2>
            </div>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-[220px] rounded-lg border border-surface-200 bg-surface-50 py-2 pl-9 pr-3 text-xs text-surface-800 placeholder:text-surface-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                placeholder="Search issue details"
                aria-label="Search issue details"
              />
            </div>
          </div>

          <div className="divide-y divide-surface-100">
            {filteredFindings.length > 0 ? (
              filteredFindings.map((finding) => (
                <div key={finding.id} className="flex items-start gap-3 px-5 py-4">
                  <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${finding.severity === 'critical' ? 'bg-critical-500' : finding.severity === 'high' ? 'bg-warning-500' : 'bg-surface-400'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-surface-900">{finding.title}</h3>
                      <span className="rounded-full border border-surface-200 bg-surface-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-surface-500">
                        {finding.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-surface-600">{finding.whatIsWrong}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center text-sm text-surface-500">No issues match the current search.</div>
            )}
          </div>
        </section>

        {selectedDefinition && selectedType && (
          <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
            <button type="button" className="absolute inset-0 bg-surface-950/25" onClick={() => setSelectedType(null)} aria-label="Close schema preview" />
            <aside role="dialog" aria-modal="true" aria-labelledby="schema-preview-title" className="relative flex h-full w-full max-w-2xl flex-col border-l border-surface-200 bg-white shadow-2xl">
              <header className="flex items-start justify-between gap-4 border-b border-surface-200 px-5 py-5 sm:px-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">Schema preview</p>
                  <h2 id="schema-preview-title" className="mt-1 text-xl font-semibold text-surface-950">{selectedDefinition.name}</h2>
                </div>
                <button type="button" onClick={() => setSelectedType(null)} className="btn-ghost h-9 w-9 p-0" aria-label="Close schema preview">
                  ×
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-surface-700">
                      <FileJson size={14} className="text-brand-600" />
                      Generated JSON-LD
                    </span>
                    <button type="button" onClick={copyPreview} className="btn-ghost h-8 px-2 text-xs" title="Copy JSON-LD">
                      {copiedPreview ? <Check size={13} /> : <Copy size={13} />}
                      {copiedPreview ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="mt-4 overflow-auto rounded-lg bg-surface-950 p-4 font-mono text-xs leading-6 text-surface-100">
                    <code>{buildJsonPreview(selectedDefinition.id)}</code>
                  </pre>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-surface-200 bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-surface-500">Preview status</p>
                    <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-success-700">
                      <CheckCircle2 size={15} />
                      Structure looks valid
                    </div>
                    <p className="mt-1 text-xs leading-5 text-surface-500">Preview only. Nothing is published to the storefront.</p>
                  </div>
                  <div className="rounded-xl border border-surface-200 bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-surface-500">Data mode</p>
                    <p className="mt-2 text-sm font-semibold text-surface-900">{selectedDefinition.auto ? 'Store data detected' : 'Guided configuration'}</p>
                    <p className="mt-1 text-xs leading-5 text-surface-500">Values shown are based on the current preview model.</p>
                  </div>
                </div>

                <section className="mt-4 rounded-xl border border-surface-200 bg-white p-4" aria-labelledby="preview-properties-title">
                  <div className="flex items-center justify-between gap-3">
                    <h3 id="preview-properties-title" className="text-sm font-semibold text-surface-900">Recommended properties</h3>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-surface-400">{previewRequirements[selectedType].length} checks</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {previewRequirements[selectedType].map((property) => (
                      <span key={property} className="inline-flex items-center gap-1.5 rounded-full border border-success-100 bg-success-50 px-2.5 py-1 text-[11px] font-medium text-success-700">
                        <CheckCircle2 size={12} />
                        {property}
                      </span>
                    ))}
                  </div>
                </section>
              </div>

              <footer className="flex items-center justify-between gap-3 border-t border-surface-200 bg-surface-50 px-5 py-4 sm:px-6">
                <button type="button" onClick={() => setSelectedType(null)} className="btn-secondary text-xs">Close</button>
                <button type="button" onClick={() => { setSelectedType(null); setSettingsOpen(true); }} className="btn-primary text-xs">
                  Open client settings
                </button>
              </footer>
            </aside>
          </div>
        )}

        <PageSettingsPanel
          open={settingsOpen}
          definition={schemaPageSettingsDefinition}
          values={pageSettings}
          onClose={() => { setSettingsOpen(false); setPageSettings(savedSettingsRef.current); }}
          onChange={updatePageSetting}
          onReset={resetPageSettings}
          onSave={savePageSettings}
        />
      </div>
    </div>
  );
}
