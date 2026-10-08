/* The web preview is an explicit demo. Real authentication runs only inside Firefox. */
const isExtension = typeof browser !== 'undefined' && Boolean(browser.runtime?.id);
const UI = (()=> {
  const key='budget-beacon-preview';
  let previewState=JSON.parse(localStorage.getItem(key)||'null') || {rules:[],auth:null,cache:null,demo:false,currency:'USD'};
  async function send(message) {
    if(isExtension) {
      const reply=await browser.runtime.sendMessage(message);
      if(!reply?.ok) throw new Error(reply?.error||'The extension did not respond.');
      return reply.data;
    }
    switch(message.type) {
      case 'state': return previewState;
      case 'connect': throw new Error('This is the local UI preview. Connect Monarch from the installed Firefox extension.');
      case 'demo': previewState={...previewState,auth:null,demo:true,cache:BudgetCore.demo(),lastError:null};break;
      case 'refresh': if(!previewState.demo) throw new Error('Enable demo data first.');previewState.cache=BudgetCore.demo();break;
      case 'disconnect': previewState={...previewState,auth:null,demo:false,cache:null};break;
      case 'saveRule': {
        if(!message.categoryIds.length) throw new Error('Select at least one budget group or category.');
        const rule={id:message.id||crypto.randomUUID(),pattern:BudgetCore.parsePattern(message.page),categoryIds:[...new Set(message.categoryIds)],enabled:true};
        previewState.rules=previewState.rules.filter(r=>r.id!==rule.id).concat(rule);break;
      }
      case 'deleteRule': previewState.rules=previewState.rules.filter(r=>r.id!==message.id);break;
      case 'toggleRule': previewState.rules=previewState.rules.map(r=>r.id===message.id?{...r,enabled:!r.enabled}:r);break;
      case 'currency':previewState.currency=message.currency;break;
    }
    localStorage.setItem(key,JSON.stringify(previewState));
  }
  async function grant(pattern) {
    if(!isExtension) return true;
    return browser.permissions.request({origins:BudgetCore.origins(pattern)});
  }
  return {send,grant};
})();
