let syncing = null;
let registrations = [];
const initialState = {rules:[],auth:null,cache:null,lastError:null,demo:false,currency:'USD'};
async function state() { return {...initialState,...await browser.storage.local.get(Object.keys(initialState))}; }
async function refresh() {
  if (syncing) return syncing;
  syncing = (async()=> {
    const s = await state();
    if (!s.auth && !s.demo) throw new Error('Connect Monarch or enable demo mode first.');
    try {
      const cache = s.demo ? BudgetCore.demo() : await Monarch.budgets(s.auth);
      // Do not restore data if the user disconnects while a request is in flight.
      const current = await state();
      if (JSON.stringify(current.auth) !== JSON.stringify(s.auth) || current.demo !== s.demo) return;
      await browser.storage.local.set({cache,lastError:null});
    } catch(error) { await browser.storage.local.set({lastError:error.message}); throw error; }
  })().finally(()=>{syncing=null;});
  return syncing;
}
async function configureScripts() {
  for (const r of registrations) await r.unregister();
  registrations = [];
  const s = await state();
  const hosts = [...new Set(s.rules.filter(r=>r.enabled).flatMap(r=>BudgetCore.origins(r.pattern)))];
  for (const origin of hosts) {
    if (await browser.permissions.contains({origins:[origin]})) {
      registrations.push(await browser.contentScripts.register({matches:[origin],js:[{file:'content.js'}],runAt:'document_idle'}));
    }
  }
  // Apply newly saved rules to already open pages as well as future navigations.
  for (const tab of await browser.tabs.query({})) {
    if (!tab.id || !s.rules.some(r=>r.enabled && BudgetCore.matches(r.pattern,tab.url))) continue;
    try { await browser.tabs.executeScript(tab.id,{file:'content.js'}); } catch { /* Restricted browser pages cannot be injected. */ }
  }
}
async function banner(href) {
  let s = await state();
  const rules = s.rules.filter(r=>r.enabled && BudgetCore.matches(r.pattern,href));
  if (!rules.length) return null;
  if (!s.cache || s.cache.month !== BudgetCore.monthKey() || Date.now()-s.cache.syncedAt > 15*60000) {
    try { await refresh(); } catch { /* Keep same-month cached data clearly marked. */ }
    s = await state();
  }
  if (!s.cache || s.cache.month !== BudgetCore.monthKey()) return {error:s.lastError || 'Connect Monarch in Budget Beacon settings.',demo:s.demo};
  const result = BudgetCore.total(s.cache.groups,[...new Set(rules.flatMap(r=>r.categoryIds))]);
  return {...result,month:s.cache.month,syncedAt:s.cache.syncedAt,stale:Boolean(s.lastError) || Date.now()-s.cache.syncedAt>15*60000,demo:s.demo,currency:s.currency};
}
function privileged(sender) { return sender.id === browser.runtime.id && sender.url?.startsWith(browser.runtime.getURL(''));  }
browser.runtime.onMessage.addListener(async (message,sender) => {
  try {
    if (message.type === 'banner') {
      // A content script can request only its own page's display data, never account state.
      if (!sender.tab || new URL(sender.url).origin !== new URL(message.url).origin) return {ok:false,error:'Invalid page request.'};
      return {ok:true,data:await banner(message.url)};
    }
    if (!privileged(sender)) return {ok:false,error:'This action is available only in extension settings.'};
    switch(message.type) {
      case 'state': {
        const s = await state();
        return {ok:true,data:{...s,auth:s.auth?{mode:s.auth.mode}:null}};
      }
      case 'connect': {
        const auth = message.mode === 'cookie' ? {mode:'cookie'} : await Monarch.login(message.email,message.password,message.code);
        const cache = await Monarch.budgets(auth);
        await browser.storage.local.set({auth,cache,demo:false,lastError:null});
        break;
      }
      case 'demo': await browser.storage.local.set({auth:null,demo:true,cache:BudgetCore.demo(),lastError:null}); break;
      case 'disconnect': await browser.storage.local.set({auth:null,demo:false,cache:null,lastError:null}); break;
      case 'refresh': await refresh(); break;
      case 'saveRule': {
        const s = await state(), pattern = BudgetCore.parsePattern(message.page);
        if (!await browser.permissions.contains({origins:BudgetCore.origins(pattern)})) throw new Error('Website permission was not granted. Save again and allow access.');
        const valid = new Set((s.cache?.groups||[]).flatMap(g=>[g.id,...g.categories.map(c=>c.id)]));
        const categoryIds = [...new Set(message.categoryIds)].filter(id=>valid.has(id));
        if (!categoryIds.length) throw new Error('Select at least one budget group or category.');
        const rule = {id:message.id || crypto.randomUUID(),pattern,categoryIds,enabled:true};
        const rules = s.rules.filter(r=>r.id!==rule.id);
        rules.push(rule);
        await browser.storage.local.set({rules});
        await configureScripts();
        break;
      }
      case 'deleteRule': case 'toggleRule': {
        const s = await state();
        const rules = message.type === 'deleteRule' ? s.rules.filter(r=>r.id!==message.id) : s.rules.map(r=>r.id===message.id?{...r,enabled:!r.enabled}:r);
        await browser.storage.local.set({rules}); await configureScripts(); break;
      }
      case 'currency': {
        if (!['USD','CAD'].includes(message.currency)) throw new Error('Unsupported currency.');
        await browser.storage.local.set({currency:message.currency}); break;
      }
      case 'options': await browser.runtime.openOptionsPage(); break;
      default: throw new Error('Unknown extension action.');
    }
    return {ok:true};
  } catch(error) { return {ok:false,error:error.message}; }
});
browser.alarms.create('budget-refresh',{periodInMinutes:15});
browser.alarms.onAlarm.addListener(async()=>{const s=await state();if(s.auth||s.demo) await refresh().catch(()=>{});});
browser.permissions.onRemoved.addListener(()=>configureScripts().catch(()=>{}));
configureScripts().catch(()=>{});

browser.runtime.onInstalled.addListener(details=>{if(details.reason==='install')browser.runtime.openOptionsPage();});
