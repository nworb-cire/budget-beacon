(async()=>{
  const report=[];
  const check=(condition,name)=>{if(!condition)throw new Error(name);report.push(name);};
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  let tab;
  try {
    await pause(500);
    await browser.storage.local.set({auth:null,demo:true,cache:BudgetCore.demo(),lastError:null,rules:[{id:'smoke',pattern:BudgetCore.parsePattern('localhost:4174/cart'),categoryIds:['group:food','category:groceries'],enabled:true}]});
    await configureScripts();
    tab=await browser.tabs.create({url:'http://localhost:4174/cart?smoke=1'});
    let found=false;
    for(let i=0;i<40;i++){await pause(250);try{const [value]=await browser.tabs.executeScript(tab.id,{code:"Boolean(document.getElementById('budget-beacon-banner'))"});if(value){found=true;break;}}catch{}}
    check(found,'Banner injected on matching page with query parameters');
    const payload=await banner('http://localhost:4174/cart?smoke=1');
    check(payload.remaining===466.17&&payload.demo,'Group and child counted once in real Firefox background');
    const [blocked]=await browser.tabs.executeScript(tab.id,{code:"browser.runtime.sendMessage({type:'state'}).then(reply => reply.ok === false)"});
    check(blocked,'Content script cannot read account state or credentials');
    const [valid]=await browser.tabs.executeScript(tab.id,{code:"browser.runtime.sendMessage({type:'banner',url:location.href}).then(reply => reply.ok && reply.data.remaining === 466.17)"});
    check(valid,'Content script receives only its display payload');
    await browser.tabs.executeScript(tab.id,{code:"history.pushState({},'', '/account')"});await pause(1500);
    const [removed]=await browser.tabs.executeScript(tab.id,{code:"!document.getElementById('budget-beacon-banner')"});
    check(removed,'SPA navigation away removes banner');
    await browser.tabs.executeScript(tab.id,{code:"history.pushState({},'', '/cart/checkout')"});await pause(1500);
    const [returned]=await browser.tabs.executeScript(tab.id,{code:"Boolean(document.getElementById('budget-beacon-banner'))"});
    check(returned,'SPA navigation back restores banner');
    const old=BudgetCore.demo('2000-01-01');await browser.storage.local.set({cache:old,auth:null,demo:false});
    const expired=await banner('http://localhost:4174/cart');check(Boolean(expired.error)&&expired.remaining===undefined,'Previous-month balance is never displayed');
    await browser.storage.local.set({demo:true,auth:{mode:'token',token:'smoke-test-secret'},cache:BudgetCore.demo()});
    let settingsPassed=false, optionsPassed=false, popupPassed=false, settingsError=null, popupError=null;
    browser.runtime.onMessage.addListener(message=>{if(message.type==='smoke-result'){settingsPassed=message.passed;settingsError=message.error;}if(message.type==='smoke-options')optionsPassed=message.passed;if(message.type==='smoke-popup'){popupPassed=message.passed;popupError=message.error;}});
    const settings=await browser.tabs.create({url:browser.runtime.getURL('smoke-settings.html')});
    for(let i=0;i<20&&!settingsPassed;i++)await pause(250);
    check(settingsPassed,'Many-to-many saves, existing-rule attachment, legacy migration and credential redaction'+(settingsError?' ('+settingsError+')':''));
    for(let i=0;i<20&&!optionsPassed;i++)await pause(250);
    check(optionsPassed,'New-rule page is prefilled; connection setup and promotional sections are hidden');
    await browser.tabs.update(tab.id,{active:true});
    await browser.tabs.create({url:browser.runtime.getURL('popup.html'),active:false});
    for(let i=0;i<25&&!popupPassed;i++)await pause(250);
    check(popupPassed,'Popup captures active page and adds it to the chosen existing rule'+(popupError?' ('+popupError+')':''));
    await fetch('http://localhost:4174/report',{method:'POST',body:JSON.stringify({ok:true,checks:report})});
  }catch(error){await fetch('http://localhost:4174/report',{method:'POST',body:JSON.stringify({ok:false,checks:report,error:error.message})});}
})();
