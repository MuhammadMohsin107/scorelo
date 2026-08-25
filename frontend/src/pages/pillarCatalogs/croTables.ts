import type { GenericSubPillarDetails } from './genericTypes';

const good = 'bg-success-100 text-success-700';
const warn = 'bg-warning-100 text-warning-700';
const bad = 'bg-critical-100 text-critical-700';

const makeDetails = (
  title: string,
  subtitle: string,
  searchPlaceholder: string,
  rows: GenericSubPillarDetails['table']['rows'],
  opportunities: GenericSubPillarDetails['opportunities'],
): GenericSubPillarDetails => ({
  table: {
    title,
    subtitle,
    searchPlaceholder,
    filters: ['All', 'Critical', 'Needs Work', 'Healthy'],
    statusClass: { Critical: bad, 'Needs Work': warn, Healthy: good },
    columns: [
      { key: 'surface', header: 'Surface' },
      { key: 'signal', header: 'Signal', variant: 'muted' },
      { key: 'coverage', header: 'Coverage', align: 'center', variant: 'number' },
      { key: 'status', header: 'Status', align: 'center', variant: 'status' },
      { key: 'recommendation', header: 'Recommendation', variant: 'muted' },
    ],
    rows,
  },
  opportunities,
});

const opportunities = (title: string, description: string, filter: string = 'Needs Work') => [
  { id: `${filter}-1`, title, description, impact: 'High' as const, effort: 'Medium' as const, ctaLabel: 'Review Findings', filter },
  { id: `${filter}-2`, title: 'Prioritize the highest-intent surfaces first', description: 'Start with pages and flows closest to a purchase decision so improvements can compound quickly.', impact: 'Medium' as const, effort: 'Low' as const, ctaLabel: 'View Healthy', filter: 'Healthy' },
];

export const croTables: Record<string, GenericSubPillarDetails> = {
  'cro/clarity': makeDetails('CTA Clarity by Surface', 'Pages where the next action is clear, weak, or missing.', 'Search by page or CTA…', [
    { id: 'clarity-1', status: 'Healthy', cells: { surface: 'Product pages', signal: 'Primary add-to-cart action visible above the fold', coverage: '77%', recommendation: 'Keep the current hierarchy' } },
    { id: 'clarity-2', status: 'Needs Work', cells: { surface: 'Collection pages', signal: 'Filter and product actions compete for attention', coverage: '12 pages', recommendation: 'Strengthen the primary browse action' } },
    { id: 'clarity-3', status: 'Critical', cells: { surface: 'Landing pages', signal: 'No clear primary CTA', coverage: '6 pages', recommendation: 'Add one action with supporting proof' } },
  ], opportunities('Clarify the primary CTA on 18 pages', 'Reduce hesitation by giving each page one obvious next action.')),
  'cro/cart-recovery': makeDetails('Cart Recovery Flow Coverage', 'Recovery journeys available for abandoned-cart shoppers.', 'Search by flow…', [
    { id: 'cart-1', status: 'Healthy', cells: { surface: 'Email reminder', signal: 'Active with timing and revenue tracking', coverage: '1 flow', recommendation: 'Test subject lines quarterly' } },
    { id: 'cart-2', status: 'Needs Work', cells: { surface: 'Exit intent', signal: 'Configured but missing an offer strategy', coverage: '1 flow', recommendation: 'Add a controlled incentive test' } },
    { id: 'cart-3', status: 'Critical', cells: { surface: 'SMS, push, retargeting', signal: 'Recovery journeys not implemented', coverage: '4 flows', recommendation: 'Launch high-intent follow-ups' } },
  ], opportunities('Launch the four missing recovery flows', 'Recover more of the estimated $18,420 in abandoned-cart revenue.', 'Critical')),
  'cro/trust': makeDetails('Trust Signal Coverage', 'Product-level review and confidence signals across the catalog.', 'Search by trust signal…', [
    { id: 'trust-1', status: 'Healthy', cells: { surface: 'Reviewed products', signal: 'Meaningful review coverage', coverage: '842', recommendation: 'Surface review highlights near CTA' } },
    { id: 'trust-2', status: 'Needs Work', cells: { surface: 'Trust badges', signal: 'Badge coverage across product pages', coverage: '61%', recommendation: 'Standardize badge placement' } },
    { id: 'trust-3', status: 'Critical', cells: { surface: 'Unreviewed products', signal: 'No customer reviews', coverage: '312', recommendation: 'Trigger post-purchase review requests' } },
  ], opportunities('Collect reviews for 312 products', 'Close the strongest trust gap on products with no customer proof.', 'Critical')),
  'cro/returns': makeDetails('Returns Journey Readiness', 'How much of the returns journey customers can complete without support.', 'Search by returns step…', [
    { id: 'returns-1', status: 'Healthy', cells: { surface: 'Self-service portal', signal: 'Requests resolved without manual handling', coverage: '198', recommendation: 'Keep portal guidance visible' } },
    { id: 'returns-2', status: 'Needs Work', cells: { surface: 'Policy page', signal: 'Policy clarity score', coverage: '82/100', recommendation: 'Rewrite the two unclear steps' } },
    { id: 'returns-3', status: 'Critical', cells: { surface: 'Manual requests', signal: 'Requests still require support', coverage: '86', recommendation: 'Add missing portal steps' } },
  ], opportunities('Move 86 manual returns into self-service', 'Remove avoidable support friction from the returns journey.')),
  'cro/tracking': makeDetails('Order Tracking Coverage', 'Tracking and proactive delivery visibility after checkout.', 'Search by tracking signal…', [
    { id: 'tracking-1', status: 'Healthy', cells: { surface: 'Carrier tracking', signal: 'Orders include a tracking number', coverage: '3,106', recommendation: 'Maintain carrier coverage' } },
    { id: 'tracking-2', status: 'Needs Work', cells: { surface: 'Branded tracking page', signal: 'Orders using owned tracking experience', coverage: '58%', recommendation: 'Route more traffic to the branded page' } },
    { id: 'tracking-3', status: 'Critical', cells: { surface: 'Missing tracking', signal: 'Orders lack delivery visibility', coverage: '314', recommendation: 'Add a tracking fallback' } },
  ], opportunities('Add tracking visibility to 314 orders', 'Reduce post-purchase anxiety with reliable delivery updates.', 'Critical')),
  'cro/cod': makeDetails('COD Checkout Quality', 'Validation and trust checks for cash-on-delivery orders.', 'Search by checkout signal…', [
    { id: 'cod-1', status: 'Healthy', cells: { surface: 'Eligible checkout', signal: 'COD option is available', coverage: '58%', recommendation: 'Keep eligibility rules visible' } },
    { id: 'cod-2', status: 'Needs Work', cells: { surface: 'Validation', signal: 'COD checkouts with field errors', coverage: '9.2%', recommendation: 'Simplify fields and validation copy' } },
    { id: 'cod-3', status: 'Critical', cells: { surface: 'OTP verification', signal: 'Verification is not enabled', coverage: '0%', recommendation: 'Add OTP before order placement' } },
  ], opportunities('Enable OTP verification for COD', 'Reduce fraud and delivery refusals with a lightweight confirmation step.', 'Critical')),
  'cro/options': makeDetails('Product Option Coverage', 'Variants, add-ons, and guidance available to shoppers.', 'Search by product option…', [
    { id: 'options-1', status: 'Healthy', cells: { surface: 'Product variants', signal: 'Products with useful variants', coverage: '968', recommendation: 'Keep variant imagery aligned' } },
    { id: 'options-2', status: 'Needs Work', cells: { surface: 'Add-ons', signal: 'Products with relevant add-ons', coverage: '214', recommendation: 'Expand high-margin add-ons' } },
    { id: 'options-3', status: 'Critical', cells: { surface: 'Size guides', signal: 'Products missing fit guidance', coverage: '86', recommendation: 'Add contextual size guidance' } },
  ], opportunities('Add size guidance to 86 products', 'Help shoppers choose confidently and reduce avoidable uncertainty.')),
  'cro/subscription': makeDetails('Subscription Opportunity', 'Eligible products with a recurring purchase option.', 'Search by subscription status…', [
    { id: 'subscription-1', status: 'Healthy', cells: { surface: 'Subscription enabled', signal: 'Eligible products with subscribe option', coverage: '96', recommendation: 'Promote savings near purchase CTA' } },
    { id: 'subscription-2', status: 'Needs Work', cells: { surface: 'Adoption', signal: 'Eligible orders using subscription', coverage: '12%', recommendation: 'Improve value communication' } },
    { id: 'subscription-3', status: 'Critical', cells: { surface: 'Missing subscription', signal: 'Eligible products without option', coverage: '246', recommendation: 'Enable recurring purchase' } },
  ], opportunities('Enable subscriptions on 246 products', 'Capture recurring demand from eligible consumable and accessory SKUs.', 'Critical')),
  'cro/wishlist': makeDetails('Wishlist Intent Coverage', 'Save-for-later capability and downstream shopping intent.', 'Search by wishlist signal…', [
    { id: 'wishlist-1', status: 'Healthy', cells: { surface: 'Active wishlist users', signal: 'Shoppers currently saving products', coverage: '1,860', recommendation: 'Add reminder messaging' } },
    { id: 'wishlist-2', status: 'Needs Work', cells: { surface: 'Wishlist to cart', signal: 'Saved products reaching cart', coverage: '18%', recommendation: 'Test restock and price alerts' } },
    { id: 'wishlist-3', status: 'Critical', cells: { surface: 'Theme coverage', signal: 'Pages with wishlist support', coverage: '46%', recommendation: 'Extend the control across templates' } },
  ], opportunities('Expand wishlist coverage beyond 46% of pages', 'Capture intent consistently across the storefront.', 'Critical')),
  'cro/locator': makeDetails('Store Locator Data Quality', 'Completeness of the location details shoppers rely on.', 'Search by location…', [
    { id: 'locator-1', status: 'Healthy', cells: { surface: 'Complete locations', signal: 'Locations with all key details', coverage: '7', recommendation: 'Keep local data synchronized' } },
    { id: 'locator-2', status: 'Needs Work', cells: { surface: 'Missing hours', signal: 'Locations without opening hours', coverage: '3', recommendation: 'Backfill holiday and weekly hours' } },
    { id: 'locator-3', status: 'Critical', cells: { surface: 'Missing map pins', signal: 'Locations without accurate pins', coverage: '4', recommendation: 'Fix geocoding and map placement' } },
  ], opportunities('Complete the four missing map pins', 'Make nearby stores findable and trustworthy on mobile.', 'Critical')),
  'cro/mobile-ux': makeDetails('Mobile UX by Page', 'Tap targets, layout stability, and conversion path readiness.', 'Search by page or issue…', [
    { id: 'mobile-1', status: 'Healthy', cells: { surface: 'Good pages', signal: 'Pages meeting mobile usability expectations', coverage: '31', recommendation: 'Use as the reference pattern' } },
    { id: 'mobile-2', status: 'Needs Work', cells: { surface: 'Needs improvement', signal: 'Pages needing mobile refinement', coverage: '12', recommendation: 'Fix tap targets and sticky actions' } },
    { id: 'mobile-3', status: 'Critical', cells: { surface: 'Critical pages', signal: 'Pages blocking a healthy journey', coverage: '5', recommendation: 'Prioritize before acquisition campaigns' } },
  ], opportunities('Fix the five critical mobile pages', 'Remove conversion blockers from the highest-traffic mobile paths.', 'Critical')),
};
