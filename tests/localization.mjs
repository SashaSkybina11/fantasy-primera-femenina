import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const source=ts.createSourceFile('locale.tsx',fs.readFileSync('frontend/src/contexts/LocaleContext.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const dict={};
for(const stmt of source.statements) if(ts.isVariableStatement(stmt)) for(const decl of stmt.declarationList.declarations) if(['spanish','ukrainian'].includes(decl.name.getText(source))) {
 const props=(ts.isAsExpression(decl.initializer)?decl.initializer.expression:decl.initializer).properties; const keys=props.map(p=>p.name.text);
 assert.equal(new Set(keys).size,keys.length,'Duplicate translations');
 dict[decl.name.getText(source)]=Object.fromEntries(props.map(p=>[p.name.text,p.initializer.text]));
}
assert.deepEqual(Object.keys(dict.spanish).sort(),Object.keys(dict.ukrainian).sort());
for(const key of Object.keys(dict.spanish)) assert.deepEqual(dict.spanish[key].match(/{{\w+}}/g),dict.ukrainian[key].match(/{{\w+}}/g),key);
const browser=await chromium.launch();
const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const user={id:'user',name:'Test',email:'test@example.invalid',role:'ADMIN',status:'ACTIVE',createdAt:'2026-01-01',avatarUrl:null};
const week={id:'week',number:1,name:'Jornada 1',status:'COMPLETED',marketIsOpen:true,deadlineAt:'2026-09-04',endsAt:'2026-09-06',marketOpenAt:'2026-09-01',winners:[]};
const club={id:'club',name:'Club',logoUrl:null,coach:null,president:null};
const player={id:'p',name:'Player',number:1,clubId:'club',club,position:'FIELD_PLAYER',role:'ALA',price:4215,age:25,nationality:'ES',gameweekStats:[],priceChanges:[{id:'history',gameweek:week,priceBefore:4000,priceDelta:215,priceAfter:4215}]};
const team={id:'team',name:'Test',budget:40000,players:[]};
await page.addInitScript(()=>{localStorage.setItem('fantasy-futsal-token','test');localStorage.setItem('fantasy-locale','uk');});
await page.route('**/api/**',route=>{
 const path=new URL(route.request().url()).pathname.replace('/api','');
 const data={ '/auth/me':{user},'/profile':{...user,fantasyTeam:team},'/my-team':team,'/my-team/transfers':{marketIsOpen:true,gameweek:week,bought:0,sold:0,limit:2},'/my-team/popular-player':{player:null,totalUsers:0,ownerCount:0,percentage:0},'/clubs':[club],'/clubs/club':club,'/clubs/club/players':[player],'/players':[player],'/player-prices':[player],'/gameweeks/current':week,'/gameweeks/leaderboard':[], '/gameweeks/history/me':[], '/gameweeks/scoring-rules':{},'/game-config':{initialBudget:40000},'/league':{id:'l',name:'League',_count:{members:0}},'/league/members':[], '/league/supporters':[], '/private-leagues/my':[], '/private-leagues/friend':{id:'friend',name:'Friends',members:[],ownerId:'user',inviteCode:'TEST'},'/admin/users':[user],'/admin/gameweeks':[week],'/admin/player-points':[player],'/admin/price-settings':{teamWin:null},'/admin/friend-leagues':[] }[path];
 return route.fulfill({json:data??[]});
});
const routes=['/','/profile','/my-team','/purchase-players','/player-prices','/teams','/teams/club','/calendar','/league','/friend-leagues','/league/friend','/leaderboard','/rules','/admin','/admin/player-points','/admin/player-prices','/admin/friend-leagues'];
for(const width of [390,1280]) {
 await page.setViewportSize({width,height:900});
 for(const path of routes) {
  await page.goto('http://127.0.0.1:5186'+path);
  await page.locator('h1').first().waitFor();
  const bodies=[];
  for(const locale of ['uk','es','uk']) {
   if(await page.locator('.language-switcher:visible').count()===0) await page.locator('.menu-toggle').click();
   await page.locator('.language-switcher:visible').first().selectOption(locale);
   await page.waitForFunction(l=>document.documentElement.lang===l,locale);
   const body=await page.locator('body').innerText(); bodies.push(body);
   assert.ok(!/(undefined|\bGOALKEEPER\b|\bFIELD_PLAYER\b|Тур не найден|Loading\.\.\.)/.test(body),path);
   if(locale==='es') assert.ok(!/[А-Яа-яІіЇїЄє]/.test(body),path+' Spanish mixed');
  }
  assert.equal(bodies[0],bodies[2],path+' round trip');
 }
}
fs.mkdirSync('artifacts/consistency',{recursive:true});
await page.goto('http://127.0.0.1:5186/player-prices');
await page.locator('details').click();
await page.screenshot({path:'artifacts/consistency/player-prices.png',fullPage:true});
assert.deepEqual(errors,[]);
await browser.close();
console.log(`PASS: ${Object.keys(dict.spanish).length} matching translation keys; ${routes.length} pages × 2 widths × UA→ES→UA; no page errors`);
