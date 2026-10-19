import config, { apiClient, getApiUrl } from '../config';

export const X_HANDLE_PATTERN = /^[A-Za-z0-9_]{1,15}$/;
export const MESSAGE_MAX_LENGTH = 4000;
const APP_VERSION_MAX_LENGTH = 64;
export const SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024;
const SCREENSHOT_TIMEOUT_MS = 10000;

export const SENT_MESSAGE = 'Sent. Thanks — Chris reads every one.';
export const SCREENSHOT_MISSED_NOTE = 'The screenshot couldn’t be attached.';
export const SEND_FAILED_MESSAGE = 'Couldn’t send. Try again.';

/**
 * The build's commit SHA when it exposes one, else the release the Sentry
 * plugin injected at build time, else the configured version.
 */
export const getAppVersion = () =>
  String(config.APP_COMMIT || globalThis.SENTRY_RELEASE?.id || config.APP_VERSION).slice(
    0,
    APP_VERSION_MAX_LENGTH,
  );

const decodedBytes = (dataUrl) => Math.floor(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);

/**
 * A JPEG data URL of what the user is looking at, or null when the capture
 * fails, times out or is larger than the backend accepts. The feedback layer
 * itself is left out.
 */
export const captureScreenshot = async () => {
  try {
    const { toJpeg } = await import('html-to-image');
    const capture = toJpeg(document.body, {
      quality: 0.7,
      pixelRatio: 1,
      backgroundColor: '#0d0b07',
      width: window.innerWidth,
      height: window.innerHeight,
      style: { transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)` },
      filter: (node) => !(node instanceof Element && node.closest('[data-feedback-layer]')),
    });
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Screenshot timed out.')), SCREENSHOT_TIMEOUT_MS);
    });
    const dataUrl = await Promise.race([capture, timeout]).finally(() => clearTimeout(timer));
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/jpeg')) return null;
    return decodedBytes(dataUrl) > SCREENSHOT_MAX_BYTES ? null : dataUrl;
  } catch {
    return null;
  }
};

/** The server's own wording for a refused or rate-limited send, else a generic line. */
export const describeSendFailure = (error) => {
  const status = error?.response?.status;
  const responseError = error?.response?.data?.error;
  const serverMessage = typeof responseError === 'string' ? responseError : responseError?.message;
  return (status === 400 || status === 429) && serverMessage ? serverMessage : SEND_FAILED_MESSAGE;
};

export const sendFeedback = async (body) => {
  await apiClient.post(getApiUrl('FEEDBACK'), body);
};
