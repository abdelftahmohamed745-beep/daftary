'use strict';

// Apply the saved theme before first paint to avoid a flash.
try {
  var theme = localStorage.getItem('daftary-theme');
  if (!theme) {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
} catch (error) {
  /* localStorage may be unavailable — fall back to the light theme */
}
