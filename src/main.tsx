import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { captureGoogleAnswer } from './lib/googleRedirect';
import { festivity } from './lib/festive';

// Back from the Google sign-in of the installed app: take the answer out of the address first
captureGoogleAnswer();

// Seasonal decorations live in CSS under this attribute
if (festivity) document.documentElement.dataset.festa = festivity;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
