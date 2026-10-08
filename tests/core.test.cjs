const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../extension/core.js');
test('URL rules match only the chosen host and path boundary',()=>{
  const p=core.parsePattern('www.walmart.com/cart/');
  for(const url of ['https://walmart.com/cart','https://www.walmart.com/cart?foo=bar','https://walmart.com/cart/checkout#billing'])assert.equal(core.matches(p,url),true,url);
  for(const url of ['https://walmart.com/cartoon','https://evilwalmart.com/cart','https://walmart.com.evil.test/cart','https://marketplace.walmart.com/cart','https://walmart.com/account'])assert.equal(core.matches(p,url),false,url);
  assert.throws(()=>core.parsePattern('https://user:pass@walmart.com/cart'));
  assert.equal(core.parsePattern('walmart.com/cart?foo=bar#checkout').label,'walmart.com/cart');
});
test('group plus child and overlapping rules never double count',()=>{
  const g=core.demo().groups;
  assert.equal(core.total(g,['group:food','category:groceries','category:groceries']).remaining,466.17);
  assert.equal(core.total(g,['category:groceries','category:household']).remaining,498.30);
  assert.equal(core.total(g,['category:clothing']).remaining,-25);
});
test('group-level budgets use Monarch remaining value, not child amounts',()=>{
  const groups=[{id:'group:x',name:'Food',groupBudget:true,remaining:180,categories:[{id:'category:x',name:'Groceries',remaining:50}]}];
  assert.equal(core.total(groups,['group:x','category:x']).remaining,180);
});
test('missing budgets are surfaced and never silently treated as zero',()=>{
  const groups=[{id:'group:x',name:'Food',groupBudget:false,remaining:null,categories:[{id:'category:x',name:'Groceries',remaining:null}]}];
  assert.deepEqual(core.total(groups,['category:x']).missing,['Groceries']);
  assert.deepEqual(core.total(groups,['category:removed']).missing,['Removed category']);
});
test('normalization uses only the requested month and preserves rollovers and overspending',()=>{
  const data={categoryGroups:[{id:1,name:'Food',type:'expense',categories:[{id:2,name:'Groceries'},{id:3,name:'Restaurants'}]},{id:4,name:'Income',type:'income',categories:[]}],budgetData:{monthlyAmountsByCategory:[{category:{id:2},monthlyAmounts:[{month:'2026-09-01',remainingAmount:999},{month:'2026-10-01',remainingAmount:'125.50',plannedCashFlowAmount:100,actualAmount:25}]},{category:{id:3},monthlyAmounts:[{month:'2026-10-01',remainingAmount:-20}]}]}};
  const groups=core.normalize(data,'2026-10-01');
  assert.equal(groups.length,1);assert.equal(groups[0].categories[0].remaining,125.5);assert.equal(groups[0].categories[1].remaining,-20);
});
test('month key follows local calendar instead of UTC',()=>{
  assert.equal(core.monthKey(new Date(2026,0,1,0,1)),'2026-01-01');
});

test('requested website permissions use the exact schemes declared in the manifest',()=>{
  const manifest=require('../extension/manifest.json');
  const origins=core.origins(core.parsePattern('walmart.com/cart'));
  assert.deepEqual(origins,['http://walmart.com/*','https://walmart.com/*','http://www.walmart.com/*','https://www.walmart.com/*']);
  for(const origin of origins)assert.ok(manifest.optional_permissions.includes(origin.startsWith('https:')?'https://*/*':'http://*/*'));
  assert.deepEqual(core.origins(core.parsePattern('localhost:4174/cart')),['http://localhost/*','https://localhost/*']);
});
test('many-to-many rules match every page and deduplicate page entries',()=>{
  const patterns=core.parsePages(['walmart.com/cart','target.com/cart','www.walmart.com/cart?x=1','']);
  assert.equal(patterns.length,2);
  const rule={patterns,categoryIds:['category:groceries','category:household']};
  assert.equal(core.matchesRule(rule,'https://target.com/cart/checkout'),true);
  assert.equal(core.matchesRule(rule,'https://www.walmart.com/cart'),true);
  assert.equal(core.matchesRule(rule,'https://target.com/account'),false);
  assert.equal(core.total(core.demo().groups,rule.categoryIds).remaining,498.3);
  assert.throws(()=>core.parsePages(['','  ']));
});
test('legacy single-page rules migrate without losing names, categories, or enabled state',()=>{
  const legacy={id:'old',pattern:core.parsePattern('walmart.com/cart'),categoryIds:['category:groceries'],enabled:false};
  const migrated=core.migrateRule(legacy);
  assert.equal(migrated.pattern,undefined);assert.equal(migrated.patterns[0].label,'walmart.com/cart');assert.equal(migrated.name,'');assert.equal(migrated.enabled,false);
  assert.deepEqual(migrated.categoryIds,legacy.categoryIds);assert.equal(core.matchesRule(legacy,'https://walmart.com/cart'),true);
});
