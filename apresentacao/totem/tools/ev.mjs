import puppeteer from 'puppeteer-core'; import fs from 'fs';
const b = await puppeteer.launch({executablePath:'/usr/bin/google-chrome', headless:'new', protocolTimeout:0, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage(); await p.setViewport({width:320,height:180});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8765/?scene=13&at=80',{waitUntil:'load',timeout:0});
await p.waitForFunction('window.__ready===true',{timeout:0});
fs.writeFileSync('/tmp/ev13.json', JSON.stringify(await p.evaluate(()=>window.__events)));
await b.close();
