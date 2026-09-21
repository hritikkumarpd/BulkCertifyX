import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getPlan, PLANS } from '../src/config/plans.js';
import { currentPeriod } from '../src/utils/codes.js';

test('getPlan returns valid config for all tiers', () => {
  assert.equal(getPlan('free').name, 'Free');
  assert.equal(getPlan('starter').name, 'Starter');
  assert.equal(getPlan('pro').name, 'Pro');
  assert.equal(getPlan('unknown').name, 'Free', 'unknown plan must default to Free');
});

test('free plan restricts paid features and bounds quota', () => {
  const free = getPlan('free');
  assert.equal(free.features.email, false);
  assert.equal(free.features.whiteLabel, false);
  assert.equal(free.features.customDomain, false);
  assert.equal(free.features.api, false);
  assert.equal(free.limits.certificatesPerMonth, 25);
  assert.equal(free.limits.templates, 1);
  assert.equal(free.limits.teamMembers, 1);
});

test('pro plan unlocks all capabilities and high limits', () => {
  const pro = getPlan('pro');
  assert.equal(pro.features.email, true);
  assert.equal(pro.features.whiteLabel, true);
  assert.equal(pro.features.customDomain, true);
  assert.equal(pro.features.api, true);
  assert.equal(pro.limits.certificatesPerMonth, 5000);
  assert.equal(pro.limits.templates, -1, 'pro has unlimited templates');
  assert.equal(pro.limits.teamMembers, 3);
});

test('currentPeriod returns YYYY-MM format', () => {
  const p = currentPeriod();
  assert.match(p, /^\d{4}-\d{2}$/);
});
