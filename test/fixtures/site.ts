import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';

const ARTICLE_BODY = `
<p>Attest is a stateless capture engine for the verified web. It fetches a page
exactly once, blocks advertising and tracker requests at the network layer
before anything renders, and returns two complementary artifacts: a full-page
screenshot that preserves the visual truth of the page, and a reader-mode
Markdown extraction that preserves the textual truth.</p>
<p>Every response carries a signed receipt. The receipt records the requested
URL, the final URL after redirects, the retrieval time in UTC with microsecond
precision, and a SHA-256 hash of each artifact. The Ed25519 signature can be
verified offline by anyone holding only the engine's public key, which makes
the receipt portable evidence that a given page really looked this way at a
given instant.</p>
<p>The quick brown fox jumps over the lazy dog while the antique ivory
xylophones vibrate quietly in the background, padding this fixture article to
a length that the Readability heuristics comfortably accept as real content
rather than boilerplate navigation.</p>`;

function page(title: string, extraHead: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title>${extraHead}</head>
<body>
<main id="content"><article><h1>${title}</h1>${body}</article></main>
</body>
</html>`;
}

const ROUTES: Record<string, { type: string; body: string }> = {
  '/article.html': {
    type: 'text/html',
    body: page(
      'The Verified Web Article',
      `<script src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>`,
      `${ARTICLE_BODY}
<img id="ad-banner" src="https://static.doubleclick.net/instream/ad_banner.png" alt="ad">
<p><a id="next-link" href="/destination.html">Continue to the destination article</a></p>`,
    ),
  },
  '/destination.html': {
    type: 'text/html',
    body: page(
      'The Destination Article',
      '',
      `<p>You have arrived at the destination page of the navigation fixture. This
paragraph exists so that Readability has genuine article content to extract
from the destination of a clicked link, proving that each navigation hop is
captured and receipted independently of the page that linked to it.</p>
${ARTICLE_BODY}`,
    ),
  },
  '/redirect': { type: 'redirect', body: '/article.html' },
  '/slow': { type: 'slow', body: '' },
};

export interface FixtureSite {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startFixtureSite(): Promise<FixtureSite> {
  const server: Server = createServer((req, res) => {
    const route = ROUTES[req.url ?? ''];
    if (!route) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    if (route.type === 'redirect') {
      res.writeHead(302, { location: route.body });
      res.end();
      return;
    }
    if (route.type === 'slow') {
      // Never responds; used to exercise navigation timeouts.
      return;
    }
    res.writeHead(200, { 'content-type': route.type });
    res.end(route.body);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
