import { describe, expect, it } from 'vitest';

import { EMAIL_PROVIDER_PACKAGES } from '../src/commands/install.js';

describe('EMAIL_PROVIDER_PACKAGES', () => {
  it('maps resend to @bermooda/plugin-resend', () => {
    expect(EMAIL_PROVIDER_PACKAGES.resend).toBe('@bermooda/plugin-resend');
  });

  it('maps sendgrid to @bermooda/plugin-sendgrid', () => {
    expect(EMAIL_PROVIDER_PACKAGES.sendgrid).toBe('@bermooda/plugin-sendgrid');
  });

  it('maps aws-ses to @bermooda/plugin-aws-ses', () => {
    expect(EMAIL_PROVIDER_PACKAGES['aws-ses']).toBe('@bermooda/plugin-aws-ses');
  });

  it('contains exactly three providers', () => {
    expect(Object.keys(EMAIL_PROVIDER_PACKAGES)).toEqual([
      'resend',
      'sendgrid',
      'aws-ses',
    ]);
  });

  it('returns undefined for unknown provider', () => {
    expect(EMAIL_PROVIDER_PACKAGES['unknown']).toBeUndefined();
  });
});
