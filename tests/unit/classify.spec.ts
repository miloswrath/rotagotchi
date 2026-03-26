import { describe, it, expect } from 'vitest';
import { classifyUrl } from '@/extension/src/classify';

const BLACKLIST = ['youtube.com', 'instagram.com', 'facebook.com', 'tiktok.com', 'twitter.com'];

describe('classifyUrl', () => {
  it('returns degenerative for exact blacklist match', () => {
    expect(classifyUrl('https://youtube.com/watch?v=abc', BLACKLIST)).toBe('degenerative');
    expect(classifyUrl('https://instagram.com/', BLACKLIST)).toBe('degenerative');
  });

  it('returns degenerative for subdomain of blacklisted domain', () => {
    expect(classifyUrl('https://m.youtube.com/watch?v=abc', BLACKLIST)).toBe('degenerative');
    expect(classifyUrl('https://www.youtube.com/', BLACKLIST)).toBe('degenerative');
  });

  it('returns neutral for a domain not on the blacklist', () => {
    expect(classifyUrl('https://github.com', BLACKLIST)).toBe('neutral');
    expect(classifyUrl('https://example.com', BLACKLIST)).toBe('neutral');
  });

  it('returns neutral for chrome:// internal URL', () => {
    expect(classifyUrl('chrome://newtab/', BLACKLIST)).toBe('neutral');
    expect(classifyUrl('chrome://settings/', BLACKLIST)).toBe('neutral');
  });

  it('returns neutral for about: URL', () => {
    expect(classifyUrl('about:newtab', BLACKLIST)).toBe('neutral');
    expect(classifyUrl('about:blank', BLACKLIST)).toBe('neutral');
  });

  it('returns neutral for chrome-extension:// URL', () => {
    expect(classifyUrl('chrome-extension://abc123/popup.html', BLACKLIST)).toBe('neutral');
  });

  it('returns neutral for any URL when blacklist is empty', () => {
    expect(classifyUrl('https://youtube.com', [])).toBe('neutral');
    expect(classifyUrl('https://tiktok.com', [])).toBe('neutral');
  });

  it('does not match partial domain names (no false positives)', () => {
    // "notyoutube.com" should NOT match "youtube.com"
    expect(classifyUrl('https://notyoutube.com', BLACKLIST)).toBe('neutral');
    // "youtube.co.uk" should NOT match "youtube.com"
    expect(classifyUrl('https://youtube.co.uk', BLACKLIST)).toBe('neutral');
  });

  it('returns neutral for malformed or unparseable URLs', () => {
    expect(classifyUrl('not-a-url', BLACKLIST)).toBe('neutral');
    expect(classifyUrl('', BLACKLIST)).toBe('neutral');
  });
});
