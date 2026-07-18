import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});
turndown.remove(['script', 'style', 'noscript']);

/**
 * Reader-mode extraction: Readability isolates the article, turndown converts
 * it to Markdown. Pages Readability cannot parse fall back to a whole-body
 * conversion so the caller always gets the text truth of the page.
 */
export function extractReaderMarkdown(html: string, url: string): string {
  const dom = new JSDOM(html, { url });
  let title = '';
  let contentHtml = '';
  try {
    const article = new Readability(dom.window.document, { charThreshold: 100 }).parse();
    if (article?.content) {
      title = article.title ?? '';
      contentHtml = article.content;
    }
  } catch {
    // fall through to whole-body conversion
  }
  if (!contentHtml) {
    // Readability mutates the DOM; re-parse for the fallback.
    const fresh = new JSDOM(html, { url });
    title = fresh.window.document.title;
    contentHtml = fresh.window.document.body?.innerHTML ?? '';
  }
  let markdown = turndown.turndown(contentHtml).trim();
  if (title && !markdown.startsWith('# ')) {
    markdown = `# ${title}\n\n${markdown}`;
  }
  return markdown + '\n';
}
