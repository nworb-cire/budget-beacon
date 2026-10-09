const {test}=require('node:test');const assert=require('node:assert/strict');const {execFileSync}=require('node:child_process');
test('system installer preserves unrelated policies and requires unsigned opt-in',()=>{
  const result=execFileSync('python3',['-c',`
import importlib.util,json
spec=importlib.util.spec_from_file_location('installer','scripts/install-esr.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
old={'policies':{'DisableTelemetry':True,'ExtensionSettings':{'other@example.test':{'installation_mode':'allowed'}},'Preferences':{'some.pref':{'Value':True,'Status':'default'}}}}
new=m.merge_policy(old,'file:///usr/local/share/budget-beacon/test.xpi',True)
assert new['policies']['DisableTelemetry'] is True
assert new['policies']['ExtensionSettings']['other@example.test']==old['policies']['ExtensionSettings']['other@example.test']
assert new['policies']['Preferences']['some.pref']==old['policies']['Preferences']['some.pref']
assert 'xpinstall.signatures.required' not in old['policies']['Preferences']
assert new['policies']['Preferences']['xpinstall.signatures.required']['Value'] is False
assert 'xpinstall.signatures.required' not in m.merge_policy({},'file:///signed.xpi',False)['policies'].get('Preferences',{})
print('passed')
`],{encoding:'utf8'});assert.equal(result.trim(),'passed');
  assert.throws(()=>execFileSync('python3',['scripts/install-esr.py'],{stdio:'pipe'}),error=>error.stderr.toString().includes('unsigned'));
});
