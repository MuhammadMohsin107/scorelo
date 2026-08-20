// ─── CRO Pillar Mock Data (11 Exact Sub-Pillars) ──────────────────────

export type CroSubPillarKey =
  | 'clarity'
  | 'cart-recovery'
  | 'trust'
  | 'returns'
  | 'tracking'
  | 'cod'
  | 'options'
  | 'subscription'
  | 'wishlist'
  | 'locator'
  | 'mobile-ux';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

// ─── CLARITY / BEHAVIOR READINESS ──────────────────────────────────
export const clarityBehaviorData = {
  score: 78,
  status: 'good',
  pagesAnalyzed: 96,
  clearCta: 74,
  weakCta: 12,
  missingCta: 6,
  confusingLayout: 4,
  avgTimeToFirstCta: 2.8,
  aboveFoldClarity: 77,
};

// ─── CART RECOVERY ──────────────────────────────────────────────────
export const cartRecoveryData = {
  score: 75,
  status: 'good',
  abandonedCarts: 428,
  recoveryOpportunity: 18420,
  recoveryReadiness: 72,
  totalFlows: 7,
  activeFlows: 3,
  missingFlows: 4,
  recoveredLast30Days: 96,
  recoveredRevenueLast30Days: 6180,
  avgCartValue: 86.4,
};

// ─── TRUST & SOCIAL PROOF ───────────────────────────────────────────
export const trustSocialProofData = {
  score: 68,
  status: 'needs-work',
  productsAnalyzed: 1284,
  wellReviewed: 842,
  noReviews: 312,
  trustOpportunities: 130,
  avgRating: 4.4,
  totalReviews: 21480,
  trustBadgeCoverage: 61,
};

// ─── RETURNS FLOW ───────────────────────────────────────────────────
export const returnsFlowData = {
  score: 82,
  status: 'good',
  ordersAnalyzed: 3420,
  returnRequests: 284,
  selfServiceReturns: 198,
  manualReturns: 86,
  avgProcessingDays: 4.2,
  returnRate: 8.3,
  policyClarityScore: 82,
  missingPortalSteps: 2,
};

// ─── ORDER TRACKING ─────────────────────────────────────────────────
export const orderTrackingData = {
  score: 85,
  status: 'excellent',
  ordersAnalyzed: 3420,
  ordersWithTracking: 3106,
  ordersWithoutTracking: 314,
  brandedTrackingPageCoverage: 58,
  proactiveNotificationRate: 64,
  avgDeliveryEtaDays: 4.8,
  carrierIntegrations: 3,
};

// ─── COD CHECKOUT QUALITY ───────────────────────────────────────────
export const codCheckoutData = {
  score: 61,
  status: 'needs-work',
  codEligibleOrders: 1840,
  codOfferedRate: 58,
  avgCheckoutFields: 14,
  validationErrorRate: 9.2,
  otpVerificationEnabled: false,
  codOrderShare: 22,
  codReturnRefusalRate: 18,
};

// ─── PRODUCT OPTIONS / ADD-ONS ──────────────────────────────────────
export const productOptionsData = {
  score: 81,
  status: 'good',
  productsAnalyzed: 1284,
  productsWithVariants: 968,
  productsWithAddOns: 214,
  missingSizeGuide: 86,
  bundleCoverage: 22,
  variantImageMismatch: 34,
};

// ─── SUBSCRIPTION OPPORTUNITY ───────────────────────────────────────
export const subscriptionOpportunityData = {
  score: 64,
  status: 'needs-work',
  subscribableProducts: 342,
  productsWithSubscription: 96,
  productsMissingSubscription: 246,
  subscriptionAdoptionRate: 12,
  avgSubscriberDiscount: 15,
  monthlyChurnRate: 6.8,
};

// ─── WISHLIST ────────────────────────────────────────────────────────
export const wishlistData = {
  score: 59,
  status: 'needs-work',
  themePageCoverage: 46,
  totalWishlistAdds: 5240,
  activeWishlistUsers: 1860,
  wishlistToCartRate: 18,
  wishlistToPurchaseRate: 9.4,
  productsNeverWishlisted: 612,
};

// ─── STORE LOCATOR ───────────────────────────────────────────────────
export const storeLocatorData = {
  score: 71,
  status: 'good',
  totalLocations: 12,
  completeLocations: 7,
  missingHours: 3,
  missingPhone: 2,
  missingMapPin: 4,
  missingPhotos: 5,
  avgDataCompleteness: 68,
};

// ─── MOBILE UX ───────────────────────────────────────────────────────
export const mobileUxData = {
  score: 80,
  status: 'good',
  pagesAnalyzed: 48,
  good: 31,
  needsImprovement: 12,
  critical: 5,
  avgTapTargetScore: 78,
  avgMobileConversionRate: 1.8,
};

// ─── OVERALL CRO KPIs ────────────────────────────────────────────────
export const croKpis = [
  { label: 'Overall CRO Score', value: '78/100', trend: '+2.1%', status: 'good' },
  { label: 'Conversion Opportunities', value: '42', trend: '-6', status: 'improvement' },
  { label: 'High-Impact Issues', value: '8', trend: '-3', status: 'improvement' },
  { label: 'Checkout Issues', value: '6', trend: '-1', status: 'improvement' },
  { label: 'Mobile Issues', value: '12', trend: '-4', status: 'improvement' },
  { label: 'Trust Opportunities', value: '9', trend: '+1', status: 'neutral' },
];

// ─── PRIORITY ISSUES ───────────────────────────────────────────────
export const priorityIssues = [
  {
    id: 'issue-1',
    severity: 'critical' as IssueSeverity,
    title: 'COD checkout missing OTP verification',
    affectedPages: 1840,
    area: 'COD Checkout Quality',
    areaKey: 'cod' as CroSubPillarKey,
    impact: 'Higher fraud risk and order-refusal rate on delivery',
    recommendation: 'Add an OTP/SMS confirmation step before COD orders are placed',
  },
  {
    id: 'issue-2',
    severity: 'critical' as IssueSeverity,
    title: '4 abandoned-cart recovery flows are not implemented',
    affectedPages: 428,
    area: 'Cart Recovery',
    areaKey: 'cart-recovery' as CroSubPillarKey,
    impact: '$18,420 in recoverable revenue currently going unclaimed',
    recommendation: 'Launch SMS, browser push, exit-intent, and retargeting recovery flows',
  },
  {
    id: 'issue-3',
    severity: 'high' as IssueSeverity,
    title: '312 products have zero customer reviews',
    affectedPages: 312,
    area: 'Trust & Social Proof',
    areaKey: 'trust' as CroSubPillarKey,
    impact: 'Lower buyer confidence and conversion on unreviewed product pages',
    recommendation: 'Trigger automated post-purchase review requests for these products',
  },
  {
    id: 'issue-4',
    severity: 'high' as IssueSeverity,
    title: '246 subscribable products are missing subscribe & save',
    affectedPages: 246,
    area: 'Subscription Opportunity',
    areaKey: 'subscription' as CroSubPillarKey,
    impact: 'Missed recurring-revenue opportunity on consumable and accessory SKUs',
    recommendation: 'Enable a subscription purchase option on eligible product types',
  },
  {
    id: 'issue-5',
    severity: 'high' as IssueSeverity,
    title: '5 mobile pages have critical usability issues',
    affectedPages: 5,
    area: 'Mobile UX',
    areaKey: 'mobile-ux' as CroSubPillarKey,
    impact: 'Higher mobile bounce and cart-abandonment rates',
    recommendation: 'Fix tap target sizing, sticky add-to-cart, and viewport scaling',
  },
  {
    id: 'issue-6',
    severity: 'medium' as IssueSeverity,
    title: 'Wishlist button missing on 54% of theme pages',
    affectedPages: 612,
    area: 'Wishlist',
    areaKey: 'wishlist' as CroSubPillarKey,
    impact: 'Lost save-for-later intent and remarketing signal',
    recommendation: 'Add a wishlist button to collection grids and quick-view modals',
  },
  {
    id: 'issue-7',
    severity: 'medium' as IssueSeverity,
    title: '4 of 12 store locations are missing map pin data',
    affectedPages: 4,
    area: 'Store Locator',
    areaKey: 'locator' as CroSubPillarKey,
    impact: 'Nearby shoppers cannot locate or trust these stores',
    recommendation: 'Complete geocoding and map data for every listed location',
  },
  {
    id: 'issue-8',
    severity: 'medium' as IssueSeverity,
    title: '86 product pages are missing a size guide',
    affectedPages: 86,
    area: 'Product Options & Add-ons',
    areaKey: 'options' as CroSubPillarKey,
    impact: 'Increases sizing-related returns and pre-purchase hesitation',
    recommendation: 'Add a size guide link to all apparel-adjacent product pages',
  },
  {
    id: 'issue-9',
    severity: 'low' as IssueSeverity,
    title: 'Return policy clarity is below benchmark on 2 pages',
    affectedPages: 2,
    area: 'Returns Flow',
    areaKey: 'returns' as CroSubPillarKey,
    impact: 'Increased pre-purchase hesitation and support tickets',
    recommendation: 'Simplify return-window and restocking-fee language',
  },
];

// ─── RECOMMENDED ACTIONS ────────────────────────────────────────────
export const recommendedActions = [
  {
    id: 'action-1',
    title: 'Launch missing cart recovery flows',
    pages: 428,
    severity: 'critical',
    effort: 'Medium',
    area: 'Cart Recovery',
  },
  {
    id: 'action-2',
    title: 'Add OTP verification to COD checkout',
    pages: 1840,
    severity: 'critical',
    effort: 'Medium',
    area: 'COD Checkout Quality',
  },
  {
    id: 'action-3',
    title: 'Request reviews for unreviewed products',
    pages: 312,
    severity: 'high',
    effort: 'Low',
    area: 'Trust & Social Proof',
  },
  {
    id: 'action-4',
    title: 'Enable subscribe & save on eligible SKUs',
    pages: 246,
    severity: 'high',
    effort: 'Medium',
    area: 'Subscription Opportunity',
  },
  {
    id: 'action-5',
    title: 'Fix critical mobile usability issues',
    pages: 5,
    severity: 'high',
    effort: 'Medium',
    area: 'Mobile UX',
  },
  {
    id: 'action-6',
    title: 'Add wishlist button across theme pages',
    pages: 612,
    severity: 'medium',
    effort: 'Low',
    area: 'Wishlist',
  },
  {
    id: 'action-7',
    title: 'Complete store location data',
    pages: 4,
    severity: 'medium',
    effort: 'Low',
    area: 'Store Locator',
  },
  {
    id: 'action-8',
    title: 'Add size guides to product pages',
    pages: 86,
    severity: 'medium',
    effort: 'Low',
    area: 'Product Options & Add-ons',
  },
];

// ─── RECENT ACTIVITY ────────────────────────────────────────────────
export const recentActivity = [
  { id: '1', action: 'Enabled subscribe & save on 24 accessory SKUs', timestamp: '3 hours ago', type: 'improvement' },
  { id: '2', action: 'Fixed sticky add-to-cart on 3 mobile product pages', timestamp: '6 hours ago', type: 'fix' },
  { id: '3', action: 'Launched the 72-hour cart recovery email', timestamp: '1 day ago', type: 'improvement' },
  { id: '4', action: 'Added trust badges to 48 product pages', timestamp: '2 days ago', type: 'improvement' },
  { id: '5', action: 'Updated hours and phone number for 3 store locations', timestamp: '3 days ago', type: 'fix' },
  { id: '6', action: 'Added a wishlist button to the collection grid template', timestamp: '4 days ago', type: 'improvement' },
];

// ─── FINDINGS (audit engine model: severity · resolution · lift) ─────
import type { Finding } from '../pillars/finding.types';

export const findings: Finding<CroSubPillarKey>[] = [
  {
    id: 'cro-f1',
    areaKey: 'clarity',
    title: 'Behaviour analytics (Microsoft Clarity) is not installed',
    severity: 'high',
    resolution: 'Integration',
    affected: clarityBehaviorData.pagesAnalyzed,
    affectedLabel: 'pages',
    scoreLift: 3,
    problem: 'No session recordings or heatmaps are being collected, so CTA placement and rage-click hotspots cannot be verified with real behaviour.',
    impact: 'Every CRO change is currently a guess; Clarity is free and unlocks evidence for the remaining findings.',
    ctaLabel: 'Connect Clarity',
    resolvedBy: 'Microsoft Clarity',
  },
  {
    id: 'cro-f2',
    areaKey: 'cart-recovery',
    title: `${cartRecoveryData.missingFlows} of ${cartRecoveryData.totalFlows} recovery flows are not configured`,
    severity: 'critical',
    resolution: 'Product',
    affected: cartRecoveryData.abandonedCarts,
    affectedLabel: 'abandoned carts',
    scoreLift: 5,
    problem: 'Only the email sequence is live; SMS, browser push, exit-intent and retargeting flows are missing.',
    impact: `$${cartRecoveryData.recoveryOpportunity.toLocaleString()} of recoverable revenue in the last 30 days went unclaimed.`,
    ctaLabel: 'Install RecoverlyAI',
    resolvedBy: 'RecoverlyAI',
  },
  {
    id: 'cro-f3',
    areaKey: 'trust',
    title: `${trustSocialProofData.noReviews} products have no reviews; no UGC on PDPs`,
    severity: 'high',
    resolution: 'Product',
    affected: trustSocialProofData.noReviews,
    affectedLabel: 'products',
    scoreLift: 4,
    problem: `Post-purchase review requests are not automated, so ${trustSocialProofData.noReviews} products show an empty rating block and trust badges cover only ${trustSocialProofData.trustBadgeCoverage}% of PDPs.`,
    impact: 'Unreviewed PDPs convert materially worse than reviewed ones; badges and UGC close the confidence gap.',
    ctaLabel: 'Install Reviews & UGC',
    resolvedBy: 'Reviews & UGC',
  },
  {
    id: 'cro-f4',
    areaKey: 'returns',
    title: `Self-serve returns portal is missing ${returnsFlowData.missingPortalSteps} steps`,
    severity: 'low',
    resolution: 'Product',
    affected: returnsFlowData.manualReturns,
    affectedLabel: 'manual returns',
    scoreLift: 2,
    problem: `${returnsFlowData.manualReturns} of ${returnsFlowData.returnRequests} return requests still go through support email; label generation and refund-to-store-credit are not self-serve.`,
    impact: 'Manual returns cost support time and a slow, opaque returns process suppresses first-time purchase confidence.',
    ctaLabel: 'Install Returnlo',
    resolvedBy: 'Returnlo',
  },
  {
    id: 'cro-f5',
    areaKey: 'tracking',
    title: `${orderTrackingData.ordersWithoutTracking} orders shipped without branded tracking`,
    severity: 'medium',
    resolution: 'Product',
    affected: orderTrackingData.ordersWithoutTracking,
    affectedLabel: 'orders',
    scoreLift: 2,
    problem: `Branded tracking covers ${orderTrackingData.brandedTrackingPageCoverage}% of orders; the rest redirect customers to carrier sites and only ${orderTrackingData.proactiveNotificationRate}% receive proactive delivery updates.`,
    impact: '"Where is my order?" tickets are the largest support category; branded tracking pages also drive repeat visits.',
    ctaLabel: 'Install Tracklo',
    resolvedBy: 'Tracklo',
  },
  {
    id: 'cro-f6',
    areaKey: 'cod',
    title: 'COD checkout lacks OTP verification and RTO risk gating',
    severity: 'critical',
    resolution: 'Product',
    affected: codCheckoutData.codEligibleOrders,
    affectedLabel: 'COD orders',
    scoreLift: 5,
    problem: `COD is offered on ${codCheckoutData.codOfferedRate}% of eligible orders with no phone OTP; ${codCheckoutData.codReturnRefusalRate}% of COD orders are refused at the door.`,
    impact: 'Every refused COD delivery is a paid round-trip; OTP + risk scoring typically halves refusal rates.',
    ctaLabel: 'Install COD Manager',
    resolvedBy: 'COD Manager',
  },
  {
    id: 'cro-f7',
    areaKey: 'options',
    title: `Size guides and add-ons unavailable on ${productOptionsData.missingSizeGuide} PDPs`,
    severity: 'medium',
    resolution: 'Product',
    affected: productOptionsData.missingSizeGuide,
    affectedLabel: 'products',
    scoreLift: 2,
    problem: `Gift-wrap, sample sachets and size guidance are not exposed at PDP; bundles cover only ${productOptionsData.bundleCoverage}% of the catalog.`,
    impact: 'Missing options suppress AOV and sizing doubt is the top pre-purchase hesitation on fit-dependent products.',
    ctaLabel: 'Install Product Options',
    resolvedBy: 'Product Options',
  },
  {
    id: 'cro-f8',
    areaKey: 'subscription',
    title: `${subscriptionOpportunityData.productsMissingSubscription} consumable SKUs have no subscribe & save`,
    severity: 'high',
    resolution: 'Product',
    affected: subscriptionOpportunityData.productsMissingSubscription,
    affectedLabel: 'products',
    scoreLift: 4,
    problem: `${subscriptionOpportunityData.productsMissingSubscription} of ${subscriptionOpportunityData.subscribableProducts} subscribable products are sold one-off; adoption sits at ${subscriptionOpportunityData.subscriptionAdoptionRate}%.`,
    impact: 'Repeat-purchase revenue is being re-acquired each time instead of retained on a recurring schedule.',
    ctaLabel: 'Install Recurlo',
    resolvedBy: 'Recurlo',
  },
  {
    id: 'cro-f9',
    areaKey: 'wishlist',
    title: `Wishlist missing on ${100 - wishlistData.themePageCoverage}% of theme pages`,
    severity: 'medium',
    resolution: 'Product',
    affected: wishlistData.productsNeverWishlisted,
    affectedLabel: 'products',
    scoreLift: 3,
    problem: `The save button exists on PDPs but not on collection grids, quick-view or search, so ${wishlistData.productsNeverWishlisted} products have never been wishlisted.`,
    impact: 'Save-for-later intent is lost along with the remarketing signal it generates.',
    ctaLabel: 'Install Wishlist',
    resolvedBy: 'Wishlist',
  },
  {
    id: 'cro-f10',
    areaKey: 'locator',
    title: `${storeLocatorData.missingMapPin} of ${storeLocatorData.totalLocations} retail locations are unlocatable`,
    severity: 'medium',
    resolution: 'Product',
    affected: storeLocatorData.missingMapPin,
    affectedLabel: 'locations',
    scoreLift: 2,
    problem: `${storeLocatorData.missingMapPin} locations have no map pin and ${storeLocatorData.missingHours} are missing opening hours; average data completeness is ${storeLocatorData.avgDataCompleteness}%.`,
    impact: 'Nearby shoppers cannot find or trust these stores, and incomplete listings hurt local discovery.',
    ctaLabel: 'Install Store Locator',
    resolvedBy: 'Store Locator',
  },
  {
    id: 'cro-f11',
    areaKey: 'mobile-ux',
    title: `Sticky add-to-cart hidden and tap targets too small on ${mobileUxData.critical} pages`,
    severity: 'high',
    resolution: 'Service',
    affected: mobileUxData.critical,
    affectedLabel: 'pages',
    scoreLift: 4,
    problem: 'The sticky ATC bar is suppressed under 390px and colour swatches render at 28px, below the 44px touch minimum.',
    impact: `Mobile converts at ${mobileUxData.avgMobileConversionRate}% — roughly half of desktop; fixing the PDP purchase path is the fastest lift available.`,
    ctaLabel: 'Request a quote',
    resolvedBy: 'Theme Customization service · Small scope',
  },
];
