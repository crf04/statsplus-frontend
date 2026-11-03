/*
 * A shared Research link (crf04/statsplus#372) unfurls like a report link:
 * the feed or the author's page, drawn with the newest listed report's
 * preview image. An unknown author, an empty feed or an unreadable answer
 * falls back to the static document.
 */
const RESEARCH_PATH = /^\/research\/?$/;
const AUTHOR_PATH = /^\/research\/@([A-Za-z0-9_]{3,20})\/?$/;

const newestPreview = (page) => {
  if (!page || !Array.isArray(page.featured) || !Array.isArray(page.reports)) return null;
  const newest = [...page.featured, ...page.reports]
    .filter((entry) => entry && typeof entry.preview_url === 'string' && entry.preview_url)
    .sort((a, b) => Date.parse(b.listed_at) - Date.parse(a.listed_at))[0];
  return newest?.preview_url ?? null;
};

export const researchPreviewFor = async (pathname, origin, fetchImpl = fetch) => {
  const author = pathname.match(AUTHOR_PATH)?.[1]?.toLowerCase();
  if (!author && !RESEARCH_PATH.test(pathname)) return null;
  const api = author ? `/api/research/authors/${author}` : '/api/research';
  try {
    const response = await fetchImpl(new URL(api, origin));
    if (!response.ok) return null;
    const image = newestPreview(await response.json());
    if (!image) return null;
    return author
      ? {
          title: `@${author} · Research | CourtAI`,
          description: `Research @${author} shared on CourtAI: NBA reports built from CourtAI's facts. Each is the author's view.`,
          image,
        }
      : {
          title: 'Research | CourtAI',
          description:
            "NBA research CourtAI users chose to share, built from CourtAI's facts. Each report is its author's view.",
          image,
        };
  } catch {
    return null;
  }
};
