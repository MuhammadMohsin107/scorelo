import { useMemo, useState } from 'react';
import { Check, Cloud, Database, Link2, RefreshCw, Settings2, ShieldCheck, Unplug } from 'lucide-react';
import { integrationRecords } from '../data/workflows.mock';
import { Button, Drawer, MetricTile, ModuleHeader, SectionHeading, StatusBadge } from '../components/workflows/WorkflowPrimitives';

type IntegrationRecord = (typeof integrationRecords)[number];
type IntegrationStatus = IntegrationRecord['status'];

const statusTone: Record<IntegrationStatus, 'success' | 'warning' | 'neutral'> = { Connected: 'success', 'Needs Attention': 'warning', 'Not Connected': 'neutral' };
const iconMap: Record<string, typeof Cloud> = { Store: Database, Analytics: Cloud, Performance: ShieldCheck, 'AI / Discovery': Link2 };

export default function Integrations() {
  const [records, setRecords] = useState(integrationRecords);
  const [selected, setSelected] = useState<IntegrationRecord | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const groups = useMemo(() => [...new Set(records.map((record) => record.group))], [records]);
  const connected = records.filter((record) => record.status === 'Connected').length;
  const attention = records.filter((record) => record.status === 'Needs Attention').length;
  const sync = (record: IntegrationRecord) => {
    setSyncingId(record.id);
    window.setTimeout(() => setSyncingId(null), 900);
  };
  const connect = (record: IntegrationRecord) => {
    setRecords((current) => current.map((item) => item.id === record.id ? { ...item, status: 'Connected', lastSynced: 'Just now', notice: undefined } : item));
    setSelected({ ...record, status: 'Connected', lastSynced: 'Just now', notice: undefined });
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 p-5 pb-16 md:p-8">
      <ModuleHeader eyebrow="Data connections" title="Integrations" description="Connect your data sources to give Scorelo the information it needs to analyze your store." actions={<Button onClick={() => setIsAdding(true)}><Link2 size={15} />Add integration</Button>} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Integration summary"><MetricTile label="Connected" value={connected} detail="Data sources active" tone="success" /><MetricTile label="Needs attention" value={attention} detail="Action recommended" tone="warning" /><MetricTile label="Available" value={records.length} detail="Supported sources" /><MetricTile label="Last sync" value="10:42 AM" detail="Today, Aug 19, 2026" tone="info" /></section>

      <section className="rounded-xl border border-surface-200 bg-white p-5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] sm:p-6"><div className="flex items-start gap-3 rounded-lg border border-info-100 bg-info-50 p-4"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-info-700" /><div><p className="text-sm font-bold text-info-900">Your data stays in context</p><p className="mt-1 text-xs leading-5 text-info-700">Connections make audit signals more complete. Review permissions and sync status before relying on new data.</p></div></div></section>

      {groups.map((group) => { const GroupIcon = iconMap[group] ?? Database; return <section key={group} className="space-y-4" aria-labelledby={`${group}-integrations`}><SectionHeading eyebrow="Connection group" title={group} description={group === 'Analytics' ? 'Traffic and behavioral evidence for analysis and decision-making.' : undefined} /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{records.filter((record) => record.group === group).map((record) => <article key={record.id} className="group rounded-xl border border-surface-200 bg-white p-5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_14px_30px_-20px_rgba(79,70,229,0.35)]"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-100 text-surface-700"><GroupIcon size={19} /></div><StatusBadge label={record.status} tone={statusTone[record.status]} /></div><h3 className="mt-5 text-base font-bold text-surface-950">{record.name}</h3><p className="mt-1 min-h-10 text-sm leading-5 text-surface-500">{record.description}</p>{record.notice && <p className="mt-4 rounded-lg bg-warning-50 px-3 py-2 text-xs font-medium leading-5 text-warning-700">{record.notice}</p>}<div className="mt-5 border-t border-surface-100 pt-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">{record.status === 'Connected' ? 'Last synced' : 'Connection'}</p><p className="mt-1 text-sm font-semibold text-surface-800">{record.status === 'Connected' ? record.lastSynced : record.detail}</p><div className="mt-3 flex flex-wrap gap-1.5">{record.data.slice(0, 2).map((item) => <span key={item} className="rounded-md bg-surface-100 px-2 py-1 text-[11px] text-surface-600">{item}</span>)}</div></div><div className="mt-5 flex items-center gap-2"><Button variant={record.status === 'Not Connected' ? 'primary' : 'secondary'} onClick={() => setSelected(record)}>{record.status === 'Not Connected' ? 'Connect' : record.status === 'Needs Attention' ? 'Reconnect' : 'Manage'} <Settings2 size={14} /></Button>{record.status === 'Connected' && <Button variant="ghost" onClick={() => sync(record)} disabled={syncingId === record.id}><RefreshCw size={14} className={syncingId === record.id ? 'animate-spin' : ''} />{syncingId === record.id ? 'Syncing' : 'Sync now'}</Button>}</div></article>)}</div></section>; })}

      <Drawer open={Boolean(selected)} title={selected?.name ?? ''} eyebrow="Integration detail" onClose={() => setSelected(null)}>{selected && <div className="space-y-6"><div className="flex flex-wrap gap-2"><StatusBadge label={selected.status} tone={statusTone[selected.status]} /><StatusBadge label={selected.group} tone="neutral" /></div><div className="rounded-xl border border-surface-200 bg-surface-50 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">Account / store</p><p className="mt-1 text-sm font-bold text-surface-900">{selected.detail}</p><p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">Last sync</p><p className="mt-1 text-sm text-surface-700">{selected.lastSynced}</p></div><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">Data received</p><ul className="mt-3 space-y-2">{selected.data.map((item) => <li key={item} className="flex gap-2 text-sm text-surface-700"><Check size={15} className="mt-0.5 text-success-600" />{item}</li>)}</ul></div><div className="flex flex-wrap gap-2">{selected.status !== 'Connected' ? <Button onClick={() => connect(selected)}><Link2 size={15} />{selected.status === 'Needs Attention' ? 'Reconnect' : 'Connect'}</Button> : <Button onClick={() => sync(selected)}><RefreshCw size={15} />Sync now</Button>}<Button variant="danger" onClick={() => setSelected(null)}><Unplug size={15} />Disconnect</Button></div><p className="text-xs leading-5 text-surface-500">Connection changes are represented in this workspace. Provider authorization remains managed by the source platform.</p></div>}</Drawer>

      <Drawer open={isAdding} title="Add an integration" eyebrow="Available data sources" onClose={() => setIsAdding(false)}><div className="space-y-4">{records.filter((record) => record.status === 'Not Connected').map((record) => <button key={record.id} onClick={() => { setIsAdding(false); setSelected(record); }} className="flex w-full items-center gap-3 rounded-xl border border-surface-200 p-4 text-left transition hover:border-brand-200 hover:bg-brand-50"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100"><Cloud size={18} /></div><div className="flex-1"><p className="text-sm font-bold text-surface-900">{record.name}</p><p className="mt-1 text-xs text-surface-500">{record.description}</p></div><ChevronRightIcon /></button>)}<div className="rounded-lg bg-surface-50 p-4 text-xs leading-5 text-surface-500">More providers can be added when their connector is available in Scorelo.</div></div></Drawer>
    </div>
  );
}

function ChevronRightIcon() { return <span aria-hidden="true" className="text-surface-400">&#8250;</span>; }
