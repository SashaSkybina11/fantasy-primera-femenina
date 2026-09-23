import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
const url = new URL(process.env.DATABASE_URL!);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Tests require local PostgreSQL');
const setup = new PrismaClient();
const database = `friend_leagues_test_${Date.now()}`;
await setup.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
url.pathname = '/' + database;
process.env.DATABASE_URL = url.toString();
const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'backend/prisma/schema.prisma'], { env: process.env, encoding: 'utf8' });
assert.equal(migration.status, 0, migration.stderr);
const { app } = await import('../src/app.js');
const { prisma } = await import('../src/lib/prisma.js');
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${(server.address() as {port:number}).port}/api/private-leagues`;
const users = await Promise.all(Array.from({length:9}, (_,i) => prisma.user.create({data:{name:`User ${i}`, email:`u${i}@example.invalid`,passwordHash:'unused'}})));
const tokens = users.map(u => jwt.sign({sub:u.id}, process.env.JWT_SECRET!));
async function api(path:string, user=0, method='GET', body?:unknown, expected=200) {
 const response = await fetch(origin+path, {method,headers:{Authorization:`Bearer ${tokens[user]}`,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
 const data = response.status===204?null:await response.json();
 assert.equal(response.status,expected,JSON.stringify(data));return data;
}
try {
 const now=Date.now();
 const weeks=[];
 for(let number=1;number<=4;number++) weeks.push(await prisma.gameweek.create({data:{number,name:`Week ${number}`,status:number<3?'COMPLETED':'UPCOMING',deadlineAt:new Date(now+(number-2.5)*86400000),startsAt:new Date(now+(number-2)*86400000),endsAt:new Date(now+(number-1)*86400000),marketOpenAt:new Date(now-86400000*7)}}));
 for(const [i,totalPoints] of [120,95,140].entries()) await prisma.userGameweekPoints.create({data:{userId:users[i].id,gameweekId:weeks[0].id,totalPoints,isFinal:true}});
 const form=new FormData();form.append('name','Friends');form.append('logo',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ZQAAAABJRU5ErkJggg==','base64')],{type:'image/png'}),'logo.png');
 const league=await api('',0,'POST',form,201); assert.equal(league.startGameweek,3);assert.ok(league.logoUrl);
 await api('/join',1,'POST',{code:league.inviteCode});
 // Reverse join order to catch inconsistent tie-breaking in /my.
 await prisma.privateLeagueMember.update({where:{leagueId_userId:{leagueId:league.id,userId:users[1].id}},data:{joinedAt:new Date('2020-01-01')}});
 const tied = await api('/'+league.id);
 assert.equal(tied.members[0].id,users[1].id);
 assert.equal((await api('/my',1))[0].rank,tied.members[0].rank);
 assert.deepEqual((await api('/'+league.id)).members.map((m:any)=>m.points),[0,0]);
 await api('',0,'POST',{name:'Second owned'},409);
 for(const [i,totalPoints] of [30,42,25].entries()) await prisma.userGameweekPoints.create({data:{userId:users[i].id,gameweekId:weeks[2].id,totalPoints,isFinal:true}});
 await prisma.gameweek.update({where:{id:weeks[2].id},data:{deadlineAt:new Date(now-1),status:'COMPLETED'}});
 await api('/join',2,'POST',{code:league.inviteCode});
 const detail=await api('/'+league.id);assert.deepEqual(detail.members.map((m:any)=>m.points),[42,30,25]);assert.equal(detail.startGameweek,3);
 assert.equal((await api('/my',2))[0].rank,3);
 assert.equal((await prisma.userGameweekPoints.aggregate({where:{userId:users[2].id,isFinal:true},_sum:{totalPoints:true}}))._sum.totalPoints,165);
 for(let i=3;i<=7;i++) {const other=await api('',i,'POST',{name:`Other ${i}`},201);assert.equal(other.startGameweek,4);await api('/join',0,'POST',{code:other.inviteCode});}
 const extra=await api('',8,'POST',{name:'Overflow'},201);await api('/join',0,'POST',{code:extra.inviteCode},409);
 assert.equal((await api('/my')).length,6);
 const joined=(await api('/my')).find((l:any)=>l.ownerId!==users[0].id);await api('/'+joined.id+'/leave',0,'POST',undefined,204);await api('/join',0,'POST',{code:extra.inviteCode});
 const attempts=await Promise.all(Array.from({length:2},()=>fetch(origin,{method:'POST',headers:{Authorization:`Bearer ${tokens[1]}`,'Content-Type':'application/json'},body:JSON.stringify({name:'Concurrent owned'})})));
 assert.deepEqual(attempts.map(r=>r.status).sort(),[201,409]);
 const {removeAvatar}=await import('../src/services/image-upload.js');await removeAvatar(league.logoUrl);
 console.log('PASS: start week, zero baseline, late join, season totals, image upload, one owned + five joined, leave and rejoin');
} finally {server.close();await prisma.$disconnect();await setup.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`);await setup.$disconnect();}
