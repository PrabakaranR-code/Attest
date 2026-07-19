import { describe, expect, it } from 'vitest';
import { extractReaderMarkdown } from '../src/engine/reader.js';

const ARTICLE_HTML = `<!doctype html><html><head><title>Sample Article</title></head>
<body>
<nav>Home | About | Contact</nav>
<article>
<h1>Sample Article</h1>
<p>This is the first paragraph of a sample article used to test reader-mode
extraction. It contains enough prose for Readability to treat it as content.</p>
<p>The second paragraph continues the discussion with additional sentences so
that the character threshold is comfortably met by the article body text.</p>
<script>window.tracker = 'should not appear';</script>
</article>
</body></html>`;

describe('extractReaderMarkdown', () => {
  it('extracts article text as markdown with the title as heading', () => {
    const md = extractReaderMarkdown(ARTICLE_HTML, 'https://example.com/a');
    expect(md).toContain('# Sample Article');
    expect(md).toContain('first paragraph of a sample article');
    expect(md).toContain('second paragraph');
  });

  it('drops script contents', () => {
    const md = extractReaderMarkdown(ARTICLE_HTML, 'https://example.com/a');
    expect(md).not.toContain('should not appear');
  });

  it('falls back to whole-body conversion for non-article pages', () => {
    const md = extractReaderMarkdown(
      '<!doctype html><html><head><title>Tiny</title></head><body><p>hi</p></body></html>',
      'https://example.com/tiny',
    );
    expect(md).toContain('hi');
  });
});
