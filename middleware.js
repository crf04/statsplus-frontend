import { getTodaySlateDate } from './src/calendarDate';
import { applyLinkPreview, linkPreviewFor } from './src/linkPreview';
import { matchupPreviewFor } from './src/matchupPreview';

// Vercel serves the same static index.html for every route, and link
// unfurlers (iMessage, Slack, Discord, X) read only that HTML — they never run
// the app. So a shared Workspace, Slate or Matchup link is described here, at the edge, before
// the document reaches whoever is previewing it.
export const config = { matcher: ['/', '/matchups', '/matchups/:gameId'] };

export const describeLink = async (request, now) => {
  const url = new URL(request.url);
  const today = getTodaySlateDate(now);
  const preview = url.pathname.startsWith('/matchups')
    ? matchupPreviewFor(url.pathname, url.searchParams, { today })
    : linkPreviewFor(url.searchParams, { lineDate: today });
  if (preview === null) return undefined;

  const response = await fetch(new URL('/index.html', url.origin), {
    headers: { cookie: request.headers.get('cookie') ?? '' },
  });
  if (!response.ok) return undefined;

  const html = applyLinkPreview(await response.text(), {
    ...preview,
    image: preview.image && new URL(preview.image, url.origin).href,
  });
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type', 'text/html; charset=utf-8');
  return new Response(html, { status: 200, headers });
};

export default function middleware(request) {
  return describeLink(request, new Date());
}
