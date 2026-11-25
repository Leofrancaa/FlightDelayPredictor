import puppeteer from 'puppeteer-core';
import fs from 'fs';
const [,, scene, ...times] = process.argv;
const b = await puppeteer.launch({executablePath:'/usr/bin/google-chrome', headless:'new', protocolTimeout:0,
  args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const p = await b.newPage(); await p.setViewport({width:640,height:360});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto(`http://localhost:8765/?export=1&q=high&fps=30&scene=${scene}`,{waitUntil:'load',timeout:0});
await p.waitForFunction('window.__ready===true',{timeout:0});
let n=0; const want=times.map(Number).map(t=>Math.round(t*30));
for (const w of want) { let d; while (n<=w) { d = await p.evaluate(()=>window.__frame()); n++; } fs.writeFileSync(`/tmp/e_${w}.jpg`, Buffer.from(d.split(',')[1],'base64')); console.log('frame',w, await p.evaluate(()=>window.__dbg?.())); }
await b.close();
