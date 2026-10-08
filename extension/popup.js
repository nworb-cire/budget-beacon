(async()=>{
  const reply=await browser.runtime.sendMessage({type:'state'}),s=reply.data;
  const [tab]=await browser.tabs.query({active:true,currentWindow:true});
  const rules=s.rules.filter(r=>r.enabled&&BudgetCore.matches(r.pattern,tab?.url));
  document.getElementById('status').textContent=s.demo?'DEMO · Sample budget':s.auth?'Monarch connected':'Connect your Monarch budget';
  if(rules.length&&s.cache&&s.cache.month===BudgetCore.monthKey()){
    const sum=BudgetCore.total(s.cache.groups,[...new Set(rules.flatMap(r=>r.categoryIds))]);
    document.getElementById('amount').textContent=sum.missing.length?'Unavailable':new Intl.NumberFormat(undefined,{style:'currency',currency:s.currency||'USD'}).format(sum.remaining);
    document.getElementById('details').textContent=sum.missing.length?'Some categories have no separate budget. Check your selections.':`${sum.used.map(c=>c.name).join(' + ')} · remaining this month · updated ${new Date(s.cache.syncedAt).toLocaleTimeString()}`;
  }else document.getElementById('details').textContent=rules.length?'Refresh your budget in settings.':'No budget rule for this page. Add one in settings.';
  if(s.lastError)document.getElementById('details').textContent+=' · Cached data: refresh failed.';
})().catch(()=>{document.getElementById('status').textContent='Open settings to reconnect.';});
document.getElementById('settings').onclick=()=>browser.runtime.openOptionsPage();
