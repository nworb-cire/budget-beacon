const $=id=>document.getElementById(id);
let currentPage=null;
async function send(message) {
  const reply=await browser.runtime.sendMessage(message);
  if(!reply?.ok)throw new Error(reply?.error || 'The extension did not respond.');
  return reply.data;
}
function notice(message,error=false){$('popup-notice').hidden=false;$('popup-notice').textContent=message;$('popup-notice').className=error?'error':'';}
async function load(){
  const s=await send({type:'state'});
  const [tab]=await browser.tabs.query({active:true,currentWindow:true});
  try{currentPage=BudgetCore.parsePattern(tab?.url || '').label;}catch{currentPage=null;}
  const rules=s.rules.filter(r=>r.enabled&&BudgetCore.matchesRule(r,tab?.url));
  $('status').textContent=s.demo?'DEMO · Sample budget':s.auth?'Monarch connected':'Connect your Monarch budget';
  if(rules.length&&s.cache&&s.cache.month===BudgetCore.monthKey()){
    const sum=BudgetCore.total(s.cache.groups,[...new Set(rules.flatMap(r=>r.categoryIds))]);
    $('amount').textContent=sum.missing.length?'Unavailable':new Intl.NumberFormat(undefined,{style:'currency',currency:s.currency||'USD'}).format(sum.remaining);
    $('details').textContent=sum.missing.length?'Some categories have no separate budget. Check your selections.':`${sum.used.map(c=>c.name).join(' + ')} · remaining this month · updated ${new Date(s.cache.syncedAt).toLocaleTimeString()}`;
  }else{$('amount').textContent='';$('details').textContent=rules.length?'Refresh your budget in settings.':'No rule for this page.';}
  if(s.lastError)$('details').textContent+=' · Cached data: refresh failed.';
  $('page-actions').hidden=!currentPage || !(s.auth||s.demo);
  if(!currentPage)$('details').textContent='Open a regular website to add a page to a rule.';
  $('current-page').textContent=currentPage||'';
  const select=$('existing-rule');select.replaceChildren();
  for(const rule of s.rules){
    const option=document.createElement('option');option.value=rule.id;
    const contains=rule.patterns.some(p=>p.label===currentPage);
    option.textContent=(rule.name || rule.patterns.map(p=>p.label).join(', '))+(contains?' · already added':'')+(!rule.enabled?' · off':'');
    select.append(option);
  }
  if(!s.rules.length){const option=document.createElement('option');option.textContent='No rules yet';select.append(option);}
  select.disabled=!s.rules.length;$('attach-page').disabled=!s.rules.length;
}
$('attach-page').onclick=async()=>{
  const button=$('attach-page'),id=$('existing-rule').value,page=currentPage;
  if(!id||!page)return;
  button.disabled=true;button.textContent='Adding…';
  try{
    // Keep the permission request within the toolbar button's user gesture.
    const permission=browser.permissions.request({origins:BudgetCore.origins(BudgetCore.parsePattern(page))});
    notice('Allow Firefox website access to add this page.');
    if(!await permission)throw new Error('Website access was not allowed. Try again and allow access.');
    await send({type:'addPage',id,page});await load();notice('Page added to rule.');
  }catch(error){notice(error.message,true);}
  finally{button.disabled=false;button.textContent='Add page to rule';}
};
$('new-rule').onclick=async()=>{try{await send({type:'options',page:currentPage});window.close();}catch(error){notice(error.message,true);}};
$('settings').onclick=()=>browser.runtime.openOptionsPage();
load().catch(error=>notice(error.message,true));
