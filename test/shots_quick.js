const H = require('./helpers');
(async () => {
  const b = await H.launch(); const p = await H.page(b);
  await H.seedParty(p, 4); await H.go(p, 'screen'); await p.screenshot({ path: '/tmp/q-main.png' });
  await H.go(p, 'combat/party'); await p.screenshot({ path: '/tmp/q-p4.png' });
  await H.seedParty(p, 6); await H.go(p, 'combat/tracker'); await H.go(p, 'combat/party'); await p.screenshot({ path: '/tmp/q-p6.png' });
  console.log(p._errors); await b.close();
})();
