import { useEffect } from 'react';
import { DEFAULT_TITLE } from './linkPreview';

/** Name the tab after what is on screen, and hand the default back on leaving. */
const useDocumentTitle = (title) => {
  useEffect(() => {
    document.title = title ?? DEFAULT_TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
};

export default useDocumentTitle;
