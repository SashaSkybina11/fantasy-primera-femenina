import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { players as seed } from '../backend/prisma/data/players.ts';
const out='artifacts/design-audit';mkdirSync(out,{recursive:true});
const clubs=[...new Set(seed.map(p=>p.club))].map((name,i)=>({id:'club'+i,name,logoUrl:null,coach:'Entrenadora',president:'Presidenta'}));
const players=seed.map((p,i)=>({...p,id:'player'+i,clubId:clubs.find(c=>c.name===p.club).id,club:clubs.find(c=>c.name===p.club),role:p.role??(p.position==='GOALKEEPER'?'PORTERA':'ALA'),age:23,nationality:'ES',goals:i===0?3:0}));
const team={id:'team',name:'Fantasy Test',budget:40000,players:players.slice(0,10).map((player,i)=>({id:'entry'+i,playerId:player.id,player,status:i<5?'STARTER':'BENCH',isCaptain:i===0}))};
const user={id:'user',name:'ParticipanteNombreLargoParaComprobarLaClasificación',email:'fixture@example.invalid',role:'ADMIN',avatarUrl:null,createdAt:'2026-09-01T12:00:00Z',status:'ACTIVE',totalPoints:0,playerCount:10};
const week={id:'week',number:2,name:'Jornada 2',status:'UPCOMING',marketIsOpen:false,marketOpenAt:'2026-09-08T08:00:00Z',deadlineAt:'2026-09-11T10:00:00Z',endsAt:'2026-09-13T21:59:59Z',winners:[]};
const friend={id:'friends',name:'LigaDeAmigosConNombreLargoSinEspaciosParaProbarAdaptación',inviteCode:'FUTABC123',owner:{id:'user',name:user.name},createdAt:'2026-09-01T12:00:00Z',_count:{members:5}};
const browser=await chromium.launch();const failures=[];let checks=0;
for (const locale of ['uk','es']) for (const theme of ['light','dark']) {
 const context=await browser.newContext();const friends=[friend];
 await context.addInitScript(({locale,theme})=>{localStorage.setItem('fantasy-futsal-token','fixture');localStorage.setItem('fantasy-locale',locale);localStorage.setItem('fantasy-theme',theme);},{locale,theme}); await context.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname.replace(/^\/api/,'');let data=[];
  if(path==='/auth/me') data={user};
  else if(path==='/my-team')data=team;
  else if(path==='/profile')data={...user,fantasyTeam:{...team,_count:{players:10}}};
  else if(path==='/my-team/transfers')data={gameweek:week,marketIsOpen:false,initialSquad:false,bought:0,sold:0,limit:2};
  else if(path==='/my-team/popular-player')data={player:players[0],ownerCount:2,totalUsers:5,percentage:40};
  else if(path==='/clubs')data=clubs;
  else if(path.startsWith('/clubs/')&&path.endsWith('/players'))data=players.filter(p=>p.clubId===path.split('/')[2]);
  else if(path.startsWith('/clubs/'))data=clubs.find(c=>c.id===path.split('/')[2]);
  else if(path==='/players')data=players;
  else if(path==='/game-config')data={initialBudget:40000};
  else if(path==='/gameweeks/current')data=week;
  else if(path==='/admin/users')data=[user];
  else if(path==='/gameweeks/leaderboard')data=[{id:user.id,name:user.name,rank:1,totalPoints:0,lastGameweekPoints:0}];
  else if(path==='/private-leagues/my')data=friends;
  else if(path==='/admin/friend-leagues')data=friends;

  else if(path==='/league')data={id:'league',name:'Fantasy',_count:{members:1}};
  else if(path==='/league/members')data=[{...user,fantasyTeam:{...team,_count:{players:10}}}];
  else if(path==='/league/supporters')data=[];
  else if(path==='/gameweeks/history/me')data=[];
  else if(path==='/player-prices')data=players.map(p=>({...p,priceChanges:[]}));
  await route.fulfill({json:data});
 });
 const page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));
 for(const width of [320,390,768,1024,1440]) {
  await page.setViewportSize({width,height:width===320?568:900});
  for(const path of ['/','/purchase-players','/my-team','/teams','/teams/club0','/calendar','/leaderboard','/friend-leagues','/league','/profile','/rules','/results','/scorers','/player-prices','/admin','/admin/friend-leagues']) {
   await page.goto('http://127.0.0.1:5173'+path, {waitUntil:'domcontentloaded'});await page.locator('h1').first().waitFor();
   const issues=await page.evaluate(()=>[...document.querySelectorAll('main button, main .button, main input, main select, main h1, main h2')].filter(el=>el.getBoundingClientRect().width && (el.getBoundingClientRect().right>innerWidth+1||el.getBoundingClientRect().left< -1)).map(el=>el.className+': '+el.textContent.slice(0,50)));
   if(issues.length) failures.push({locale,theme,width,path,issues});
   if(locale==='uk'&&[320,1440].includes(width)) await page.screenshot({path:`${out}/${theme}-${width}-${path.replaceAll('/','_')}.png`});
   if(path==='/my-team') {
    await page.locator('.squad-player-details').first().click();
    const dialog=page.locator('dialog[open]');
    assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
    await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),1);await page.locator('dialog[open] .compact-modal__close').click();
    assert.equal(await dialog.count(),0);
    if(await page.locator('.menu-toggle').isVisible()) {
     await page.locator('.menu-toggle').click();
     for(const icon of await page.locator('.mobile-menu .nav-link i svg').all()) {
      const box=await icon.boundingBox();assert.equal(box.width,20);assert.equal(box.height,20);
     }
     await page.locator('.mobile-menu__head button').click();
    }
   }
   if(path==='/profile') {
    const toggle=page.locator('.password-input button').first();
    await toggle.click();
    assert.equal(await page.locator('.password-input input').first().getAttribute('type'),'text');
    await toggle.click();
    assert.equal(await page.locator('.password-input input').first().getAttribute('type'),'password');
   }
   checks++;
  }
 }
 await context.close();console.log(locale,theme,checks);
}
await browser.close();writeFileSync(`${out}/report.json`,JSON.stringify({checks,failures},null,2));console.log(JSON.stringify({checks,failures}));assert.deepEqual(failures,[]);



