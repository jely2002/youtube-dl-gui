import { describe, it, expect } from 'vitest';
import { useLinkify } from '../../src/composables/useLinkify';

describe('useLinkify', () => {
  const { linkify } = useLinkify();

  it('correctly linkifies a standard HTTP URL', () => {
    const input = 'Visit https://example.com for more info.';
    const output = linkify(input);
    expect(output).toBe(
      'Visit <a class="link" target="_blank" rel="noopener noreferrer" href="https://example.com">https://example.com</a> for more info.',
    );
  });

  it('adds https:// to URLs starting with www.', () => {
    const input = 'Go to www.example.org';
    const output = linkify(input);
    expect(output).toContain('href="https://www.example.org"');
    expect(output).toContain('>www.example.org</a>');
  });

  it('escapes HTML in non-URL text', () => {
    const input = 'Check out this <script>alert("XSS")</script>';
    const output = linkify(input);
    expect(output).toBe(
      'Check out this &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;',
    );
  });

  // --- CRITICAL: XSS protection in href ---
  it('prevents XSS in href attribute by escaping quotes', () => {
    const input = 'http://example.com/path"onmouseover="alert(1)';
    const output = linkify(input);

    // Ensure no malicious attribute is injected
    expect(output).not.toContain('href="http://example.com/path"');
    // Verify quotes are escaped
    expect(output).toContain('href="http://example.com/path&quot;onmouseover=&quot;alert(1"');
    // Also verify the visible label is escaped (already handled)
    expect(output).toContain('>http://example.com/path&quot;onmouseover=&quot;alert(1</a>');
  });

  // --- FIX for lastIndex state leakage ---
  it('resets regex lastIndex between calls (no state leakage)', () => {
    const input1 = 'First: www.one.com';
    const input2 = 'Second: http://two.org';
    const result1 = linkify(input1);
    const result2 = linkify(input2);

    // Both must have links
    expect(result1).toContain('href="https://www.one.com"');
    expect(result2).toContain('href="http://two.org"');
  });

  it('linkifies multiple URLs in a single string', () => {
    const input = 'Check https://one.com and also www.two.org and http://three.net';
    const output = linkify(input);
    expect(output).toContain('https://one.com');
    expect(output).toContain('https://www.two.org');
    expect(output).toContain('http://three.net');
  });

  it('handles URLs with parentheses (as much as the regex allows)', () => {
    const input = 'See (https://en.wikipedia.org/wiki/JavaScript_(lenguaje))';
    const output = linkify(input);
    // The current regex excludes the final closing parenthesis, so it stops before it
    expect(output).toContain('href="https://en.wikipedia.org/wiki/JavaScript_(lenguaje"');
    expect(output).toContain('>https://en.wikipedia.org/wiki/JavaScript_(lenguaje</a>');
  });

  it('escapes special characters in the URL label (e.g. ampersand)', () => {
    const input = 'http://example.com/?q=hello&world';
    const output = linkify(input);
    expect(output).toContain('href="http://example.com/?q=hello&amp;world"');
    expect(output).toContain('>http://example.com/?q=hello&amp;world</a>');
  });
});
