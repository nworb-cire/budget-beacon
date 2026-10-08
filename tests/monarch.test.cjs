const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function setup(fetch){let handler;const context=vm.createContext({AbortSignal,BudgetCore:require('../extension/core.js'),fetch,browser:{runtime:{getURL:()=> 'moz-extension://beacon/'},cookies:{get:async({name})=>({value:name==='csrftoken'?'csrf-test':'session-test'})},webRequest:{onBeforeSendHeaders:{addListener:fn=>handler=fn}}}});vm.runInContext(fs.readFileSync('extension/monarch.js','utf8')+'\nglobalThis.api=Monarch;',context);return {api:context.api,handler};}
test('cookie headers are adapted only for this extension, not website requests',async()=>{
  const {handler}=setup();
  assert.equal(await handler({originUrl:'https://app.monarch.com',requestHeaders:[]}),undefined);
  const result=await handler({originUrl:'moz-extension://beacon/background.html',requestHeaders:[{name:'X-Budget-Beacon-Cookie-Mode',value:'1'},{name:'X-CSRFToken',value:'csrf-test'}]});
  const headers=Object.fromEntries(result.requestHeaders.map(h=>[h.name,h.value]));
  assert.equal(headers.Cookie,'session_id=session-test; csrftoken=csrf-test');assert.equal(headers.Origin,'https://app.monarch.com');assert.equal(headers['X-Budget-Beacon-Cookie-Mode'],undefined);
});
test('password authentication supports MFA and returns only session token',async()=>{
  let body;
  const {api}=setup(async(url,options)=>{assert.equal(url,'https://api.monarch.com/auth/login/');body=JSON.parse(options.body);assert.equal(options.credentials,'omit');return {ok:true,json:async()=>({token:'test-token'})};});
  const auth=await api.login('someone@example.test','test-password','123456');
  assert.equal(body.totp,'123456');assert.equal(body.supports_mfa,true);assert.equal(auth.token,'test-token');assert.equal(auth.password,undefined);
});
test('API failures give actionable errors without reflecting credentials',async()=>{
  const {api}=setup(async()=>({ok:false,status:403,json:async()=>({error_code:'CAPTCHA_REQUIRED',detail:'sensitive-account-detail'})}));
  await assert.rejects(()=>api.login('someone@example.test','secret'),error=>error.message.includes('CAPTCHA')&&!error.message.includes('sensitive'));
});
test('cookie sync sends a read-only current-month query and normalizes data',async()=>{
  const {api}=setup(async(url,options)=>{assert.equal(url,'https://api.monarch.com/graphql');const body=JSON.parse(options.body);assert.equal(body.variables.start,require('../extension/core.js').monthKey());assert.equal(body.variables.end,body.variables.start);assert.ok(!body.query.includes('mutation'));assert.equal(options.credentials,'include');return {ok:true,json:async()=>({data:{categoryGroups:[],budgetData:{monthlyAmountsByCategory:[]}}})};});
  const cache=await api.budgets({mode:'cookie'});assert.equal(cache.groups.length,0);
});
