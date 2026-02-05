const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'dist', 'public', 'index.html');

if (!fs.existsSync(htmlPath)) {
  console.log('No built index.html found, skipping Capacitor build fix');
  process.exit(0);
}

let html = fs.readFileSync(htmlPath, 'utf8');

html = html.replace(/ crossorigin/g, '');

html = html.replace(
  /<link([^>]*?)href="https:\/\/fonts\.googleapis\.com[^"]*"([^>]*?)>/,
  (match) => {
    if (match.includes('media="print"')) return match;
    return match.replace('rel="stylesheet"', 'rel="stylesheet" media="print" onload="this.media=\'all\'"');
  }
);

fs.writeFileSync(htmlPath, html);
console.log('Capacitor build fix applied: removed crossorigin, made fonts non-blocking');
