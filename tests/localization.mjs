import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const source=ts.createSourceFile('locale.tsx',fs.readFileSync('frontend/src/contexts/LocaleContext.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const dict={};
for(const stmt of source.statements) if(ts.isVariableStatement(stmt)) for(const decl of stmt.declarationList.declarations) if(['spanish','ukrainian','english'].includes(decl.name.getText(source))) {
 const props=(ts.isAsExpression(decl.initializer)?decl.initializer.expression:decl.initializer).properties; const keys=props.map(p=>p.name.text);
 assert.equal(new Set(keys).size,keys.length,'Duplicate translations');
 dict[decl.name.getText(source)]=Object.fromEntries(props.map(p=>[p.name.text,p.initializer.text]));
}
for(const language of ['ukrainian','english']) {
 assert.deepEqual(Object.keys(dict.spanish).sort(),Object.keys(dict[language]).sort());
 for(const key of Object.keys(dict.spanish)) {
  assert.ok(dict[language][key].trim(), `${language}: ${key} is empty`);
  assert.deepEqual(dict.spanish[key].match(/{{\w+}}/g),dict[language][key].match(/{{\w+}}/g),`${language}: ${key}`);
 }
}
const browser=await chromium.launch();
const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
page.setDefaultTimeout(15000);
let anonymous=false;
let apiErrorMessage='Неверный email или пароль';
const user={id:'user',name:'Test',email:'test@example.invalid',role:'ADMIN',status:'ACTIVE',createdAt:'2026-01-01',avatarUrl:null,budget:12345,playerCount:10,totalPoints:0};
const week={id:'week',number:1,name:'Jornada 1',status:'COMPLETED',marketIsOpen:true,deadlineAt:'2026-09-04',endsAt:'2026-09-06',marketOpenAt:'2026-09-01',winners:[]};
const club={id:'club',name:'Club',logoUrl:null,coach:null,president:null};
const player={id:'p',name:'Player',number:1,clubId:'club',club,position:'FIELD_PLAYER',role:'ALA',price:4215,age:25,nationality:'ES',gameweekStats:[],priceChanges:[{id:'history',gameweek:week,priceBefore:4000,priceDelta:215,priceAfter:4215}]};
const team={id:'team',name:'Test',budget:40000,players:[]};
await page.addInitScript(()=>{localStorage.setItem('fantasy-futsal-token','test');});
await page.route('**/api/**',route=>{
 const path=new URL(route.request().url()).pathname.replace('/api','');
 if(path==='/auth/login') return route.fulfill({status:400,json:{message:apiErrorMessage}});
 if(path==='/admin/users') return route.fulfill({json:[user,{...user,id:'zero',name:'Zero',budget:0},{...user,id:'no-team',name:'No team',budget:null,playerCount:0}]});
 const data={ '/auth/me':{user},'/profile':{...user,fantasyTeam:team},'/my-team':team,'/my-team/transfers':{marketIsOpen:true,gameweek:week,bought:0,sold:0,limit:2},'/my-team/popular-player':{player:null,totalUsers:0,ownerCount:0,percentage:0},'/clubs':[club],'/clubs/club':club,'/clubs/club/players':[player],'/players':[player],'/player-prices':[player],'/gameweeks/current':week,'/gameweeks/leaderboard':[], '/gameweeks/history/me':[], '/gameweeks/scoring-rules':{},'/game-config':{initialBudget:40000},'/league':{id:'l',name:'League',_count:{members:0}},'/league/members':[], '/league/supporters':[], '/private-leagues/my':[], '/private-leagues/friend':{id:'friend',name:'Friends',members:[],ownerId:'user',inviteCode:'TEST'},'/admin/users':[user],'/admin/gameweeks':[week],'/admin/player-points':[player],'/admin/friend-leagues':[] }[path];
 if(path==='/auth/me' && anonymous) return route.fulfill({status:401,json:{message:'Требуется авторизация'}});
 if(path==='/league/members/user') return route.fulfill({json:{...user,fantasyTeam:team}});
 return route.fulfill({json:data??[]});
});
const routes=['/','/profile','/my-team','/purchase-players','/player-prices','/teams','/teams/club','/calendar','/league','/friend-leagues','/league/friend','/league/member/user','/leaderboard','/rules','/admin','/admin/users','/admin/player-points','/admin/player-prices','/admin/friend-leagues','/login','/register'];
const checks=[];
try {
await page.goto('http://127.0.0.1:5186/');
await page.waitForFunction(()=>document.documentElement.lang==='es' && localStorage.getItem('fantasy-locale')==='es');
await page.locator('.language-switcher:visible').first().selectOption('en');
await page.reload();
await page.waitForFunction(()=>document.documentElement.lang==='en');
assert.equal(await page.locator('.language-switcher:visible').first().inputValue(),'en');
await page.evaluate(()=>localStorage.setItem('fantasy-locale','invalid'));
await page.reload();
await page.waitForFunction(()=>document.documentElement.lang==='es' && localStorage.getItem('fantasy-locale')==='es');
for(const [locale,role,country,age,error] of [
 ['es','Portera','España','25 años','El correo o la contraseña no son correctos'],
 ['uk','Воротарка','Іспанія','25 років','Неправильна електронна пошта або пароль'],
 ['en','Goalkeeper','Spain','25 years old','Incorrect email or password'],
]) {
 await page.locator('.language-switcher:visible').first().selectOption(locale);
 const result=await page.evaluate(async()=>{
  const module=await import('/src/services/api.ts');
  let error;
  try {await module.api.login({email:'test@example.invalid',password:'invalid'});} catch(e) {error=e.message;}
  return {role:module.roleLabel('PORTERA'),country:module.nationalityLabel('ES'),age:module.playerFactsLabel({age:25}),error};
 });
 assert.deepEqual(result,{role,country,age,error});
}
apiErrorMessage='Los datos han cambiado. Vuelve a calcular los precios.';
assert.equal(await page.evaluate(async()=>{
 const {api}=await import('/src/services/api.ts');
 try {await api.login({email:'test@example.invalid',password:'invalid'});} catch(e) {return e.message;}
}),'The data has changed. Recalculate the prices.');
apiErrorMessage='Unexpected backend failure';
assert.equal(await page.evaluate(async()=>{
 const {api}=await import('/src/services/api.ts');
 try {await api.login({email:'test@example.invalid',password:'invalid'});} catch(e) {return e.message;}
}),'Something went wrong. Please try again.');
for(const width of [390,1280]) {
 await page.setViewportSize({width,height:900});
 for(const path of routes) {
  anonymous=['/login','/register'].includes(path);
  await page.goto('http://127.0.0.1:5186'+path);
  await page.locator('h1').first().waitFor();
  await page.waitForLoadState('networkidle');
  if(path==='/player-prices') await page.locator('details').click();
  if(path==='/admin/player-prices') {
   assert.equal(await page.locator('.price-settings').count(), 0);
   assert.equal(await page.locator('input[type="number"]').count(), 0);
  }
  if(path==='/admin/player-points') {
   await page.locator('.admin-toolbar select').first().selectOption('week');
   await page.locator('.stats-player').first().click();
  }
  if(path==='/league/member/user') await page.locator('.member-heading button').click();
  const bodies=[];
  for(const locale of ['en','es','uk','en']) {
   if(await page.locator('.language-switcher:visible').count()===0) await page.locator('.menu-toggle').click();
   await page.locator('.language-switcher:visible').first().selectOption(locale);
   await page.waitForFunction(l=>document.documentElement.lang===l,locale);
   await page.locator('h1').first().waitFor();
   const body=await page.locator('body').innerText();
   const dictionary=dict[{es:'spanish',uk:'ukrainian',en:'english'}[locale]];
   assert.ok(!/Oleksandra Skybina|Creadora del juego|Творчиня гри|Game creator/.test(body));
   if(!anonymous) {
    const contact=page.locator('.site-footer .admin-contact');
    assert.equal(await contact.getAttribute('href'),'mailto:fantasyfutsalspain@gmail.com');
    assert.equal(await contact.locator('span').innerText(),dictionary['footer.contactAdmin']);
    assert.equal(await contact.locator('small').innerText(),'fantasyfutsalspain@gmail.com');
   }
   if(path==='/admin' || path==='/admin/users') {
    const money=new Intl.NumberFormat({es:'es-ES',uk:'uk-UA',en:'en-GB'}[locale],{style:'currency',currency:'EUR',maximumFractionDigits:0});
    const budgets=await page.locator('.admin-user__budget').allTextContents();
    assert.deepEqual(budgets.map(s=>s.trim()),[12345,0,null].map(value=>dictionary['admin.budget']+': '+(value===null?dictionary['league.teamNotCreated']:money.format(value))));
   }
   const attributes=await page.locator('[aria-label],[placeholder],[title],[alt]').evaluateAll(nodes=>nodes.flatMap(n=>['aria-label','placeholder','title','alt'].map(a=>n.getAttribute(a)??'')).join('\n'));
   bodies.push(body+'\n'+attributes);
   assert.ok(!/(Скрыть|Показать|@username)/.test(attributes),path+' untranslated attribute');
   assert.ok(!/(undefined|\bGOALKEEPER\b|\bFIELD_PLAYER\b|Тур не найден|Loading\.\.\.)/.test(body),path);
   // Translated language names may legitimately include Cyrillic in other locales.
   if(locale==='es' || locale==='en') assert.ok(!/[А-Яа-яІіЇїЄє]/.test(body+attributes),path+' mixed languages');
   if(locale==='en') {
    assert.ok(!/\b(Jornada|Portera|Jugadoras|Cargando|Guardar|Clasificación)\b/.test(body+attributes),path+' Spanish text in English');
    assert.equal(await page.locator('.language-switcher').first().locator('option').count(),3);
   }
  }
  assert.equal(bodies[0],bodies[3],path+' round trip');
  checks.push({path,width,roundTrip:true});
 }
}
fs.mkdirSync('artifacts/consistency',{recursive:true});
anonymous=false;
await page.goto('http://127.0.0.1:5186/player-prices');
await page.locator('details').click();
await page.screenshot({path:'artifacts/consistency/player-prices.png',fullPage:true});
await page.goto('http://127.0.0.1:5186/admin');
await page.locator('.admin-user__budget').first().waitFor();
await page.screenshot({path:'artifacts/consistency/admin-budgets-contact.png',fullPage:true});
assert.deepEqual(errors,[]);
fs.writeFileSync('artifacts/consistency/localization.json',JSON.stringify({keys:Object.keys(dict.spanish).length,checks,errors},null,2));
console.log(`PASS: ${Object.keys(dict.spanish).length} matching translation keys in 3 languages; ${routes.length} pages × 2 widths × EN→ES→UK→EN; Spanish default and English persistence; no page errors`);
} finally { await browser.close(); }
