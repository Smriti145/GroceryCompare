const fs = require('node:fs');
const path = require('node:path');
const apiBaseUrl = process.env.API_BASE_URL || '';
const defaultLocation = process.env.DEFAULT_LOCATION || '';
if (apiBaseUrl) {
  const url = new URL(apiBaseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('API_BASE_URL must be an HTTP(S) URL without credentials, query, or fragment');
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('Production requires HTTPS');
}
if (process.env.NODE_ENV === 'production' && !apiBaseUrl) {
  throw new Error('Production requires API_BASE_URL');
}
if (defaultLocation && !/^[1-9][0-9]{5}$/.test(defaultLocation)) throw new Error('DEFAULT_LOCATION must be a six-digit pincode or empty');
fs.writeFileSync(path.join(__dirname, '../src/config/runtime.json'), JSON.stringify({ apiBaseUrl: apiBaseUrl.replace(/\/$/, ''), defaultLocation }, null, 2) + '\n');
console.log('Mobile configuration generated (public settings only).');
