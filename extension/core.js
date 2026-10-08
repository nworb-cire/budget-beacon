/* Shared pure budget and URL logic; also used by the local demo and tests. */
(function(root) {
  function monthKey(now = new Date()) { return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`; }
  function parsePattern(input) {
    let value = input.trim();
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    let url;
    try { url = new URL(value); } catch { throw new Error('Enter a website and path, such as walmart.com/cart.'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.') && url.hostname !== 'localhost') throw new Error('Enter a valid HTTP or HTTPS website.');
    if (url.pathname.includes('*')) throw new Error('Use a page path without wildcards.');
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return {host, port: url.port, protocol: url.protocol, path: url.pathname.replace(/\/+$/, '') || '/', label: `${host}${url.port ? ':'+url.port : ''}${url.pathname.replace(/\/+$/, '') || '/'}`};
  }
  function matches(pattern, href) {
    try {
      const p = typeof pattern === 'string' ? parsePattern(pattern) : pattern;
      const u = new URL(href), path = u.pathname.replace(/\/+$/, '') || '/';
      return ['http:', 'https:'].includes(u.protocol) && u.hostname.replace(/^www\./,'').toLowerCase() === p.host && u.port === p.port && (p.path === '/' || path === p.path || path.startsWith(p.path+'/'));
    } catch { return false; }
  }
  function origins(p) {
    const hosts = p.host === 'localhost' ? [p.host] : [p.host, `www.${p.host}`];
    // Firefox validates each requested scheme against optional_permissions.
    return hosts.flatMap(host => [`http://${host}/*`, `https://${host}/*`]);
  }
  function patterns(rule) { return rule.patterns || (rule.pattern ? [rule.pattern] : []); }
  function matchesRule(rule, href) { return patterns(rule).some(p => matches(p, href)); }
  function parsePages(pages) {
    const unique = new Map();
    for (const page of pages) {
      if (!page.trim()) continue;
      const pattern = parsePattern(page);
      unique.set(pattern.label, pattern);
    }
    if (!unique.size) throw new Error('Add at least one website and page.');
    return [...unique.values()];
  }
  function ruleOrigins(rule) { return [...new Set(patterns(rule).flatMap(origins))]; }
  function migrateRule(rule) {
    const {pattern, ...rest} = rule;
    return {...rest, name:rule.name || '', patterns:patterns(rule)};
  }
  function number(value) { if (value === null || value === undefined || value === '') return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
  function normalize(data, month) {
    if (!data?.categoryGroups || !data?.budgetData) throw new Error('Monarch returned an unexpected budget response.');
    const rows = (list, field) => new Map((list || []).map(row => [String(row[field].id), (row.monthlyAmounts || []).find(m => m.month?.slice(0,7) === month.slice(0,7))]));
    const cats = rows(data.budgetData.monthlyAmountsByCategory, 'category');
    const groups = rows(data.budgetData.monthlyAmountsByCategoryGroup, 'categoryGroup');
    const amounts = row => ({remaining: number(row?.remainingAmount), planned: number(row?.plannedCashFlowAmount), spent: number(row?.actualAmount)});
    return data.categoryGroups.filter(g => g.type === 'expense').map(g => ({id: `group:${g.id}`, name: g.name, groupBudget: Boolean(g.groupLevelBudgetingEnabled), ...amounts(groups.get(String(g.id))), categories: (g.categories || []).filter(c => !c.isDisabled).map(c => ({id: `category:${c.id}`, name: c.name, ...amounts(cats.get(String(c.id)))}))}));
  }
  function total(groups, ids) {
    const selected = new Set(ids), used = [], missing = [];
    for (const g of groups) {
      if (selected.has(g.id) && g.groupBudget) {
        if (g.remaining === null) missing.push(g.name); else used.push({id:g.id,name:g.name,remaining:g.remaining});
        continue;
      }
      for (const c of g.categories) {
        if (!selected.has(g.id) && !selected.has(c.id)) continue;
        if (c.remaining === null) missing.push(c.name); else used.push(c);
      }
    }
    const known = new Set(groups.flatMap(g=>[g.id,...g.categories.map(c=>c.id)]));
    for (const id of selected) if (!known.has(id)) missing.push('Removed category');
    return {remaining: Math.round(used.reduce((s,c)=>s+c.remaining,0)*100)/100, used, missing};
  }
  function demo(month = monthKey()) {
    return {month, syncedAt: Date.now(), groups: [
      {id:'group:food',name:'Food & dining',groupBudget:false,remaining:null,categories:[{id:'category:groceries',name:'Groceries',planned:650,spent:237.58,remaining:412.42},{id:'category:restaurants',name:'Restaurants',planned:200,spent:146.25,remaining:53.75}]},
      {id:'group:shopping',name:'Shopping',groupBudget:false,remaining:null,categories:[{id:'category:household',name:'Household',planned:150,spent:64.12,remaining:85.88},{id:'category:clothing',name:'Clothing',planned:100,spent:125,remaining:-25}]}
    ]};
  }
  const api = {monthKey,parsePattern,matches,origins,patterns,matchesRule,parsePages,ruleOrigins,migrateRule,normalize,total,demo};
  root.BudgetCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
