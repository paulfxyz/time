// Exercises the real upstream updater with an ephemeral key and disposable app.
// No production signing secret or installed user application is touched.
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdir, readFile, writeFile, access, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('build/updater-verification');
await mkdir(root,{recursive:true});
const framework = resolve('build/vendor/sparkle');
function run(command,args) {
  const result = spawnSync(command,args,{stdio:'inherit'});
  if (result.status !== 0) throw new Error(`Updater test preparation failed: ${command}`);
}
const sdk = spawnSync('xcrun',['--sdk','macosx','--show-sdk-path'],{encoding:'utf8'}).stdout.trim();
run('xcrun',['swiftc','-swift-version','5','-sdk',sdk,'-framework','AppKit','-F',framework,'-framework','Sparkle',
  '-Xlinker','-rpath','-Xlinker','@executable_path/../Frameworks','macos/Tests/UpdaterHarness/main.swift','-o',root+'/Harness']);
const {privateKey,publicKey} = generateKeyPairSync('ed25519');
const privateJWK = privateKey.export({format:'jwk'});
const publicValue = Buffer.from(publicKey.export({format:'jwk'}).x,'base64url').toString('base64');
const seed = Buffer.from(privateJWK.d,'base64url').toString('base64');
const server = createServer(async (request,response) => {
  const path = new URL(request.url,'http://localhost').pathname;
  const allowed = ['appcast.xml','update.zip'];
  const name = path.slice(1);
  if (!allowed.includes(name)) {response.writeHead(404);response.end();return}
  try {const bytes=await readFile(root+'/'+name);response.writeHead(200,{'content-type':name.endsWith('xml')?'application/xml':'application/octet-stream','content-length':bytes.length});response.end(bytes)}
  catch {response.writeHead(404);response.end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port = server.address().port;
const appPath = root+'/Fixture.app';
const fixtureID = `com.paulfleury.timescreen.qa.updater.${process.env.GITHUB_RUN_ID || Date.now()}`;
async function bundle(path,version) {
  await mkdir(path+'/Contents/MacOS',{recursive:true});
  await mkdir(path+'/Contents/Frameworks',{recursive:true});
  run('ditto',[root+'/Harness',path+'/Contents/MacOS/UpdaterFixture']);
  run('ditto',[framework+'/Sparkle.framework',path+'/Contents/Frameworks/Sparkle.framework']);
  const plist=`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>UpdaterFixture</string>
  <key>CFBundleIdentifier</key><string>${fixtureID}</string>
  <key>CFBundleName</key><string>UpdaterFixture</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>${version}</string>
  <key>CFBundleShortVersionString</key><string>0.0.${version}</string>
  <key>SUFeedURL</key><string>http://127.0.0.1:${port}/appcast.xml</string>
  <key>SUPublicEDKey</key><string>${publicValue}</string>
  <key>SURequireSignedFeed</key><true/>
  <key>SUSignedFeedFailureExpirationInterval</key><integer>0</integer>
  <key>SUVerifyUpdateBeforeExtraction</key><true/>
  <key>SUEnableAutomaticChecks</key><false/>
  <key>SUAutomaticallyUpdate</key><false/>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
  </dict></plist>`;
  await writeFile(path+'/Contents/Info.plist',plist);
  run('codesign',['--force','--sign','-','--timestamp=none',path]);
}
function signFeed() {
  const result = spawnSync(framework+'/bin/sign_update',['--ed-key-file','-',root+'/appcast.xml'],
    {input:seed+'\n',encoding:'utf8'});
  if(result.status!==0)throw new Error('Unable to sign fixture feed.');
}
const delay = milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
async function launch(expected,timeout=70000) {
  const process = spawn(appPath+'/Contents/MacOS/UpdaterFixture',[],{stdio:'inherit'});
  const started=Date.now();
  try {
    while(Date.now()-started<timeout){
      const events=await readFile(root+'/events.txt','utf8').catch(()=>'');
      if(expected==='error' && events.includes('error:'))return {events};
      if(expected==='installed'){
        try {await access(root+'/installed.txt');return {events}} catch {}
      }
      if(process.exitCode!==null&&process.exitCode!==0)throw new Error(`Updater fixture exited ${process.exitCode}: ${events}`);
      await delay(150);
    }
    throw new Error(`Timed out waiting for ${expected}`);
  } finally { if(process.exitCode===null)process.kill('SIGTERM'); }
}
const results=[];
try {
  await bundle(root+'/candidate/Fixture.app','2');
  run('ditto',['-c','-k','--keepParent',root+'/candidate/Fixture.app',root+'/valid.zip']);
  const archive=await readFile(root+'/valid.zip');
  const signature=sign(null,archive,privateKey).toString('base64');
  const xml=`<?xml version="1.0"?><rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"><channel><title>Updater fixture</title><item><title>Fixture 2</title><sparkle:version>2</sparkle:version><sparkle:shortVersionString>0.0.2</sparkle:shortVersionString><sparkle:minimumSystemVersion>13.0</sparkle:minimumSystemVersion><enclosure url="http://127.0.0.1:${port}/update.zip" sparkle:edSignature="${signature}" length="${archive.length}" type="application/octet-stream"/></item></channel></rss>`;
  await writeFile(root+'/appcast.xml',xml);signFeed();
  const signedFeed=await readFile(root+'/appcast.xml');
  await bundle(appPath,'1');
  await writeFile(root+'/events.txt','');
  await writeFile(root+'/appcast.xml',Buffer.from(signedFeed.toString().replace('Fixture 2','Tampered 2')));
  await writeFile(root+'/update.zip',archive);
  const badFeed=await launch('error');
  if(badFeed.events.includes('extracting')||badFeed.events.includes('ready-to-install'))throw new Error('Tampered feed reached extraction.');
  results.push({check:'Tampered signed feed rejected before extraction',passed:true});
  await writeFile(root+'/appcast.xml',signedFeed);
  const damaged=Buffer.from(archive);damaged[Math.floor(damaged.length/2)]^=1;
  await writeFile(root+'/update.zip',damaged);
  await writeFile(root+'/events.txt','');
  const badArchive=await launch('error');
  if(badArchive.events.includes('ready-to-install'))throw new Error('Tampered update reached installation.');
  results.push({check:'Tampered archive signature rejected',passed:true});
  await writeFile(root+'/update.zip',archive);
  await writeFile(root+'/events.txt','');
  const good=await launch('installed');
  const installed=spawnSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleVersion',appPath+'/Contents/Info.plist'],{encoding:'utf8'}).stdout.trim();
  if(installed!=='2')throw new Error('App bundle was not replaced with version 2.');
  if(!good.events.includes('ready-to-install'))throw new Error('Installer readiness not observed.');
  run('codesign',['--verify','--deep','--strict',appPath]);
  results.push({check:'Valid signed archive downloaded, installed and relaunched',passed:true,installedVersion:installed});
  await writeFile(root+'/report.json',JSON.stringify({passed:true,engine:'Real Sparkle 2.10.1 on macOS',productionSecretUsed:false,results},null,2));
  console.log(JSON.stringify(results,null,2));
} finally {server.close()}
