(async()=>{
  if(!new URLSearchParams(location.search).has('page'))return;
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  for(let i=0;i<40;i++){
    await pause(100);
    if(document.getElementById('rule-editor').hidden)continue;
    const passed=document.getElementById('connection-setup').hidden && !document.getElementById('disconnect').hidden && document.querySelector('#pages input')?.value==='localhost:4174/prefilled' && !document.querySelector('.preview-section') && !document.querySelector('.nav-active');
    await browser.runtime.sendMessage({type:'smoke-options',passed});return;
  }
  await browser.runtime.sendMessage({type:'smoke-options',passed:false});
})();
