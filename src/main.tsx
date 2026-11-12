import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './fonts.css';
import './index.css';
import { captureGoogleAnswer } from './lib/googleRedirect';
import { holiday, showHoliday } from './lib/holiday';

// Back from the Google sign-in of the installed app: take the answer out of the address first
captureGoogleAnswer();

// Seasonal decorations live in CSS under this attribute
showHoliday(holiday);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// The site's files stay in the browser, to open without network (see public/sw.js). Not while
// developing: the dev server's files change under the same names.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(() => {});
    // At the first visit the files were loaded before the worker: it is told which, to keep them
    navigator.serviceWorker.ready
      .then((reg) => {
        const own = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((u) => u.startsWith(location.origin) && !u.endsWith('/sw.js'));
        reg.active?.postMessage({ keep: [location.origin + location.pathname, ...own] });
      })
      .catch(() => {});
  });
}
