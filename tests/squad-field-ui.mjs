import { createServer } from "vite";
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const club={id:'c',name:'Test Club',logoUrl:null};
const entries=Array.from({length:10},(_,i)=>({id:'e'+i,playerId:'p'+i,status:'BENCH',isCaptain:false,player:{id:'p'+i,name:i===2?'María Nombre Largo Apellido':'Player '+i,number:i+1,position:i<2?'GOALKEEPER':'FIELD_PLAYER',role:i<2?'PORTERA':'ALA',nationality:'ES',age:24,club}}));
let team={id:'t',name:'Test Team',budget:20000,players:[]};
const server=await createServer({root:"frontend",configFile:false,server:{host:"127.0.0.1",port:5173},esbuild:{jsx:"automatic"}});await server.listen();
const browser=await chromium.launch();const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('fantasy-futsal-token','fixture');localStorage.setItem('fantasy-locale','uk');});
let patches=0;
await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname.replace(/^\/api/,'');let data=[];
if(path==='/auth/me')data={user:{id:'u',name:'Test',role:'ADMIN'}};
else if(path==='/my-team')data=team;
else if(path==='/my-team/transfers')data={marketIsOpen:true};
else if(path.startsWith('/my-team/players/')&&route.request().method()==='PATCH'){const e=entries.find(e=>e.playerId===path.split('/').at(-1));e.status=route.request().postDataJSON().status;patches++;data=team;}
else if(path==='/my-team/captain'){for(const e of entries)e.isCaptain=e.playerId===route.request().postDataJSON().playerId;data=team;}
await route.fulfill({json:data});});
await page.goto(`${process.env.UI_BASE_URL ?? 'http://127.0.0.1:5173'}/my-team`);await page.locator('.squad-field').waitFor();
assert.equal(await page.locator('.squad-slot--field').count(),5);
await page.locator('.squad-field__goalkeeper button').click();await page.locator('dialog[open]').waitFor();assert.equal(await page.locator('.squad-picker__player').count(),0);await page.keyboard.press('Escape');
team.players=entries;await page.reload();await page.locator('.squad-field__goalkeeper button').click();assert.equal(await page.locator('.squad-picker__player').count(),2);await page.locator('.squad-picker__player').first().click();await page.locator('dialog[open]').waitFor({state:'hidden'});assert.equal(patches,1);
await page.locator('.squad-field__players .squad-slot').first().click();assert.equal(await page.locator('.squad-picker__player').count(),8);await page.locator('.squad-picker__player').first().click();await page.locator('dialog[open]').waitFor({state:'hidden'});
for(const e of entries) e.status=[0,2,3,4,5].includes(entries.indexOf(e))?'STARTER':'BENCH';await page.reload();await page.locator('.squad-player-details').first().waitFor();
mkdirSync('artifacts/squad-update',{recursive:true});
for(const theme of ['light','dark'])for(const width of [320,375,768,1280]){
await page.setViewportSize({width,height:950});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
const rects=await page.locator('.squad-field .squad-player-card').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));assert.equal(rects.length,5);
for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];assert.ok(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,`Overlap ${width}`);}
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${width}`);
await page.locator('.squad-field').screenshot({path:`artifacts/squad-update/${theme}-${width}.png`});
}
await page.locator('.squad-player-details').first().click();await page.locator('dialog[open]').waitFor();assert.ok((await page.locator('dialog').textContent()).includes('Test Club'));await page.keyboard.press('Escape');
await page.locator('.squad-icon--captain').first().click();await page.locator('.squad-icon--captain.is-captain').waitFor();
await page.locator('.squad-icon--remove').first().click();await page.locator('.remove-player-modal').waitFor();assert.equal(await page.locator('dialog[open]').count(),0);await page.locator('.remove-player-modal .button--secondary').click();
await page.locator('.squad-bench-button').first().click();await page.locator('.squad-field__goalkeeper .squad-slot').waitFor();
assert.deepEqual(errors,[]);await browser.close();await server.close();console.log('PASS: empty slots, position filtering, add, details, captain, removal confirmation, bench, responsive layouts.');
