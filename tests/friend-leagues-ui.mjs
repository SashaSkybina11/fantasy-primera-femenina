import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { players as seed } from '../backend/prisma/data/players.ts';
const out='artifacts/friend-league-update';mkdirSync(out,{recursive:true});
const clubs=[...new Set(seed.map(p=>p.club))].map((name,i)=>({id:'club'+i,name,logoUrl:null,coach:'Entrenadora',president:'Presidenta'}));
const players=seed.map((p,i)=>({...p,id:'player'+i,clubId:clubs.find(c=>c.name===p.club).id,club:clubs.find(c=>c.name===p.club),role:p.role??(p.position==='GOALKEEPER'?'PORTERA':'ALA'),age:23,nationality:'ES',goals:i===0?3:0}));
const team={id:'team',name:'Fantasy Test',budget:40000,players:players.slice(0,10).map((player,i)=>({id:'entry'+i,playerId:player.id,player,status:i<5?'STARTER':'BENCH',isCaptain:i===0}))};
const user={id:'user',name:'ParticipanteNombreLargoParaComprobarLaClasificación',email:'fixture@example.invalid',role:'ADMIN',avatarUrl:null,createdAt:'2026-09-01T12:00:00Z',status:'ACTIVE',totalPoints:0,playerCount:10};
const week={id:'week',number:2,name:'Jornada 2',status:'UPCOMING',marketIsOpen:false,marketOpenAt:'2026-09-08T08:00:00Z',deadlineAt:'2026-09-11T10:00:00Z',endsAt:'2026-09-13T21:59:59Z',winners:[]};
const friend={startGameweek:3,logoUrl:null,ownerId:'owner',id:'friends',name:'LigaDeAmigosConNombreLargoSinEspaciosParaProbarAdaptación',inviteCode:'FUTABC123',owner:{id:'user',name:user.name},createdAt:'2026-09-01T12:00:00Z',_count:{members:5}};
const sizes=[[320,700],[768,900],[1440,900]];const paths=['/purchase-players','/friend-leagues','/admin','/admin/friend-leagues'];
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
 const page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));
 for(const [width,height] of sizes) {await page.setViewportSize({width,height});for(const path of paths){
 await page.goto('http://127.0.0.1:5173'+path);await page.locator('h1').first().waitFor();
 if(path==='/purchase-players'){await page.locator('.player-card').last().waitFor();assert.equal(await page.locator('.player-card__top .club-logo, .player-card__top .club-mark').count(),players.length);}
 if(path==='/friend-leagues')await page.locator('.friend-league-list article').waitFor();
 if(path==='/admin'){const paddings=await page.locator('.page-heading>a').evaluateAll(els=>els.map(e=>getComputedStyle(e).paddingRight));assert.deepEqual(paddings,['10px','10px','10px','10px']);}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${locale}/${theme}/${width}/${path}`);
 if(width===320||width===1440)await page.screenshot({path:out+'/'+locale+'-'+theme+'-'+width+path.replaceAll('/','-')+'.png'});checks++;
 }}await context.close();
}));await browser.close();assert.deepEqual(failures,[]);console.log('PASS: '+checks+' responsive league/admin/market checks and club badges');
