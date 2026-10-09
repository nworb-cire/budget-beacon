const fs=require('node:fs'),path=require('node:path');
function build(output=path.resolve(__dirname,'../dist/safari')){
  const source=path.resolve(__dirname,'../extension');
  fs.mkdirSync(output,{recursive:true});
  fs.cpSync(source,output,{recursive:true});
  const manifest=JSON.parse(fs.readFileSync(path.join(source,'manifest.json')));
  delete manifest.browser_specific_settings;delete manifest.browser_action;
  manifest.manifest_version=3;
  manifest.permissions=['storage','alarms','tabs','activeTab','cookies','scripting','nativeMessaging'];
  manifest.host_permissions=['https://api.monarch.com/*','https://app.monarch.com/*'];
  manifest.optional_host_permissions=['http://*/*','https://*/*'];
  delete manifest.optional_permissions;
  manifest.background={service_worker:'safari-worker.js'};
  manifest.action=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'))).browser_action;
  manifest.content_security_policy={extension_pages:"script-src 'self'; object-src 'none'"};
  fs.copyFileSync(path.resolve(__dirname,'../safari/transport.js'),path.join(output,'safari-transport.js'));
  fs.copyFileSync(path.resolve(__dirname,'../safari/worker.js'),path.join(output,'safari-worker.js'));
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return output;
}
if(require.main===module)console.log('Safari WebExtension sources: '+build());
module.exports={build};
