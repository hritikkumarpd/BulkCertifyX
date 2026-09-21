// Central plan definitions. This is the single source of truth for limits.
// -1 means unlimited.

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceAnnual: 0,
    limits: {
      certificatesPerMonth: 25,
      bulkPerJob: 10,
      templates: 1,
      teamMembers: 1,
    },
    features: {
      email: false,
      analytics: 'basic',
      customDomain: false,
      whiteLabel: false,
      api: false,
    },
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 199,
    priceAnnual: 1990,
    limits: {
      certificatesPerMonth: 500,
      bulkPerJob: 200,
      templates: 5,
      teamMembers: 2,
    },
    features: {
      email: true,
      analytics: 'basic',
      customDomain: false,
      whiteLabel: false,
      api: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 599,
    priceAnnual: 5990,
    limits: {
      certificatesPerMonth: 5000,
      bulkPerJob: 1000,
      templates: -1,
      teamMembers: 3,
    },
    features: {
      email: true,
      analytics: 'full',
      customDomain: true,
      whiteLabel: true,
      api: true,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 1999,
    priceAnnual: 19990,
    limits: {
      certificatesPerMonth: -1,
      bulkPerJob: -1,
      templates: -1,
      teamMembers: -1,
    },
    features: {
      email: true,
      analytics: 'full',
      customDomain: true,
      whiteLabel: true,
      api: true,
    },
  },
};

export function getPlan(tier) {
  return PLANS[tier] || PLANS.free;
}

/** Returns true if `limit` (-1 = unlimited) permits `count`. */
export function withinLimit(limit, count) {
  return limit < 0 || count <= limit;
}
