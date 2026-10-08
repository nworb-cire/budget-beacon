// Runs the actual extension in an isolated Firefox profile. No user profile is modified.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'budget-beacon-smoke-'));
fs.cpSync(path.resolve(__dirname,'../extension'),dir,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
manifest.permissions.push('*://localhost/*');manifest.background.scripts.push('smoke.js');
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest));
fs.copyFileSync(path.resolve(__dirname,'../tests/firefox-smoke.js'),path.join(dir,'smoke.js'));
fs.writeFileSync(path.join(dir,'smoke-settings.html'),'<!doctype html><html><head><meta charset="utf-8"></head><body><script src="smoke-settings.js"></script></body></html>');
fs.copyFileSync(path.resolve(__dirname,'../tests/firefox-settings.js'),path.join(dir,'smoke-settings.js'));
fs.copyFileSync(path.resolve(__dirname,'../tests/firefox-options-ui.js'),path.join(dir,'smoke-options-ui.js'));
const optionsFile=path.join(dir,'options.html');
fs.writeFileSync(optionsFile,fs.readFileSync(optionsFile,'utf8').replace('</body>','<script src="smoke-options-ui.js"></script></body>'));

fs.copyFileSync(path.resolve(__dirname,'../tests/firefox-popup-ui.js'),path.join(dir,'smoke-popup-ui.js'));
const popupFile=path.join(dir,'popup.html');
fs.writeFileSync(popupFile,fs.readFileSync(popupFile,'utf8').replace('</body>','<script src="smoke-popup-ui.js"></script></body>'));
let child,timer,finished=false;
function finish(code){if(finished)return;finished=true;clearTimeout(timer);child?.kill('SIGTERM');server.close();setTimeout(()=>{fs.rmSync(dir,{recursive:true,force:true});process.exit(code);},500);}
const server=http.createServer((req,res)=>{
  if(req.url==='/report'&&req.method==='POST'){let text='';req.on('data',chunk=>text+=chunk);req.on('end',()=>{res.end('OK');const result=JSON.parse(text);console.log(JSON.stringify(result,null,2));finish(result.ok?0:1);});}
  else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><title>Budget Beacon smoke test</title></head><body><h1>Test checkout</h1></body></html>');}
});
server.listen(4174,'127.0.0.1',()=>{
  child=spawn(path.resolve(__dirname,'../node_modules/.bin/web-ext'),['run','--source-dir',dir,'--firefox','/usr/bin/firefox-esr','--no-input','--no-reload','--args=-headless'],{stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',data=>process.stdout.write(data));child.stderr.on('data',data=>process.stderr.write(data));
  child.on('exit',code=>{if(!finished){console.error('Firefox runner exited:',code);finish(1);}});
  timer=setTimeout(()=>{console.error('Firefox smoke test timed out');finish(1);},45000);
});
