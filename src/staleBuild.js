const KEY = 'courtai:reloaded-for';
const MISSING_ASSET = [
  /^Unable to preload CSS/,
  /dynamically imported module/i,
  /^Importing a module script failed/,
];
let reloading = false;

export const isMissingAsset = (error) =>
  MISSING_ASSET.some((pattern) => pattern.test(String(error?.message ?? '')));

// After a deploy, a tab running the previous build asks for chunks and
// stylesheets the new deployment no longer serves. Each failure reloads once
// per build, keyed by the entry script because Safari's message names no
// asset; a failure that survives its reload shows the route's error alert.
const reloadOnce = (error) => {
  if (!isMissingAsset(error)) return;
  const build = document.querySelector('script[type="module"][src]')?.src;
  const failure = `${build} ${error.message}`;
  try {
    const tried = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    if (tried.includes(failure)) return;
    sessionStorage.setItem(KEY, JSON.stringify([...tried, failure]));
  } catch {
    return;
  }
  reloading = true;
  window.location.reload();
};

export const listenForMissingAssets = () =>
  window.addEventListener('vite:preloadError', (event) => reloadOnce(event.payload));

export const isReloadingForMissingAsset = () => reloading;
