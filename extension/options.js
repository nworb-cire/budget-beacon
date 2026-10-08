const $ = id=>document.getElementById(id);
let current, editingId=null, selected=new Set();
const money = amount=>new Intl.NumberFormat(undefined,{style:'currency',currency:current?.currency||'USD'}).format(amount);
function element(tag,className,text) {const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function notice(text,error=false) {$('notice').hidden=false;$('notice').textContent=text;$('notice').className=error?'error':'';}
async function action(fn,button) {
  if(button)button.disabled=true;
  try {await fn();await load();}catch(error){notice(error.message,true);}finally{if(button)button.disabled=false;}
}
async function load() {
  current=await UI.send({type:'state'});
  const connected=Boolean(current.auth||current.demo);
  $('connection-badge').textContent=current.demo?'Demo mode':current.auth?'Monarch connected':'Not connected';
  $('connection-badge').className='badge'+(connected?' active':'');
  $('connection-setup').hidden=connected;
  $('disconnect').hidden=!connected;
  $('sidebar-status').textContent=current.demo?'Demo data':current.auth?'Monarch connected':'Not connected';
  $('connected-actions').hidden=!connected;
  $('currency').value=current.currency||'USD';
  $('sync-label').textContent=current.cache?`${current.demo?'Demo · ':''}Updated ${new Date(current.cache.syncedAt).toLocaleString()}`:'No budget synced yet';
  $('rules').replaceChildren();
  if(!current.rules.length) {
    const empty=element('div','empty');empty.append(element('b',null,'No rules yet'));empty.append(element('span',null,'Add a rule to link pages to budget categories.'));$('rules').append(empty);
  }
  for(const rule of current.rules) renderRule(rule);
  if(current.lastError)notice(current.lastError,true);

}
function names(ids) {return (current.cache?.groups||[]).flatMap(g=>[{id:g.id,name:g.name},...g.categories]).filter(c=>ids.includes(c.id)).map(c=>c.name);}
function renderRule(rule) {
  const row=element('div','rule'+(!rule.enabled?' disabled':''));row.append(element('div','rule-icon','↗'));
  const main=element('div','rule-main');main.append(element('strong',null,rule.name || rule.patterns.map(p=>p.label).join(', ')));
  if(rule.name)main.append(element('small',null,rule.patterns.map(p=>p.label).join(' · ')));
  main.append(element('small',null,names(rule.categoryIds).join(' + ')||'Connect to load categories'));row.append(main);
  const result=current.cache && current.cache.month===BudgetCore.monthKey()?BudgetCore.total(current.cache.groups,rule.categoryIds):null;
  row.append(element('div','rule-total'+(result?.remaining<0?' negative':''),result&&!result.missing.length?money(result.remaining):'—'));
  const actions=element('div','rule-actions');
  const toggle=element('button','toggle',rule.enabled?'On':'Off');toggle.type='button';toggle.setAttribute('aria-label',`${rule.enabled?'Disable':'Enable'} ${rule.name || rule.patterns[0]?.label}`);toggle.onclick=()=>action(()=>UI.send({type:'toggleRule',id:rule.id}),toggle);
  const edit=element('button',null,'Edit');edit.type='button';edit.onclick=()=>openEditor(rule);
  const remove=element('button',null,'Delete');remove.type='button';remove.onclick=()=>action(async()=>{await UI.send({type:'deleteRule',id:rule.id});if(editingId===rule.id)$('rule-editor').hidden=true;},remove);
  actions.append(toggle,edit,remove);row.append(actions);$('rules').append(row);
}
function openEditor(rule, page) {
  if(!current.cache){notice('Connect Monarch or try demo data to choose your categories.',true);return;}
  editingId=rule?.id||null;selected=new Set(rule?.categoryIds||[]);$('rule-notice').hidden=true;
  $('editor-title').textContent=rule?'Edit rule':'Add rule';$('rule-name').value=rule?.name||'';
  $('pages').replaceChildren();
  const pages=rule?rule.patterns.map(p=>p.label):[page||''];
  for(const value of pages)addPageInput(value);
  $('category-search').value='';$('rule-editor').hidden=false;
  renderCategories();$('rule-editor').scrollIntoView({behavior:'smooth',block:'center'});$('pages').querySelector('input').focus();
}
function renderCategories() {
  $('categories').replaceChildren();const filter=$('category-search').value.toLowerCase();
  function checkbox(item,parent=false,disabled=false) {
    const label=element('label',parent?'parent':'child'),input=document.createElement('input');input.type='checkbox';input.value=item.id;input.checked=selected.has(item.id);input.disabled=disabled;
    input.onchange=()=>{if(input.checked)selected.add(item.id);else selected.delete(item.id);$('selection-count').textContent=`${selected.size} selected`;};
    label.append(input,element('span',null,item.name),element('span','balance',item.remaining===null?'No separate budget':money(item.remaining)));return label;
  }
  for(const group of current.cache.groups) {
    const children=group.categories.filter(c=>c.name.toLowerCase().includes(filter)||group.name.toLowerCase().includes(filter));
    if(!children.length&&!group.name.toLowerCase().includes(filter))continue;
    const block=element('div','category-group');block.append(checkbox(group,true));
    for(const c of children)block.append(checkbox(c,false,group.groupBudget&&c.remaining===null));
    if(group.groupBudget)block.append(element('div','field-help','Monarch budgets this group as a whole. Select the group for its available balance.'));
    $('categories').append(block);
  }
  if(!$('categories').children.length)$('categories').append(element('div','field-help','No matching categories.'));
  $('selection-count').textContent=`${selected.size} selected`;
}
function addPageInput(value='') {
  const row=element('div','page-row'), input=document.createElement('input');
  input.value=value;input.placeholder='walmart.com/cart';input.setAttribute('aria-label','Website and page');
  const remove=element('button','link-button','Remove');remove.type='button';
  remove.onclick=()=>{row.remove();if(!$('pages').children.length)addPageInput();};
  row.append(input,remove);$('pages').append(row);
}
$('add-page').onclick=()=>addPageInput();
$('demo').onclick=e=>action(async()=>{await UI.send({type:'demo'});notice('Demo mode enabled. These are sample balances, not your Monarch budget.');},e.currentTarget);
$('browser-connect').onclick=e=>action(async()=>{await UI.send({type:'connect',mode:'cookie'});notice('Connected to your Monarch browser session.');$('login-form').hidden=true;},e.currentTarget);
$('show-login').onclick=()=>{$('login-form').hidden=!$('login-form').hidden;};
$('login-form').onsubmit=e=>{e.preventDefault();const password=$('password').value,code=$('mfa').value;$('password').value='';$('mfa').value='';action(async()=>{await UI.send({type:'connect',mode:'token',email:$('email').value,password,code});$('login-form').hidden=true;notice('Monarch connected. Your password was not saved.');},e.submitter);};
$('disconnect').onclick=e=>action(async()=>{await UI.send({type:'disconnect'});$('rule-editor').hidden=true;notice('Disconnected. Saved website rules are kept; cached budget and credentials are removed.');},e.currentTarget);
$('refresh').onclick=e=>action(async()=>{await UI.send({type:'refresh'});notice('Budget refreshed.');},e.currentTarget);
$('currency').onchange=()=>action(()=>UI.send({type:'currency',currency:$('currency').value}));
$('add-rule').onclick=()=>openEditor();$('cancel-rule').onclick=()=>{$('rule-editor').hidden=true;};$('category-search').oninput=renderCategories;
function ruleNotice(text,error=false) {
  const target=$('rule-notice');target.hidden=false;target.textContent=text;
  target.className=error?'error':'';target.setAttribute('role',error?'alert':'status');
  target.scrollIntoView({behavior:'smooth',block:'nearest'});
}
$('rule-form').onsubmit=async e=>{
  e.preventDefault();
  const button=$('save-rule');
  if(button.disabled)return;
  let patterns;
  try {
    patterns=BudgetCore.parsePages([...$('pages').querySelectorAll('input')].map(input=>input.value));
    if(!selected.size)throw new Error('Select at least one group or category.');
  }catch(error){ruleNotice(error.message,true);return;}
  const rule={type:'saveRule',id:editingId,name:$('rule-name').value,pages:patterns.map(p=>p.label),categoryIds:[...selected]};
  button.disabled=true;button.textContent='Saving…';
  try {
    // Start the permission request inside the submit gesture, before any await.
    const permission=UI.grant(patterns);
    ruleNotice('Waiting for website access. Allow the Firefox permission prompt to continue.');
    if(!await permission)throw new Error('Website access was not allowed. Click Save rule again and allow Firefox access.');
    ruleNotice('Saving your website…');
    await UI.send(rule);
    await load();
    $('rule-editor').hidden=true;
    notice('Rule saved.');
    $('rules').scrollIntoView({behavior:'smooth',block:'nearest'});
  }catch(error){ruleNotice(error.message,true);}
  finally{button.disabled=false;button.textContent='Save rule';}
};
let pendingPage=new URLSearchParams(location.search).get('page');
const originalLoad=load;
load=async()=>{
  await originalLoad();
  if(pendingPage && current.cache){const page=pendingPage;pendingPage=null;openEditor(null,page);}
};
load().catch(e=>notice(e.message,true));
