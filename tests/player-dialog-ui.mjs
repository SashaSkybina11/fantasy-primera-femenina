import { chromium } from 'playwright';
import { preview } from 'vite';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const out='artifacts/player-dialog';mkdirSync(out,{recursive:true});
const server=await preview({root:'frontend',configFile:false,preview:{host:'127.0.0.1',port:5177,strictPort:true}});
const browser=await chromium.launch({args:['--disable-features=OverlayScrollbar']});const errors=[];let checks=0;
try{
 for(const [locale,role,ageLabel,country] of [['uk','Воротарка','17 років','Іспанія'],['es','Portera','17 años','España'],['en','Goalkeeper','17 years old','Spain'],['pt','Guarda-redes','17 anos','Espanha'],['pt-BR','Goleira','17 anos','Espanha']]) for(const [width,height] of [[320,568],[390,844],[768,1024],[1440,900],[844,390]]) {
  const context=await browser.newContext({viewport:{width,height},isMobile:width<768,hasTouch:width<768});
  await context.addInitScript(locale=>{localStorage.setItem('fantasy-futsal-token','fixture');localStorage.setItem('fantasy-locale',locale);localStorage.setItem('fantasy-theme','light');},locale);
  await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  let age=17;
  await context.route('**/api/**',r=>{
   const path=new URL(r.request().url()).pathname.replace(/^\/api/,'');
   const club={id:'club',name:'AD Ceuta FC',logoUrl:null};
   const player={id:'player',name:'Daniela',number:1,position:'GOALKEEPER',role:'PORTERA',age,nationality:'ES',price:2000,initialPrice:2000,photoUrl:null,clubId:club.id,club};
   const team={id:'team',name:'My Team',budget:20000,players:Array.from({length:10},(_,i)=>({id:'e'+i,playerId:'p'+i,player:{...player,id:'p'+i},status:i===0?'STARTER':'BENCH',isCaptain:false}))};
   return r.fulfill({json:path==='/auth/me'?{user:{id:'user',name:'Test',role:'USER'}}:path==='/my-team'?team:path==='/my-team/transfers'?{marketIsOpen:true,initialSquad:true}:path==='/game-config'?{initialBudget:40000}:[]});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5177/my-team');
  const trigger=page.locator('.squad-player-details').first();await trigger.scrollIntoViewIfNeeded();
  const positions=()=>page.evaluate(()=>({scrollY,items:['.team-heading','.squad-field','.mobile-header','.sidebar'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width};})}));
  const before=await positions();
  await trigger.click();const dialog=page.locator('dialog[open]');await dialog.waitFor();
  const opened=await positions();assert.deepEqual(opened,before,`${locale}/${width}: background shifted when opening`);
  assert.equal(await dialog.locator('.fut-player-card__facts').innerText(),`${role} · ${ageLabel} · 🇪🇸 ${country}`);
  await page.mouse.click(1,1);assert.equal(await dialog.count(),1,'Backdrop must not dismiss');
  await page.keyboard.press('Escape');assert.equal(await dialog.count(),1,'Only close button dismisses');
  await page.mouse.wheel(0,400);assert.equal((await positions()).scrollY,before.scrollY,'Background must remain locked');
  assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  if(locale==='uk'&&[320,1440].includes(width))await page.screenshot({path:`${out}/${width}.png`});
  await dialog.locator('.compact-modal__close').click();assert.equal(await dialog.count(),0);
  assert.deepEqual(await positions(),before,`${locale}/${width}: background shifted when closing`);
  assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
  if(locale==='uk'&&width===1440)for(const [number,label] of [[21,'21 рік'],[22,'22 роки'],[11,'11 років']]){
   age=number;await page.reload();await trigger.click();assert.match(await dialog.locator('.fut-player-card__facts').innerText(),new RegExp(label));await dialog.locator('.compact-modal__close').click();
  }
  await context.close();checks++;
 }
 assert.deepEqual(errors,[]);console.log(`PASS: ${checks} locale/viewport combinations; stable background and scroll, backdrop/Escape ignored, close button and focus restoration, translated role and age, Ukrainian age plurals.`);
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
