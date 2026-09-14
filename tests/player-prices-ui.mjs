import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const browser=await chromium.launch();
try {
 const page=await browser.newPage();
 await page.addInitScript(()=>{localStorage.setItem('fantasy-futsal-token','test');localStorage.setItem('fantasy-locale','uk')});
 await page.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;let data=[];
 if(p.endsWith('/auth/me'))data={user:{id:'u',role:'USER',name:'User'}};
 if(p.endsWith('/player-prices'))data=[-20,100,0].map((d,i)=>({id:String(i),name:'María del Carmen Fernández Rodríguez',price:3000,club:{id:'c',name:'Club de fútbol sala',logoUrl:null},priceChanges:[{id:'r',priceBefore:3000-d,priceAfter:3000,priceDelta:d,gameweek:{number:1}}]}));
 return r.fulfill({json:data});});
 for(const theme of ['light','dark'])for(const width of [320,375,768,1440]){
 await page.setViewportSize({width,height:900});await page.goto(baseUrl + '/player-prices');await page.locator('.player-price-card').last().waitFor();await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
 assert.equal(await page.locator('.player-price-heading .club-mark').count(),3);
 assert.equal((await page.locator('.price-delta--down').first().innerText()).replace(/\s/g,' '),'↓ 20 EUR');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('summary').first().click();
 await page.screenshot({path:'artifacts/matches/prices-'+theme+'-'+width+'.png',fullPage:true});
 }
 console.log('PASS: prices logos, signed colors and 8 responsive layouts');
}finally{await browser.close()}

