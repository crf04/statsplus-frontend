import { applyLinkPreview, linkPreviewFor } from './src/linkPreview';

// Vercel serves the same static index.html for every route, and link
// unfurlers (iMessage, Slack, Discord, X) read only that HTML — they never run
// the app. So a shared Workspace link is described here, at the edge, before
// the document reaches whoever is previewing it.
export const config = { matcher: '/' };

export default async function middleware(request) {
  const url = new URL(request.url);
  const preview = linkPreviewFor(url.searchParams);
  if (preview === null) return undefined;

  const response = await fetch(new URL('/index.html', url.origin), {
    headers: { cookie: request.headers.get('cookie') ?? '' },
  });
  if (!response.ok) return undefined;

  const html = applyLinkPreview(await response.text(), preview);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type', 'text/html; charset=utf-8');
  return new Response(html, { status: 200, headers });
}
