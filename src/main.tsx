import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
// Ensure logger is initialized (will show startup info in console)
import './lib/logger';

console.log(
  '%c🦞 OpenClaw Manager  Starting',
  'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 16px; padding: 8px 16px; border-radius: 4px; font-weight: bold;'
);
console.log(
  '%cTip: Open Developer Tools (Cmd+Option+I / Ctrl+Shift+I) to view detailed logs',
  'color: #888; font-size: 12px;'
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
