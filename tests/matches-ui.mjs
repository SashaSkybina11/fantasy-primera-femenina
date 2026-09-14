import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
mkdirSync('artifacts/matches',{recursive:true});
const clubs=['Futsi Atlético Navalcarnero','Poio Pescamar'].map((name,i)=>({id:'club'+i,name,logoUrl:null,coach:null,president:null}));
const week={id:'week',number:3,name:'Jornada 3',status:'LOCKED',startsAt:'2026-09-12T10:00:00Z',endsAt:'2026-09-20T20:00:00Z'};
const roster=Array.from({length:14},(_,i)=>({id:'player'+i,name:['Ana Rodríguez','María González','Lucía Fernández','Laura Martínez','Sofía García','Carmen Pérez','Isabel López'][i%7],number:i%7+1,clubId:clubs[i<7?0:1].id,position:i%7===0?'GOALKEEPER':'FIELD_PLAYER',role:i%7===0?'PORTERA':'ALA',gameweekStats:[]}));
const protocol={homeScore:2,awayScore:1,homeOwnGoals:0,awayOwnGoals:0,players:roster.map((p,i)=>({playerId:p.id,name:p.name,number:p.number,clubId:p.clubId,position:p.position,started:i%7<5,goals:i===1?2:i===8?1:0,yellowCards:i===3?1:0,redCards:0,goalsConceded:i===0?1:i===7?2:null,totalPoints:i===1?14:2,result:i<7?'WIN':'LOSS'}))};
const base={id:'match',gameweekId:'week',gameweek:week,kickoffAt:'2026-09-13T15:00:00Z',publishedAt:'2026-09-13T17:00:00Z',published:protocol,draft:protocol,version:0,teams:clubs.map((club,i)=>({clubId:club.id,club,side:i===0?'home':'away'}))};
const browser=await chromium.launch();const errors=[];let saves=0;
try {
for(const locale of ['es','uk','en']) for(const theme of ['light','dark']) {
 const context=await browser.newContext();let match=structuredClone(base);
 await context.addInitScript(({locale,theme})=>{localStorage.setItem('fantasy-futsal-token','test');localStorage.setItem('fantasy-locale',locale);localStorage.setItem('fantasy-theme',theme);},{locale,theme});
 await context.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname.replace('/api','');let data=[];
 if(path==='/auth/me')data={user:{id:'user',role:'ADMIN',name:'Admin',email:'a@example.invalid'}};
 else if(path==='/matches/weeks')data=[week];
 else if(path==='/matches')data=[match];
 else if(path==='/matches/match')data=match;
 else if(path==='/matches/match/editor'){
  if(route.request().method()==='PUT'){const body=route.request().postDataJSON();assert.equal(body.version,match.version);match={...match,draft:body.protocol,version:match.version+1,...(body.publish?{published:body.protocol}:{})};saves++;data=match;}
  else data={match,protocol:match.draft,roster,previousStarters:{club0:roster.slice(0,5).map(p=>p.id),club1:roster.slice(7,12).map(p=>p.id)}};
 }
 else if(path==='/clubs')data=clubs;
 else if(path==='/game-config')data={initialBudget:40000};
 else if(path==='/gameweeks/scoring-rules')data={started:2,win:2,draw:1,fieldGoal:5,goalkeeperGoal:8,goalkeeperCleanSheet:5,hatTrickBonus:3,yellowCard:-1,redCard:-4};
 await route.fulfill({json:data});});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const width of [320,768,1440]){
  await page.setViewportSize({width,height:900});
  for(const path of ['/results','/results/match','/admin/matches','/admin/matches/match','/calendar']){
   console.log(locale,theme,width,path); await page.goto('http://127.0.0.1:5173'+path); await page.locator('h1').first().waitFor().catch(async e=>{console.log(await page.locator('body').innerText(),errors);throw e;});
   if(path==='/admin/matches/match'){await page.locator('.match-edit-player').last().waitFor();assert.equal(await page.locator('input[type=checkbox]:checked').count(),10);}
   if(path==='/results')await page.locator('.match-card').waitFor();
   if(path==='/results/match'){await page.locator('.protocol-player').last().waitFor();await page.locator('summary').first().click();}
   if(path==='/calendar')assert.equal(await page.locator('.calendar-card').count(),2);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,`${locale}/${theme}/${width}${path} overflow`);
   if(width!==768)await page.screenshot({path:`artifacts/matches/${locale}-${theme}-${width}-${path.replaceAll('/','_')}.png`,fullPage:true});
  }
 }
 await page.goto('http://127.0.0.1:5173/admin/matches/match');await page.locator('.match-edit-player').last().waitFor();
 await page.locator('.match-edit-player input[type=checkbox]').first().uncheck();
 await page.locator('.match-save-bar button').first().click();
 await page.getByText(locale==='es'?'Borrador guardado. Los puntos no han cambiado.':locale==='uk'?'Чернетку збережено. Очки не змінено.':'Draft saved. Points are unchanged.',{exact:true}).waitFor();
 assert.equal(match.published.players[0].started,true);assert.equal(match.draft.players[0].started,false);
 await context.close();
}
assert.deepEqual(errors,[]);assert.equal(saves,6);console.log('PASS: 90 page/viewport/language/theme checks, calendar removal, starters, point details and draft saves');
}finally{await browser.close();}
