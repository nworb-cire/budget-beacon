(async()=>{
  const send=async message=>{const reply=await browser.runtime.sendMessage(message);if(!reply.ok)throw new Error(reply.error);return reply.data;};
  const check=(condition,name)=>{if(!condition)throw new Error(name);};
  try{
    let s=await send({type:'state'});
    check(s.demo&&!s.auth?.token,'Credentials redacted');
    check(s.rules[0].patterns?.length===1&&!s.rules[0].pattern,'Legacy rule migrated');
    await send({type:'saveRule',id:'multi',name:'Food shops',pages:['localhost:4174/cart','localhost:4174/other'],categoryIds:['category:groceries','category:household']});
    await send({type:'addPage',id:'multi',page:'http://localhost:4174/third?ignored=1'});
    await send({type:'addPage',id:'multi',page:'http://localhost:4174/third'});
    s=await send({type:'state'});let rule=s.rules.find(r=>r.id==='multi');
    check(rule.name==='Food shops'&&rule.patterns.length===3&&rule.categoryIds.length===2,'Popup adds pages without duplicating pages or changing categories');
    await send({type:'toggleRule',id:'multi'});
    await send({type:'saveRule',id:'multi',name:'',pages:['localhost:4174/other','localhost:4174/third'],categoryIds:['category:groceries']});
    s=await send({type:'state'});rule=s.rules.find(r=>r.id==='multi');
    check(rule.name===''&&rule.enabled===false&&rule.patterns.length===2,'Editing preserves disabled state and optional names');
    await send({type:'options',page:'http://localhost:4174/prefilled?foo=bar'});
    await browser.runtime.sendMessage({type:'smoke-result',passed:true});
  }catch(error){await browser.runtime.sendMessage({type:'smoke-result',passed:false,error:error.message});}
})();
