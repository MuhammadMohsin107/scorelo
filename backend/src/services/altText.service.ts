import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { pageSettings } from '../db/schema.js';
import { insertReturning, updateReturning } from '../db/returning.js';
import { ApiError } from '../middleware/error.js';
import { getCurrentStoreId } from './store.service.js';
import { resolveShopifyClient } from '../audit-engine/store-data/index.js';
import { StoreDataError } from '../audit-engine/store-data/types.js';
import type { ShopifyClient } from '../audit-engine/store-data/shopify-client.js';
import {
  ALT_TEXT_CONTENT_TYPES,
  DEFAULT_ALT_TEXT_CONFIG,
  generateAltText,
  isAltTextContentType,
  isAutoFormat,
  validateTypeConfig,
  type AltTextConfig,
  type AltTextContentType,
  type AltTextTypeConfig,
  type TemplateIssue,
} from '../lib/alt-text/template.js';

/**
 * ─── Image alt-text template configuration ───────────────────────────
 *
 * Persistence reuses `page_settings` — the same store-scoped JSON store every other sub-pillar
 * settings panel writes to — under its OWN slug. A separate slug rather than extra keys inside
 * `image-alt-text`, because that slug is owned by the sub-pillar settings drawer, whose save
 * REPLACES the whole `values` object; sharing it would mean either panel silently wiping the
 * other's configuration.
 *
 * No new table, no new migration: the requirement is a per-store JSON document keyed by a slug,
 * which is precisely what this table already is.
 *
 * SAVING NEVER TOUCHES SHOPIFY. Nothing in this file mutates a store; the Shopify calls here are
 * `products`/`articles` reads used to build a preview from the merchant's real catalogue.
 */

export const ALT_TEXT_SETTINGS_SLUG = 'image-alt-text.template';

/** Products read for a preview. Small on purpose: this runs while the merchant types. */
const PREVIEW_SAMPLE_SIZE = 5;

export interface AltTextConfigResponse {
  config: AltTextConfig;
  /** True when the store has no saved configuration yet and these are the defaults. */
  isDefault: boolean;
  updatedAt: string | null;
}

function coerceTypeConfig(raw: unknown, fallback: AltTextTypeConfig): AltTextTypeConfig {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const value = raw as Record<string, unknown>;
  return {
    template: typeof value.template === 'string' ? value.template : fallback.template,
    characterLimit: Number.isInteger(value.characterLimit) ? (value.characterLimit as number) : fallback.characterLimit,
    autoFormat: isAutoFormat(value.autoFormat) ? value.autoFormat : fallback.autoFormat,
    skipExisting: typeof value.skipExisting === 'boolean' ? value.skipExisting : fallback.skipExisting,
    removeDuplicateWords: typeof value.removeDuplicateWords === 'boolean' ? value.removeDuplicateWords : fallback.removeDuplicateWords,
    autoGenerate: typeof value.autoGenerate === 'boolean' ? value.autoGenerate : fallback.autoGenerate,
  };
}

/** Stored JSON merged over the defaults, so a config written before a field existed still loads. */
function coerceConfig(raw: unknown): AltTextConfig {
  const stored = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    products: coerceTypeConfig(stored.products, DEFAULT_ALT_TEXT_CONFIG.products),
    articles: coerceTypeConfig(stored.articles, DEFAULT_ALT_TEXT_CONFIG.articles),
  };
}

export async function getAltTextConfig(userId: number, storeId?: number): Promise<AltTextConfigResponse> {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);

  const [row] = await db
    .select()
    .from(pageSettings)
    .where(and(eq(pageSettings.storeId, resolvedStoreId), eq(pageSettings.slug, ALT_TEXT_SETTINGS_SLUG)))
    .limit(1);

  if (!row) return { config: DEFAULT_ALT_TEXT_CONFIG, isDefault: true, updatedAt: null };

  return {
    config: coerceConfig(row.values),
    isDefault: false,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export interface AltTextValidationError {
  contentType: AltTextContentType;
  issues: TemplateIssue[];
}

/** Server-side validation. The browser validates too, for immediacy — but this is the boundary. */
function validateConfig(config: AltTextConfig): AltTextValidationError[] {
  const errors: AltTextValidationError[] = [];
  for (const contentType of ALT_TEXT_CONTENT_TYPES) {
    const issues = validateTypeConfig(contentType, config[contentType]);
    if (issues.length > 0) errors.push({ contentType, issues });
  }
  return errors;
}

/**
 * Saves the whole configuration.
 *
 * Every content type is written together and each one is validated, so a valid Products template
 * can never be persisted alongside an Articles template that would fail — and changing one content
 * type leaves the others exactly as they were, because the caller sends the merged document it
 * loaded.
 */
export async function saveAltTextConfig(userId: number, raw: unknown, storeId?: number): Promise<AltTextConfigResponse> {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const config = coerceConfig(raw);

  const errors = validateConfig(config);
  if (errors.length > 0) {
    throw new ApiError(
      422,
      errors[0]!.issues[0]!.message,
      'ALT_TEXT_CONFIG_INVALID',
    );
  }

  const [existing] = await db
    .select({ id: pageSettings.id })
    .from(pageSettings)
    .where(and(eq(pageSettings.storeId, resolvedStoreId), eq(pageSettings.slug, ALT_TEXT_SETTINGS_SLUG)))
    .limit(1);

  const updatedAt = new Date();

  if (existing) {
    const [updated] = await updateReturning(
      pageSettings,
      { values: config, updatedAt },
      and(eq(pageSettings.storeId, resolvedStoreId), eq(pageSettings.slug, ALT_TEXT_SETTINGS_SLUG)),
    );
    if (!updated) throw new ApiError(500, 'Unable to save alt-text settings', 'ALT_TEXT_CONFIG_SAVE_FAILED');
    return { config: coerceConfig(updated.values), isDefault: false, updatedAt: updatedAt.toISOString() };
  }

  const created = await insertReturning(pageSettings, {
    storeId: resolvedStoreId,
    slug: ALT_TEXT_SETTINGS_SLUG,
    values: config,
    updatedAt,
  });
  if (!created) throw new ApiError(500, 'Unable to save alt-text settings', 'ALT_TEXT_CONFIG_SAVE_FAILED');

  return { config: coerceConfig(created.values), isDefault: false, updatedAt: updatedAt.toISOString() };
}

// ─── Preview against the merchant's real catalogue ───────────────────

/**
 * Narrow preview queries.
 *
 * Deliberately NOT the audit snapshot: that reads the whole catalogue with 20 media and 25
 * metafields per product, which is right for an audit and absurd for a preview the merchant
 * triggers while typing. These select only the fields the placeholders resolve, for five records.
 */
const PREVIEW_PRODUCTS_QUERY = `
  query ScoreloAltTextPreviewProducts($first: Int!) {
    shop { name }
    products(first: $first, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        title
        productType
        vendor
        media(first: 1) {
          nodes {
            ... on MediaImage {
              alt
              image { url }
            }
          }
        }
      }
    }
  }
`;

const PREVIEW_ARTICLES_QUERY = `
  query ScoreloAltTextPreviewArticles($first: Int!) {
    shop { name }
    articles(first: $first, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        title
        image { url altText }
        blog { title }
      }
    }
  }
`;

export interface AltTextPreviewRow {
  /** The resource's own name, for the merchant to recognise it by. */
  resourceTitle: string;
  /** Real image URL when the resource has one, so the row can show what is being described. */
  imageUrl: string | null;
  /** The image's real current alt text. null = attribute absent; '' = present but empty. */
  currentAlt: string | null;
  generated: string;
  skipped: boolean;
  truncated: boolean;
  characters: number;
}

export interface AltTextPreviewResponse {
  contentType: AltTextContentType;
  rows: AltTextPreviewRow[];
  /** Non-fatal reason there is nothing to show, for the UI to render honestly. */
  emptyReason: 'none' | 'not_connected' | 'no_records' | 'no_images' | null;
  shopName: string | null;
}

interface PreviewProductNode {
  title?: string | null;
  productType?: string | null;
  vendor?: string | null;
  media?: { nodes?: Array<{ alt?: string | null; image?: { url?: string | null } | null }> } | null;
}

interface PreviewArticleNode {
  title?: string | null;
  image?: { url?: string | null; altText?: string | null } | null;
  blog?: { title?: string | null } | null;
}

function previewError(error: unknown): never {
  if (error instanceof StoreDataError) {
    if (error.code === 'NOT_CONNECTED') {
      throw new ApiError(409, 'Connect your Shopify store to preview generated alt text.', 'STORE_NOT_CONNECTED');
    }
    if (error.code === 'TOKEN_REVOKED') {
      throw new ApiError(409, 'Shopify authorization has expired. Reconnect your store to continue.', 'SHOPIFY_REAUTH_REQUIRED');
    }
    if (error.code === 'MISSING_SCOPES') {
      throw new ApiError(403, 'Scorelo is missing the Shopify permission needed to read this data.', 'SHOPIFY_MISSING_SCOPES');
    }
    throw new ApiError(502, 'Shopify could not be reached for the preview. Try again shortly.', 'SHOPIFY_UNAVAILABLE');
  }
  throw error;
}

/**
 * Generates a preview from the store's own most-recently-updated records.
 *
 * The configuration is validated first, so the merchant is never shown output from a template that
 * could not be saved. Nothing here is fabricated: if the store has no products, the response says
 * so rather than substituting an example.
 */
export async function previewAltText(
  userId: number,
  contentType: unknown,
  rawConfig: unknown,
  storeId?: number,
): Promise<AltTextPreviewResponse> {
  if (!isAltTextContentType(contentType)) {
    throw new ApiError(400, 'Unsupported content type', 'ALT_TEXT_CONTENT_TYPE_UNSUPPORTED');
  }

  const config = coerceTypeConfig(rawConfig, DEFAULT_ALT_TEXT_CONFIG[contentType]);
  const issues = validateTypeConfig(contentType, config).filter((issue) => issue.field !== 'autoGenerate');
  if (issues.length > 0) {
    throw new ApiError(422, issues[0]!.message, 'ALT_TEXT_CONFIG_INVALID');
  }

  const resolvedStoreId = await getCurrentStoreId(userId, storeId);

  let client: ShopifyClient;
  try {
    client = await resolveShopifyClient(resolvedStoreId);
  } catch (error) {
    if (error instanceof StoreDataError && error.code === 'NOT_CONNECTED') {
      return { contentType, rows: [], emptyReason: 'not_connected', shopName: null };
    }
    return previewError(error);
  }

  try {
    if (contentType === 'products') {
      const data = await client.graphql<{ shop?: { name?: string | null } | null; products?: { nodes?: PreviewProductNode[] } | null }>(
        PREVIEW_PRODUCTS_QUERY,
        { first: PREVIEW_SAMPLE_SIZE },
      );
      const shopName = data.shop?.name?.trim() || null;
      const nodes = data.products?.nodes ?? [];
      if (nodes.length === 0) return { contentType, rows: [], emptyReason: 'no_records', shopName };

      const rows: AltTextPreviewRow[] = [];
      for (const node of nodes) {
        const media = node.media?.nodes?.[0];
        // A product with no image has no alt text to write, so it is not a useful preview row.
        if (!media) continue;
        const currentAlt = media.alt ?? null;
        const generated = generateAltText(
          config.template,
          {
            product_title: node.title ?? null,
            product_type: node.productType ?? null,
            vendor: node.vendor ?? null,
            shop_name: shopName,
            image_position: 1,
          },
          config,
          currentAlt,
        );
        rows.push({
          resourceTitle: node.title?.trim() || 'Untitled product',
          imageUrl: media.image?.url ?? null,
          currentAlt,
          generated: generated.value,
          skipped: generated.skipped,
          truncated: generated.truncated,
          characters: generated.value.length,
        });
      }

      return {
        contentType,
        rows,
        emptyReason: rows.length === 0 ? 'no_images' : null,
        shopName,
      };
    }

    const data = await client.graphql<{ shop?: { name?: string | null } | null; articles?: { nodes?: PreviewArticleNode[] } | null }>(
      PREVIEW_ARTICLES_QUERY,
      { first: PREVIEW_SAMPLE_SIZE },
    );
    const shopName = data.shop?.name?.trim() || null;
    const nodes = data.articles?.nodes ?? [];
    if (nodes.length === 0) return { contentType, rows: [], emptyReason: 'no_records', shopName };

    const rows: AltTextPreviewRow[] = [];
    for (const node of nodes) {
      if (!node.image) continue;
      const currentAlt = node.image.altText ?? null;
      const generated = generateAltText(
        config.template,
        {
          article_title: node.title ?? null,
          blog_title: node.blog?.title ?? null,
          shop_name: shopName,
        },
        config,
        currentAlt,
      );
      rows.push({
        resourceTitle: node.title?.trim() || 'Untitled article',
        imageUrl: node.image.url ?? null,
        currentAlt,
        generated: generated.value,
        skipped: generated.skipped,
        truncated: generated.truncated,
        characters: generated.value.length,
      });
    }

    return { contentType, rows, emptyReason: rows.length === 0 ? 'no_images' : null, shopName };
  } catch (error) {
    return previewError(error);
  }
}
