import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { players as seed } from '../backend/prisma/data/players.ts';
const out='artifacts/prelaunch/ui';mkdirSync(out,{recursive:true});
const clubs=[...new Set(seed.map(p=>p.club))].map((name,i)=>({id:'club'+i,name,logoUrl:null,coach:'Entrenadora',president:'Presidenta'}));
const players=seed.map((p,i)=>({...p,id:'player'+i,clubId:clubs.find(c=>c.name===p.club).id,club:clubs.find(c=>c.name===p.club),role:p.role??(p.position==='GOALKEEPER'?'PORTERA':'ALA'),age:23,nationality:'ES',goals:i===0?3:0}));
const team={id:'team',name:'Fantasy Test',budget:40000,players:players.slice(0,10).map((player,i)=>({id:'entry'+i,playerId:player.id,player,status:i<5?'STARTER':'BENCH',isCaptain:i===0}))};
const user={id:'user',name:'ParticipanteNombreLargoParaComprobarLaClasificación',email:'fixture@example.invalid',role:'ADMIN',avatarUrl:null,createdAt:'2026-09-01T12:00:00Z',status:'ACTIVE',totalPoints:0,playerCount:10};
const week={id:'week',number:2,name:'Jornada 2',status:'UPCOMING',marketIsOpen:false,marketOpenAt:'2026-09-08T08:00:00Z',deadlineAt:'2026-09-11T10:00:00Z',endsAt:'2026-09-13T21:59:59Z',winners:[]};
const friend={id:'friends',name:'LigaDeAmigosConNombreLargoSinEspaciosParaProbarAdaptación',inviteCode:'FUTABC123',owner:{id:'user',name:user.name},createdAt:'2026-09-01T12:00:00Z',_count:{members:5}};
const sizes=[[320,568],[360,800],[375,812],[390,844],[430,932],[768,1024],[1024,768],[1280,720],[1440,900]];
const paths=['/','/purchase-players','/my-team','/teams','/teams/club0','/calendar','/leaderboard','/friend-leagues','/admin','/admin/friend-leagues'];
const browser=await chromium.launch();const failures=[];let checks=0;let lineupCalls=0;
await Promise.all(['uk','es'].flatMap(locale => ['light','dark'].map(theme => ({locale,theme}))).map(async ({locale,theme}) => {
 const context=await browser.newContext();let mode='normal';let loggedIn=true;let friends=[friend];
 await context.addInitScript(({locale,theme})=>{localStorage.setItem('fantasy-futsal-token','fixture');localStorage.setItem('fantasy-locale',locale);localStorage.setItem('fantasy-theme',theme);},{locale,theme});
 await context.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname.replace(/^\/api/,'');let data=[];
  if(path==='/auth/me') data={user};
  else if(path==='/my-team')data=team;
  else if(path==='/profile')data={...user,fantasyTeam:team};
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
  else if(path==='/users/user/lineup'){
   lineupCalls++;if(mode==='loading')await new Promise(r=>setTimeout(r,600));
   if(mode==='error')return route.fulfill({status:500,json:{message:'Fixture error'}});
   data={user:{id:user.id,name:user.name},players:mode==='empty'?[]:team.players.filter(p=>p.status==='STARTER').map(p=>({...p,points:3}))};
  }
  else if(path==='/private-leagues/my')data=friends;
  else if(path==='/admin/friend-leagues')data=friends;
  else if(path==='/admin/friend-leagues/friends'&&route.request().method()==='DELETE'){friends=[];return route.fulfill({status:204});}
  else if(path==='/league')data={id:'league',name:'Fantasy',_count:{members:1}};
  else if(path==='/league/members')data=[{...user,fantasyTeam:team}];
  else if(path==='/league/supporters')data=[];
  else if(path==='/gameweeks/history/me')data=[];
  else failures.push('Unexpected API '+path);
  await route.fulfill({json:data});
 });
 const page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('500'))failures.push('console: '+m.text())});
 for(const [width,height]of sizes){
  console.log(locale+'/'+theme+'/'+width);
  await page.setViewportSize({width,height});
  for(const path of paths){
   await page.goto('http://localhost:5173'+path,{waitUntil:'domcontentloaded'});await page.locator('h1').first().waitFor();
   if(path==='/purchase-players'){
    await page.locator('.player-card').last().waitFor();
    assert.equal(await page.locator('.player-card').count(),233);
    const prices=await page.locator('.player-card footer strong').allTextContents();
    const format=new Intl.NumberFormat(locale==='uk'?'uk-UA':'es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0});
    assert.deepEqual(prices,players.map(p=>format.format(p.price)));
    const placement=await page.locator('.view-team-action').evaluate(el=>({tag:el.previousElementSibling.tagName,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,center:el.firstElementChild.getBoundingClientRect().x+el.firstElementChild.getBoundingClientRect().width/2}));
    assert.equal(placement.tag,'HEADER');assert.ok(Math.abs(placement.center-(placement.left+placement.right)/2)<2);
    await page.locator('.view-team-button').click();await page.locator('dialog[open]').waitFor();
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
    await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
   }
   if(path==='/calendar'){
    const buttons=await page.locator('.calendar-card .button').evaluateAll(els=>els.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
    assert.ok(Math.abs(buttons[0].width-buttons[1].width)<1);assert.ok(Math.abs(buttons[0].height-buttons[1].height)<1,JSON.stringify({locale,width,buttons}));
   }
   if(path==='/teams/club0'){await page.locator('.roster-row').first().waitFor();assert.equal(await page.locator('.roster-goals').count(),1);}
   if(path==='/leaderboard'){
    const before=lineupCalls;await page.locator('.leaderboard-row').click();await page.locator('.public-lineup-player').first().waitFor();assert.equal(await page.locator('.public-lineup-player').count(),5);assert.ok(lineupCalls>before);
    const overflow=await page.locator('dialog').evaluate(el=>el.scrollWidth>el.clientWidth+1);if(overflow)failures.push('Modal overflow '+[locale,theme,width]);
    if([320,1440].includes(width))await page.screenshot({path:out+'/'+locale+'-'+theme+'-'+width+'-lineup.png'});
    await page.locator('.compact-modal__close').click();
   }
   if(path==='/admin/friend-leagues')await page.locator('.admin-league-card').waitFor();
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))failures.push('Page overflow '+[locale,theme,width,path]);
   const outliers=await page.evaluate(()=>[...document.querySelectorAll('main *, .page *')].filter(el=>{const r=el.getBoundingClientRect();const css=getComputedStyle(el);return r.width>0&&css.position!=='fixed'&&css.position!=='absolute'&&(r.right>innerWidth+2||r.left< -2)}).map(el=>el.className).slice(0,8));
   if(outliers.length)failures.push('Outlying elements '+[locale,theme,width,path]+': '+outliers);
   if([320,1440].includes(width)&&['/calendar','/purchase-players','/teams/club0','/admin/friend-leagues'].includes(path))await page.screenshot({path:out+'/'+locale+'-'+theme+'-'+width+path.replaceAll('/','-')+'.png'});
   checks++;
  }
 }
 await page.setViewportSize({width:375,height:812});
 for(const state of ['loading','empty','error']){
  mode=state;await page.goto('http://localhost:5173/leaderboard');await page.locator('.leaderboard-row').click();
  if(state==='loading')await page.locator('.modal-loading').waitFor();
  if(state==='empty')await page.getByText(locale==='uk'?'Основний склад ще не сформовано.':'La alineación principal todavía no está formada.').waitFor();
  if(state==='error')await page.getByText(locale==='uk'?'Не вдалося завантажити склад користувача.':'No se pudo cargar la plantilla del usuario.').waitFor();
  await page.keyboard.press('Escape');
 }
 mode='normal';await page.goto('http://localhost:5173/leaderboard');await page.locator('.leaderboard-row').click();await page.locator('dialog[open]').waitFor();await page.mouse.click(2,2);assert.equal(await page.locator('dialog[open]').count(),0);
 await page.goto('http://localhost:5173/admin/friend-leagues');await page.locator('.admin-league-card button').click();await page.locator('.modal-actions button').last().click();await page.locator('dialog').waitFor({state:'detached'});await page.locator('.admin-league-card').waitFor({state:'detached'});
 await context.close();
 const anonymous=await browser.newContext();await anonymous.addInitScript(({locale,theme})=>{localStorage.setItem('fantasy-locale',locale);localStorage.setItem('fantasy-theme',theme)},{locale,theme});
 const auth=await anonymous.newPage();auth.on('pageerror',e=>failures.push(e.message));
 for(const [width,height]of sizes)for(const path of ['/login','/register']){await auth.setViewportSize({width,height});await auth.goto('http://localhost:5173'+path);await auth.locator('input[type=email]').waitFor();assert.ok((await auth.locator('input[type=email]').boundingBox()).y<height);if(await auth.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))failures.push('Auth overflow '+[locale,theme,width,path]);if([320,1440].includes(width))await auth.screenshot({path:out+'/'+locale+'-'+theme+'-'+width+path+'.png'});checks++}
 await anonymous.close();console.log('Finished '+locale+'/'+theme);
}));
await browser.close();writeFileSync(out+'/report.json',JSON.stringify({checks,failures},null,2));assert.deepEqual(failures,[]);console.log('Responsive checks passed: '+checks);
