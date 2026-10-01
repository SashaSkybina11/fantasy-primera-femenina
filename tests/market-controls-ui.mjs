import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { byLocale } from './locale-dictionaries.mjs';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const out='artifacts/market-controls';mkdirSync(out,{recursive:true});
const browser=await chromium.launch();const errors=[];let checks=0;
try {
 for(const locale of ['es','uk','en','pt','pt-BR']) for(const width of [320,768,1440]) {
  const t=key=>byLocale[locale][key];const context=await browser.newContext({viewport:{width,height:width===320?568:900}});
  await context.addInitScript(({locale,width})=>{localStorage.setItem('fantasy-futsal-token','fixture');localStorage.setItem('fantasy-locale',locale);localStorage.setItem('fantasy-theme',width===768?'dark':'light');},{locale,width});
  await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  const club=id=>({id,name:'Club '+id,logoUrl:null});
  const player=(id,clubId,position='FIELD_PLAYER',price=2000)=>({id,clubId,club:club(clubId),name:'Player '+id,position,role:position==='GOALKEEPER'?'PORTERA':'ALA',price,initialPrice:1800,number:7,age:24,nationality:'PT',photoUrl:null});
  const owned=[player('owned','a','GOALKEEPER'),player('keeper2','b','GOALKEEPER'),player('field1','a'),player('field2','c')];
  const catalog=[owned[0],player('club-limit','a'),player('position-limit','f','GOALKEEPER'),player('available','d'),player('expensive','e','FIELD_PLAYER',999999)];
  let role='USER',open=true,override=null,bought=0,initial=true,failPatch=false,patches=0;
  let roster=owned;
  const week=()=>({id:'week',number:5,status:'OPEN',marketIsOpen:open,marketOverride:override,marketOpenAt:'2026-09-28T06:00:00Z',deadlineAt:'2026-10-02T17:00:00Z',endsAt:'2026-10-04T21:59:59Z'});
  await context.route('**/api/**',async r=>{
   const path=new URL(r.request().url()).pathname.replace(/^\/api/,'');let data=[];
   if(path==='/auth/me')data={user:{id:'user',name:'Test',role}};
   else if(path==='/my-team')data={id:'team',name:'Team',budget:40000,players:roster.map((p,i)=>({id:'e'+i,playerId:p.id,player:p,status:i===0?'STARTER':'BENCH',isCaptain:false}))};
   else if(path==='/players')data=catalog;
   else if(path==='/clubs')data=['a','b','c','d','e','f'].map(club);
   else if(path==='/game-config')data={initialBudget:40000};
   else if(path==='/my-team/popular-player')data={player:null,percentage:0,ownerCount:0,totalUsers:1};
   else if(path==='/gameweeks/current')data=week();
   else if(path==='/my-team/transfers')data={marketIsOpen:open,bought,sold:0,limit:2,initialSquad:initial};
   else if(path==='/admin/market') {
    assert.equal(role,'ADMIN');assert.equal(r.request().method(),'PATCH');patches++;
    if(failPatch)return r.fulfill({status:409,json:{message:'MARKET_STALE'}});
    const body=r.request().postDataJSON();assert.equal(body.gameweekId,'week');override=body.mode==='AUTO'?null:body.mode==='OPEN';open=override??true;data=week();
   }
   return r.fulfill({json:data});
  });
  const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  const visit=async()=>{await page.goto(base+'/purchase-players');await page.locator('.player-card').last().waitFor({timeout:10000}).catch(async e=>{console.error(await page.locator('body').innerText());throw e;});};
  const card=id=>page.locator('.player-card').filter({has:page.getByRole('heading',{name:'Player '+id,exact:true})});
  await visit();assert.equal(await page.locator('.market-controls').count(),0);
  for(const [id,label,reason] of [['owned','purchase.purchased','player.alreadySelected'],['club-limit','purchase.unavailable','purchase.clubLimit'],['position-limit','purchase.unavailable','purchase.goalkeeperLimit'],['expensive','purchase.unavailable','player.noBudget']]) {
   assert.equal(await card(id).locator('button').innerText(),t(label));assert.equal(await card(id).locator('button').isDisabled(),true);assert.equal(await card(id).locator('.player-card__notice').innerText(),t(reason));
  }
  assert.equal(await card('available').locator('button').innerText(),t('purchase.buy'));assert.equal(await card('available').locator('button').isEnabled(),true);
  assert.equal(await page.locator('.language-switcher').first().locator('option').count(),5);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(await card('available').locator('.player-card__notice').count(),0);
  initial=false;bought=2;await visit();assert.equal(await card('available').locator('.player-card__notice').innerText(),t('purchase.transferLimit'));
  open=false;await visit();assert.equal(await card('available').locator('.player-card__notice').innerText(),t('purchase.marketClosed'));assert.equal(await card('owned').locator('button').innerText(),t('purchase.purchased'));
  open=true;bought=0;roster=Array.from({length:8},(_,i)=>player('field'+i,'club'+i));await visit();assert.equal(await card('available').locator('.player-card__notice').innerText(),t('purchase.fieldLimit'));
  roster=owned;role='ADMIN';await visit();
  for(const [mode,label] of [['CLOSED','market.close'],['OPEN','market.open'],['AUTO','market.auto']]) {
   await page.locator('.market-controls').getByRole('button',{name:t(label),exact:true}).click();
   await page.waitForFunction(mode=>document.querySelector('.market-controls [aria-pressed="true"]')?.textContent.trim()===mode,t(label));
  }
  assert.equal(patches,3);await page.reload();await page.locator('.market-controls').waitFor();assert.equal(await page.locator('.market-controls [aria-pressed="true"]').innerText(),t('market.auto'));
  failPatch=true;await page.getByRole('button',{name:t('market.close'),exact:true}).click();await page.getByText(t('market.stale'),{exact:true}).waitFor();assert.equal(await page.locator('.market-controls [aria-pressed="true"]').innerText(),t('market.auto'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(locale==='pt-BR'){await page.locator('.market-controls').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/admin-${width}.png`});}
  await page.goto(base+'/my-team');await page.locator('.squad-player-details').first().click();
  const dialog=page.locator('dialog[open]'),close=dialog.locator('.compact-modal__close');assert.equal(await close.locator('svg.ui-cross').count(),1);
  assert.equal(await dialog.locator('.squad-price-comparison__arrow svg.ui-arrow').count(),1);
  const bounds=await dialog.locator('.fut-player-card').boundingBox(),button=await close.boundingBox();assert.ok(button.x>=bounds.x && button.x+button.width<=bounds.x+bounds.width && button.y>=bounds.y);
  assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  if(locale==='pt-BR')await page.screenshot({path:`${out}/card-${width}.png`});
  await close.click();assert.equal(await page.locator('dialog[open]').count(),0);
  await page.reload();assert.equal(await page.locator('html').getAttribute('lang'),locale);
  await context.close();checks++;
 }
 assert.deepEqual(errors,[]);console.log(`PASS: ${checks} locale/viewport combinations; buy/purchased/unavailable reasons, admin-only controls, persistent modes, error preservation, 5 languages, responsive dialogs and SVG icons.`);
}finally{await browser.close();}


