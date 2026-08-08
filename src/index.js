import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import App from './App';
import './theme.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The application root element is missing from the document.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
