import { api } from '../lib/api';
import { getDefaultSubPillarSettings, type PageSettingValue } from './pageSettings.registry';

// Slugs may contain a pillar prefix ('speed/cwv') — encode so the whole slug
// stays one path segment for the /page-settings/:slug route.
const settingsPath = (slug: string) => `/page-settings/${encodeURIComponent(slug)}`;

/** Stored values merged over the registry defaults, so new fields always have a value. */
export async function fetchSubPillarSettings(slug: string): Promise<Record<string, PageSettingValue>> {
  const { values } = await api.get<{ slug: string; values: Record<string, PageSettingValue> }>(settingsPath(slug));
  return { ...getDefaultSubPillarSettings(slug), ...values };
}

export async function saveSubPillarSettings(slug: string, values: Record<string, PageSettingValue>): Promise<void> {
  await api.put(settingsPath(slug), { values });
}
