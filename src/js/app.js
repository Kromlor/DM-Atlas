/* Boot. */
'use strict';
(function boot() {
  Sync.init();
  const meta = Meta.get();
  const rawMeta = LS.get(K.meta, null);
  let cid = meta.activeCampaignId;
  /* Upgrade path: older copies defaulted to Hollowmere without storing the choice. Keep such a DM's saved progress active. */
  if (!(rawMeta && 'activeCampaignId' in rawMeta) && LS.get(K.camp('hollowmere-year-one'), null)) { cid = 'hollowmere-year-one'; Meta.set({ activeCampaignId: cid }, false); }
  if (cid && !Library.get(cid)) { cid = null; Meta.set({ activeCampaignId: null }, false); }
  Store.load(cid);
  Sync.on(msg => {
    if (msg.t === 'state') { if (msg.cid && msg.cid !== (Store.cid || NO_CAMP)) return; Store.fresh(); AttackFlow.onRemote(); softRefresh(); }
    else if (msg.t === 'meta') { const m = Meta.get(); if ((m.activeCampaignId || null) !== Store.cid && (!m.activeCampaignId || Library.get(m.activeCampaignId))) { Store.load(m.activeCampaignId); closeAllModals(); } renderChrome(); softRefresh(); }
    else if (msg.t === 'library') { App._idx = null; if (Store.cid && !Library.get(Store.cid)) { Store.load(null); Meta.set({ activeCampaignId: null }, false); } renderChrome(); softRefresh(); }
  });
  window.addEventListener('hashchange', onRoute);
  onRoute();
  window.DMAtlas = { Store, Rules, Combat, AttackFlow, SaveUI, Library, Meta, Sync, sanitizeHTML, mdToHTML, splitByHeadings, validateSave, buildSave, importCampaignJSON, parseImportFile, importPreview, importDocs, CAMPAIGN_TEMPLATE, hpAdjust, editCharacter, buildCampaignFromDocs, switchCampaign, go, WIN_ID };
})();
