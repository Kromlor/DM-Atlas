const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1366, height: 768 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load' });
  const routes = ['screen','guide/campaign','guide/lessons','guide/course','guide/adventure','guide/roll','rules/spells','rules/cantrips','rules/weapons','rules/glossary','rules/rulings','rules/monsters','rules/credits','combat/party','combat/tracker','combat/log','tools/dice','tools/events','tools/npcs','tools/notes','tools/save','campaigns'];
  for (const r of routes) { await p.evaluate(r => location.hash = '#/' + r, r); await new Promise(r => setTimeout(r, 150)); const t = await p.evaluate(() => document.querySelector('#view').innerText.slice(0, 80).replace(/\n/g, ' ')); console.log(r, '|', t); }
  console.log('ERRORS', errs);
  await b.close();
})();
