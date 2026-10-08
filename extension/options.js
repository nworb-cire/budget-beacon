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
  $('connection-summary').textContent=current.demo?'You’re exploring with sample balances. Connect Monarch when you’re ready.':current.auth?'Your monthly budget is connected. Refresh anytime to bring in the latest spending.':'Connect your account to see this month’s categories and remaining balances.';
  $('connected-actions').hidden=!connected;
  $('currency').value=current.currency||'USD';
  $('sync-label').textContent=current.cache?`${current.demo?'Demo · ':''}Updated ${new Date(current.cache.syncedAt).toLocaleString()}`:'No budget synced yet';
  $('rules').replaceChildren();
  if(!current.rules.length) {
    const empty=element('div','empty');empty.append(element('b',null,'Your next checkout, with a little context.'));empty.append(element('span',null,'Add your first website to keep your budget in sight.'));$('rules').append(empty);
  }
  for(const rule of current.rules) renderRule(rule);
  if(current.lastError)notice(current.lastError,true);
  preview(current.rules.find(r=>r.enabled));
}
function names(ids) {return (current.cache?.groups||[]).flatMap(g=>[{id:g.id,name:g.name},...g.categories]).filter(c=>ids.includes(c.id)).map(c=>c.name);}
function renderRule(rule) {
  const row=element('div','rule'+(!rule.enabled?' disabled':''));row.append(element('div','rule-icon','↗'));
  const main=element('div','rule-main');main.append(element('strong',null,rule.pattern.label));main.append(element('small',null,names(rule.categoryIds).join(' + ')||'Connect to load categories'));row.append(main);
  const result=current.cache && current.cache.month===BudgetCore.monthKey()?BudgetCore.total(current.cache.groups,rule.categoryIds):null;
  row.append(element('div','rule-total'+(result?.remaining<0?' negative':''),result&&!result.missing.length?money(result.remaining):'—'));
  const actions=element('div','rule-actions');
  const toggle=element('button','toggle',rule.enabled?'On':'Off');toggle.type='button';toggle.setAttribute('aria-label',`${rule.enabled?'Disable':'Enable'} ${rule.pattern.label}`);toggle.onclick=()=>action(()=>UI.send({type:'toggleRule',id:rule.id}),toggle);
  const edit=element('button',null,'Edit');edit.type='button';edit.onclick=()=>openEditor(rule);
  const remove=element('button',null,'Delete');remove.type='button';remove.onclick=()=>action(async()=>{await UI.send({type:'deleteRule',id:rule.id});if(editingId===rule.id)$('rule-editor').hidden=true;},remove);
  actions.append(toggle,edit,remove);row.append(actions);$('rules').append(row);
}
function openEditor(rule) {
  if(!current.cache){notice('Connect Monarch or try demo data to choose your categories.',true);return;}
  editingId=rule?.id||null;selected=new Set(rule?.categoryIds||[]);$('rule-notice').hidden=true;
  $('editor-title').textContent=rule?'Edit website':'Add a website';$('page').value=rule?.pattern.label||'';$('category-search').value='';$('rule-editor').hidden=false;
  renderCategories();$('rule-editor').scrollIntoView({behavior:'smooth',block:'center'});$('page').focus();
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
function preview(rule) {
  $('preview-url').textContent=rule?.pattern.label||'walmart.com/cart';
  const result=rule&&current.cache?BudgetCore.total(current.cache.groups,rule.categoryIds):null;
  $('preview-kicker').textContent=result?(current.demo?'BANNER PREVIEW · DEMO DATA':'BANNER PREVIEW'):'BANNER PREVIEW · EXAMPLE';
  $('preview-amount').textContent=result&&!result.missing.length?money(result.remaining):result?'Unavailable':'$412.42';
  $('preview-categories').textContent=result?(result.missing.length?`Missing: ${result.missing.join(', ')}`:result.used.map(c=>c.name).join(' + ')):'Groceries';
}
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
  let pattern;
  try {
    if(!$('page').value.trim())throw new Error('Enter a website and page, such as walmart.com/cart.');
    pattern=BudgetCore.parsePattern($('page').value);
    if(!selected.size)throw new Error('Select at least one group or category.');
  }catch(error){ruleNotice(error.message,true);return;}
  const rule={type:'saveRule',id:editingId,page:pattern.label,categoryIds:[...selected]};
  button.disabled=true;button.textContent='Saving…';
  try {
    // Start the permission request inside the submit gesture, before any await.
    const permission=UI.grant(pattern);
    ruleNotice('Waiting for website access. Allow the Firefox permission prompt to continue.');
    if(!await permission)throw new Error('Website access was not allowed. Click Save website again and allow Firefox access.');
    ruleNotice('Saving your website…');
    await UI.send(rule);
    await load();
    $('rule-editor').hidden=true;
    notice('Website saved. The banner will appear on matching pages.');
    $('rules').scrollIntoView({behavior:'smooth',block:'nearest'});
  }catch(error){ruleNotice(error.message,true);}
  finally{button.disabled=false;button.textContent='Save website';}
};
load().catch(e=>notice(e.message,true));
