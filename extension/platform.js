/* Firefox MV2 and Safari MV3 share the same rules and banner implementation. */
const ScriptPlatform = (()=>{
  let registrations=[], queue=Promise.resolve();
  async function execute(tabId) {
    if(browser.runtime.getManifest().manifest_version===2) return browser.tabs.executeScript(tabId,{file:'content.js'});
    return browser.scripting.executeScript({target:{tabId},files:['content.js']});
  }
  function configure(hosts,tabs) {
    const task=queue.catch(()=>{}).then(async()=>{
      const allowed=[];
      for(const origin of hosts)if(await browser.permissions.contains({origins:[origin]}))allowed.push(origin);
      if(browser.runtime.getManifest().manifest_version===2){
        for(const registration of registrations)await registration.unregister();
        registrations=[];
        if(allowed.length)registrations.push(await browser.contentScripts.register({matches:allowed,js:[{file:'content.js'}],runAt:'document_idle'}));
      }else{
        // Safari background workers can restart. Discover registrations rather
        // than relying on process-local handles or registering duplicates.
        const previous=await browser.scripting.getRegisteredContentScripts();
        if(previous.some(script=>script.id==='budget-beacon-pages'))await browser.scripting.unregisterContentScripts({ids:['budget-beacon-pages']});
        if(allowed.length)await browser.scripting.registerContentScripts([{id:'budget-beacon-pages',matches:allowed,js:['content.js'],runAt:'document_idle',persistAcrossSessions:true}]);
      }
      for(const tabId of tabs){try{await execute(tabId);}catch{/* A tab may close or revoke access while saving. */}}
    });
    queue=task;return task;
  }
  return {configure};
})();
