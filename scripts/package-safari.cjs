const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {build}=require('./build-safari.cjs');
if(process.platform!=='darwin'){console.error('Safari app packaging requires macOS with Xcode. Run npm run build:safari here to prepare the portable sources.');process.exit(1);}
const output=path.resolve(__dirname,'../dist/safari-xcode');
if(fs.existsSync(output)){console.error('dist/safari-xcode already exists. Keep that project for signing/configuration, or move it aside before generating a new one.');process.exit(1);}
let tool='safari-web-extension-packager';
if(spawnSync('xcrun',['--find',tool],{stdio:'ignore'}).status!==0)tool='safari-web-extension-converter';
const result=spawnSync('xcrun',[tool,build(),'--project-location',output,'--app-name','Budget Beacon','--bundle-identifier','local.budgetbeacon','--swift','--macos-only','--copy-resources','--no-open','--no-prompt'],{stdio:'inherit'});
if(result.status!==0){console.error('Xcode packaging failed. Ensure full Xcode is installed and selected with xcode-select.');process.exit(1);}
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
const generated=files(output),handlers=generated.filter(file=>path.basename(file)==='SafariWebExtensionHandler.swift');
if(!handlers.length){console.error('The generated handler was not found. Copy safari/SafariWebExtensionHandler.swift into the extension target before building.');process.exit(1);}
for(const handler of handlers)fs.copyFileSync(path.resolve(__dirname,'../safari/SafariWebExtensionHandler.swift'),handler);
const entitlements=generated.filter(file=>file.endsWith('.entitlements'));
if(!entitlements.length){console.error('No entitlements file found. Enable Outgoing Connections (Client) for the extension target in Xcode.');process.exit(1);}
for(const file of entitlements){let text=fs.readFileSync(file,'utf8');if(!text.includes('<key>com.apple.security.network.client</key>'))text=text.replace('</dict>','<key>com.apple.security.network.client</key>\n<true/>\n</dict>');else text=text.replace(/(<key>com.apple.security.network.client<\/key>\s*)<false\s*\/>/,'$1<true/>');fs.writeFileSync(file,text);}
console.log('Safari app project prepared: '+output+'\nOpen it in Xcode, configure signing for app and extension, then build/run the macOS app.');
