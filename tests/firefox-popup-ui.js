(async()=>{
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  try{
    for(let i=0;i<40&&document.getElementById('page-actions').hidden;i++)await pause(100);
    if(document.getElementById('page-actions').hidden)throw new Error('Current-page actions are hidden');
    if(document.getElementById('current-page').textContent!=='localhost:4174/cart/checkout')throw new Error('Popup did not capture the active website');
    document.getElementById('existing-rule').value='multi';
    // Synthetic test clicks cannot trigger a native permission prompt. The test
    // manifest grants localhost already; mock only that user-consent boundary.
    browser.permissions.request=async request=>request.origins.every(origin=>['http://localhost/*','https://localhost/*'].includes(origin));
    document.getElementById('attach-page').click();
    for(let i=0;i<40&&document.getElementById('popup-notice').textContent!=='Page added to rule.';i++)await pause(100);
    const reply=await browser.runtime.sendMessage({type:'state'}),rule=reply.data.rules.find(r=>r.id==='multi');
    const passed=rule.patterns.some(p=>p.label==='localhost:4174/cart/checkout') && rule.categoryIds.length===1 && !rule.enabled && document.getElementById('popup-notice').textContent==='Page added to rule.';
    await browser.runtime.sendMessage({type:'smoke-popup',passed});
  }catch(error){await browser.runtime.sendMessage({type:'smoke-popup',passed:false,error:error.message});}
})();
