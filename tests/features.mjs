import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
const page = await browser.newPage({viewport:{width:375,height:900}});
await page.addInitScript(() => {localStorage.setItem('fantasy-futsal-token','test');localStorage.setItem('fantasy-locale','uk');});
const club={id:'club',name:'Futsi Atlético Navalcarnero',logoUrl:null};
const player={id:'player',name:'Bea Parrón',number:18,clubId:club.id,club,role:'ALA',position:'FIELD_PLAYER',price:3000};
const user={id:'user',name:'Tester',role:'ADMIN',email:'test@example.invalid',createdAt:'2026-09-01',contactConsent:false};
const team={id:'team',name:'Test FC',budget:50000,players:[]};
const leagues=[];
let popularityReads=0;
let buys=0, sales=0;
const week={id:'week',name:'Jornada',status:'OPEN',marketIsOpen:true,marketOpenAt:'2026-09-01T08:00:00Z',deadlineAt:'2026-09-30T10:00:00Z'};
await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname.replace(/^\/api/,'');
  const method=route.request().method();
  let data=[];
  if(path==='/auth/me') data={user};
  else if(path==='/profile') data={...user,fantasyTeam:team};
  else if(path==='/my-team') data=team;
  else if(path==='/my-team/transfers') data={marketIsOpen:true,initialSquad:true,bought:0,sold:0,limit:2};
  else if(path==='/my-team/popular-player') {popularityReads++;data={player:team.players.length?player:null,ownerCount:team.players.length,totalUsers:team.players.length,percentage:team.players.length?100:0};}
  else if(path==='/my-team/players'&&method==='POST') {buys++;team.players=[{id:'entry',playerId:player.id,player,status:'BENCH',isCaptain:false}];team.budget=47000;data=team;}
  else if(path==='/my-team/players/player'&&method==='DELETE') {sales++;team.players=[];team.budget=50000;data=team;}
  else if(path==='/players') data=[player];
  else if(path==='/clubs') data=[club];
  else if(path==='/gameweeks/current') data=week;
  else if(path==='/private-leagues/my') data=leagues;
  else if(path==='/private-leagues'&&method==='POST') {assert.equal(route.request().postDataJSON().name,'My friends');data={id:'league1',name:'My friends',inviteCode:'ABCDEF',_count:{members:1}};leagues.push(data);}
  else if(path==='/private-leagues/join') {assert.equal(route.request().postDataJSON().code,'JOINME');data={id:'league2',name:'Joined league',inviteCode:'JOINME',_count:{members:3}};leagues.push(data);}
  await route.fulfill({json:data});
});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
async function nav(path) {await page.locator('.menu-toggle').click();await page.locator(`.mobile-menu a[href="${path}"]`).click();}
await page.goto('http://127.0.0.1:5173/friend-leagues');
await page.getByText('Створіть власну лігу або приєднайтеся до ліги друзів за кодом.').waitFor();
await page.locator('.friend-league-actions button').first().click();
await page.locator('.compact-modal input').fill('My friends');
await page.locator('.compact-modal form button').click();
await page.getByText('ABCDEF',{exact:true}).waitFor();
await page.locator('.compact-modal__close').click();
await page.locator('.friend-league-list article').waitFor();
await page.locator('.friend-league-actions button').last().click();
await page.locator('.compact-modal input').fill('JOINME');
await page.locator('.compact-modal form button').click();
await page.getByText('Joined league',{exact:true}).waitFor();
await page.reload();await page.getByText('Joined league',{exact:true}).waitFor();
assert.equal(await page.locator('.friend-league-list article').count(),2);
leagues[1].name='LigaConNombreExtremadamenteLargoSinEspaciosParaComprobarElDiseño';
for (const theme of ['light','dark']) {
  await page.evaluate(theme => localStorage.setItem('fantasy-theme',theme),theme);
  await page.reload();
  await page.locator('.friend-league-list article').first().waitFor();
  for (const width of [320,360,375,390,430,768,1024,1280]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    for (const card of await page.locator('.friend-league-list article').all()) assert.equal(await card.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
    if (width===320) await page.screenshot({path:'artifacts/responsive/friends-populated-'+theme+'.png'});
  }
}
await page.setViewportSize({width:375,height:900});
await nav('/profile');await page.locator('.profile-card__identity').waitFor();
assert.equal(await page.locator('.friend-leagues').count(),0);
await page.goBack();await page.locator('.friend-league-actions').waitFor();
await page.goForward();await page.locator('.profile-card__identity').waitFor();
await nav('/purchase-players');
await page.getByText('Поки недостатньо даних',{exact:true}).waitFor();
const before=popularityReads;
await page.locator('.player-card button').click();
await page.locator('.popular-player h3').waitFor();
assert.ok(popularityReads>before);assert.equal(buys,1);
assert.match(await page.locator('.popular-player').innerText(),/100%/);
await nav('/my-team');
await page.locator('.squad-actions .text-button--danger').click();
await page.locator('.remove-player-modal .button--danger').click();
await page.locator('.remove-player-modal').waitFor({state:'hidden'});
assert.equal(sales,1);
await nav('/purchase-players');
await page.getByText('Поки недостатньо даних',{exact:true}).waitFor();
assert.deepEqual(errors,[]);
await browser.close();
console.log('Passed: league creation/join, multiple leagues, refresh, direct route, back/forward, profile removal, purchase/sale popularity refresh.');
