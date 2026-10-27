/*
 * A shared report link (crf04/statsplus#342) unfurls with the report's own
 * title, its graded spots and a drawn image. The edge asks the backend for the
 * report's small meta document; a missing or unreadable report falls back to
 * the static document.
 */
const REPORT_PATH = /^\/reports\/([A-Za-z0-9]{6,16})\/?$/;
const TAG_ORDER = ['strong', 'lean', 'thin', 'pass'];

export const reportIdFrom = (pathname) => pathname.match(REPORT_PATH)?.[1] ?? null;

export const reportPreviewFrom = (id, meta) => {
  if (!meta || typeof meta.title !== 'string' || !meta.title) return null;
  const tags = meta.tags && typeof meta.tags === 'object' ? meta.tags : {};
  const graded = TAG_ORDER.filter((tag) => Number(tags[tag]) > 0)
    .map((tag) => `${tags[tag]} ${tag}`)
    .join(' · ');
  const summary = typeof meta.description === 'string' ? meta.description : '';
  return {
    title: `${meta.title} | CourtAI`,
    description: [graded && `${graded}.`, summary].filter(Boolean).join(' '),
    image: `/api/reports/${id}/preview.png`,
  };
};

export const reportPreviewFor = async (pathname, origin, fetchImpl = fetch) => {
  const id = reportIdFrom(pathname);
  if (!id) return null;
  try {
    const response = await fetchImpl(new URL(`/api/reports/${id}/meta`, origin));
    if (!response.ok) return null;
    return reportPreviewFrom(id, await response.json());
  } catch {
    return null;
  }
};
