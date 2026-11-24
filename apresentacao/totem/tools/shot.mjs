import puppeteer from 'puppeteer-core';
const [,, url, out, wait='8000', w='1280', h='720'] = process.argv;
const b = await puppeteer.launch({executablePath:'/usr/bin/google-chrome', headless:'new',
  args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const p = await b.newPage(); await p.setViewport({width:+w,height:+h});
const logs=[]; p.on('console',m=>logs.push(m.type()+': '+m.text())); p.on('pageerror',e=>logs.push('PAGEERR: '+e.message));
await p.goto(url,{waitUntil:'load',timeout:120000});
try { await p.waitForFunction('window.__ready===true',{timeout:+wait}); } catch(e){ logs.push('timeout waiting ready'); }
await p.screenshot({path:out});
console.log(logs.slice(-25).join('\n')); await b.close();
