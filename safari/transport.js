/* Safari's native app extension performs fixed-origin HTTPS requests without
   requiring unsupported webRequestBlocking or browser CORS/header workarounds. */
globalThis.BudgetNativeTransport={
  async request(path,body,headers,cookie) {
    const forwarded={...headers};
    delete forwarded['X-Budget-Beacon-Cookie-Mode'];
    if(cookie){
      const pairs=[];
      for(const name of ['session_id','csrftoken']){
        const item=await browser.cookies.get({url:'https://api.monarch.com',name}) || await browser.cookies.get({url:'https://app.monarch.com',name});
        if(!item)throw new Error('No Monarch Safari session found. Sign in to app.monarch.com in this Safari profile.');
        pairs.push(`${name}=${item.value}`);
      }
      forwarded.Cookie=pairs.join('; ');
    }
    const result=await browser.runtime.sendNativeMessage('local.budgetbeacon',{type:'monarch-request',path,body,headers:forwarded});
    if(!result)throw new Error('Safari’s Monarch connection failed. Check that the companion app and extension were built together.');
    if(result.error)throw new Error(result.error);
    return {ok:result.status>=200 && result.status<300,status:result.status,json:async()=>{
      if(!result.data)throw new Error('Monarch returned an invalid response.');
      return result.data;
    }};
  }
};
