(() => {
  if (window.__budgetBeaconInstalled) { window.dispatchEvent(new Event('budget-beacon-update')); return; }
  window.__budgetBeaconInstalled = true;
  let lastUrl = '', dismissedUrl = '', host = null, requestId = 0;
  function remove() { host?.remove(); host=null; }
  function render(data) {
    remove();
    if (!data || dismissedUrl === location.href) return;
    host = document.createElement('div');
    host.id = 'budget-beacon-banner';
    host.style.cssText = 'all:initial;position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:2147483647;width:min(720px,calc(100vw - 32px));';
    const shadow = host.attachShadow({mode:'closed'});
    const style = document.createElement('style');
    style.textContent = `*{box-sizing:border-box} .banner{font:14px/1.5 system-ui,sans-serif;background:#174c40;color:#fff;border:1px solid #477568;border-radius:16px;padding:16px 20px;box-shadow:0 8px 40px #0003;display:flex;align-items:center;gap:18px}.label{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:#d8e8dc}.amount{font-size:24px;font-weight:700;white-space:nowrap}.detail{color:#d8e8dc;font-size:12px}.copy{flex:1}.negative{background:#72392f;border-color:#9d645a}button{background:transparent;border:0;color:#fff;font-size:24px;cursor:pointer;padding:4px 8px} .error{font-size:14px;font-weight:600}@media(max-width:480px){.banner{gap:10px;padding:12px}.amount{font-size:20px}}`;
    shadow.append(style);
    const wrap = document.createElement('div'); wrap.className = 'banner'+(data.remaining<0?' negative':'');wrap.setAttribute('role','status');
    const copy = document.createElement('div');copy.className='copy';
    const label = document.createElement('div');label.className='label';label.textContent=(data.demo?'Demo · ':'')+'Budget Beacon';copy.append(label);
    const title = document.createElement('div');title.textContent=data.error || (data.missing?.length?'Budget unavailable for some selections':'Budget remaining for the month');copy.append(title);
    const detail = document.createElement('div'); detail.className='detail';
    if (data.error) { detail.textContent='Open the extension to connect or refresh.'; }
    else {
      const updated = new Date(data.syncedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
      detail.textContent=data.missing?.length ? `Check settings: ${data.missing.join(', ')}. A total would be incomplete.` : `${data.used.map(c=>c.name).join(' + ')} · ${data.stale?'Cached · ':''}updated ${updated}`;
    }
    copy.append(detail);wrap.append(copy);
    if (!data.error && !data.missing?.length) {
      const amount=document.createElement('div');amount.className='amount';amount.textContent=new Intl.NumberFormat(undefined,{style:'currency',currency:data.currency||'USD'}).format(data.remaining);wrap.append(amount);
    }
    const close=document.createElement('button');close.type='button';close.setAttribute('aria-label','Dismiss budget banner');close.textContent='×';close.addEventListener('click',()=>{dismissedUrl=location.href;remove();});wrap.append(close);
    shadow.append(wrap);document.documentElement.append(host);
  }
  async function update() {
    const id=++requestId, url=location.href;lastUrl=url;
    try {const reply=await browser.runtime.sendMessage({type:'banner',url});if(id===requestId && url===location.href) render(reply.ok?reply.data:null);}catch {remove();}
  }
  window.addEventListener('budget-beacon-update',update);
  browser.storage.onChanged.addListener(update);
  setInterval(()=>{if(lastUrl!==location.href) {dismissedUrl='';update();}},1000);
  setInterval(update,60000);
  update();
})();
