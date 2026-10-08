// Firefox fetch cannot set Cookie/Origin/Referer directly. Only this add-on's
// own Monarch requests are adapted; website requests are never intercepted.
browser.webRequest.onBeforeSendHeaders.addListener(async details => {
  if (!details.originUrl?.startsWith(browser.runtime.getURL(''))) return;
  let headers = details.requestHeaders || [];
  const cookieMode = headers.some(h => h.name.toLowerCase() === 'x-budget-beacon-cookie-mode');
  headers = headers.filter(h => !['origin','referer','x-budget-beacon-cookie-mode'].includes(h.name.toLowerCase()));
  headers.push({name:'Origin',value:'https://app.monarch.com'},{name:'Referer',value:'https://app.monarch.com/'});
  if (cookieMode) {
    const cookies = [];
    for (const name of ['session_id','csrftoken']) {
      const cookie = await browser.cookies.get({url:'https://api.monarch.com',name}) || await browser.cookies.get({url:'https://app.monarch.com',name});
      if (cookie) cookies.push(`${name}=${cookie.value}`);
    }
    headers = headers.filter(h=>h.name.toLowerCase()!=='cookie');
    headers.push({name:'Cookie',value:cookies.join('; ')});
  }
  return {requestHeaders:headers};
}, {urls:['https://api.monarch.com/*']}, ['blocking','requestHeaders']);
const Monarch = (() => {
  const base = 'https://api.monarch.com';
  const query = `query BudgetBeacon($start: Date!, $end: Date!) {
    categoryGroups { id name type groupLevelBudgetingEnabled categories { id name } }
    budgetData(startMonth: $start, endMonth: $end) {
      monthlyAmountsByCategory { category { id } monthlyAmounts { month plannedCashFlowAmount actualAmount remainingAmount } }
      monthlyAmountsByCategoryGroup { categoryGroup { id } monthlyAmounts { month plannedCashFlowAmount actualAmount remainingAmount } }
    }
  }`;
  async function request(path, body, headers = {}, cookie = false) {
    let response;
    try { response = await fetch(base+path, {method:'POST', credentials:cookie?'include':'omit', headers:{'Content-Type':'application/json','monarch-client':'web','monarch-client-version':'2025.05',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)}); }
    catch { throw new Error('Could not reach Monarch. Check your connection and try again.'); }
    let data; try { data = await response.json(); } catch { throw new Error('Monarch blocked this request. Try connecting through your signed-in browser session.'); }
    if (!response.ok) {
      if (data.error_code === 'CAPTCHA_REQUIRED') throw new Error('Monarch requires a CAPTCHA. Sign in on the Monarch website, then choose Connect browser session.');
      if (response.status === 403 && path.includes('login')) throw new Error('MFA may be required. Enter your current authenticator code and try again, or use your browser session.');
      if ([401,403].includes(response.status)) throw new Error('Monarch session expired or access denied. Reconnect in settings.');
      throw new Error('Monarch request failed. Check your credentials or try again later.');
    }
    if (data.errors?.length) throw new Error('Monarch could not load the budget. Its unofficial API may have changed.');
    return data;
  }
  async function login(email,password,code) {
    const result = await request('/auth/login/', {username:email,password,supports_mfa:true,trusted_device:true,...(code?{totp:code}:{})});
    if (!result.token || typeof result.token !== 'string' || result.token.split('.').length === 3) throw new Error('No supported login session was returned. Use your browser session.');
    return {mode:'token',token:result.token};
  }
  async function budgets(auth) {
    const month = BudgetCore.monthKey();
    let headers = {}, cookie = false;
    if (auth.mode === 'token') headers.Authorization = `Token ${auth.token}`;
    else {
      cookie = true;
      const csrf = await browser.cookies.get({url:base, name:'csrftoken'}) || await browser.cookies.get({url:'https://app.monarch.com',name:'csrftoken'});
      if (!csrf) throw new Error('No Monarch browser session found. Sign in at app.monarch.com in this Firefox profile, then reconnect.');
      headers['X-CSRFToken'] = csrf.value;
      headers['X-Budget-Beacon-Cookie-Mode'] = '1';
    }
    const data = await request('/graphql',{operationName:'BudgetBeacon',query,variables:{start:month,end:month}},headers,cookie);
    return {month, syncedAt:Date.now(), groups:BudgetCore.normalize(data.data,month)};
  }
  return {login,budgets};
})();
