import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './bootstrap-subset.scss';
import App from './App';
import './theme.css';
import { initErrorReporting } from './errorReporting';
import { captureFirstTouch } from './attribution/firstTouch';
import { listenForMissingAssets } from './staleBuild';

initErrorReporting();
listenForMissingAssets();
// Before the router: unknown routes redirect to `/` and drop the query string.
captureFirstTouch();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The application root element is missing from the document.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
