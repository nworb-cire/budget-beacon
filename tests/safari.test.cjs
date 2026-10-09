const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {build}=require('../scripts/build-safari.cjs');
test('Safari bundle is MV3 with native messaging, current-page access, and shared features',()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'beacon-safari-test-'));
  try{
    build(output);const manifest=JSON.parse(fs.readFileSync(path.join(output,'manifest.json')));
    assert.equal(manifest.manifest_version,3);assert.equal(manifest.browser_specific_settings,undefined);assert.equal(manifest.browser_action,undefined);
    assert.ok(manifest.permissions.includes('nativeMessaging'));assert.ok(manifest.permissions.includes('activeTab'));assert.ok(!manifest.permissions.includes('webRequestBlocking'));
    assert.equal(manifest.action.default_popup,'popup.html');assert.equal(manifest.background.service_worker,'safari-worker.js');
    assert.deepEqual(manifest.optional_host_permissions,['http://*/*','https://*/*']);
    for(const file of ['safari-worker.js','safari-transport.js','platform.js','options.html','popup.html','content.js'])assert.ok(fs.existsSync(path.join(output,file)));
  }finally{fs.rmSync(output,{recursive:true,force:true});}
});
function transport(handler){let message;
  const ctx=vm.createContext({AbortSignal,BudgetCore:require('../extension/core.js'),browser:{runtime:{sendNativeMessage:async(host,value)=>{assert.equal(host,'local.budgetbeacon');message=value;return handler(value);}},cookies:{get:async({name})=>({value:name==='csrftoken'?'test-csrf':'test-session'})}}});
  vm.runInContext(fs.readFileSync('safari/transport.js','utf8'),ctx);
  vm.runInContext(fs.readFileSync('extension/monarch.js','utf8')+'\nglobalThis.api=Monarch;',ctx);
  return {ctx,getMessage:()=>message};
}
test('Safari cookie auth uses native transport and never registers Firefox request hooks',async()=>{
  const {ctx,getMessage}=transport(message=>{assert.equal(message.path,'/graphql');return {status:200,data:{data:{categoryGroups:[],budgetData:{monthlyAmountsByCategory:[]}}}};});
  const cache=await ctx.api.budgets({mode:'cookie'});
  assert.equal(cache.groups.length,0);const message=getMessage();assert.equal(message.headers.Cookie,'session_id=test-session; csrftoken=test-csrf');assert.equal(message.headers['X-CSRFToken'],'test-csrf');assert.equal(message.headers['X-Budget-Beacon-Cookie-Mode'],undefined);
});
test('Safari native login preserves MFA and server error handling',async()=>{
  const {ctx,getMessage}=transport(()=>({status:200,data:{token:'test-session-token'}}));
  const auth=await ctx.api.login('user@example.test','example-secret','123456');
  assert.equal(auth.token,'test-session-token');assert.equal(getMessage().body.totp,'123456');assert.equal(getMessage().headers.Cookie,undefined);
  const blocked=transport(()=>({status:403,data:{error_code:'CAPTCHA_REQUIRED'}}));
  await assert.rejects(()=>blocked.ctx.api.login('user@example.test','secret'),/CAPTCHA/);
});
test('Safari script registrations recover after worker restart and use supported injection API',async()=>{
  const calls=[],scripts=[{id:'other-extension-script'},{id:'budget-beacon-pages'}];
  const ctx=vm.createContext({browser:{runtime:{getManifest:()=>({manifest_version:3})},permissions:{contains:async({origins})=>!origins[0].includes('denied.test')},tabs:{},scripting:{getRegisteredContentScripts:async()=>scripts,unregisterContentScripts:async value=>calls.push(['unregister',value]),registerContentScripts:async value=>calls.push(['register',value]),executeScript:async value=>calls.push(['execute',value])}}});
  vm.runInContext(fs.readFileSync('extension/platform.js','utf8')+'\nglobalThis.api=ScriptPlatform;',ctx);
  await ctx.api.configure(['https://shop.test/*','https://denied.test/*'],[42]);
  assert.equal(calls[0][1].ids.join(','),'budget-beacon-pages');assert.equal(calls[1][1][0].matches.join(','),'https://shop.test/*');assert.equal(calls[2][1].target.tabId,42);assert.equal(calls[2][1].files[0],'content.js');
});
