import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

// Execute the actual API handlers and migration against SQLite, not SQL mocks.
const build=path.resolve('.test-build');
fs.rmSync(build,{recursive:true,force:true});
fs.mkdirSync(build,{recursive:true});
fs.writeFileSync(path.join(build,'package.json'),'{"type":"commonjs"}');
function compile(directory){
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const source=path.join(directory,entry.name);
  if(entry.isDirectory()){compile(source);continue}
  if(!entry.name.endsWith('.ts'))continue;
  const output=path.join(build,source.replace(/\.ts$/,'.js'));
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText);
 }
}
compile('functions');
const require=createRequire(import.meta.url);
const submit=require(path.join(build,'functions/api/enquiries.js')).onRequest;
const login=require(path.join(build,'functions/api/admin/login.js')).onRequestPost;
const inbox=require(path.join(build,'functions/api/admin/enquiries.js')).onRequestGet;
const logout=require(path.join(build,'functions/api/admin/logout.js')).onRequestPost;
const origin='https://vihacorp.example';
let passed=0;
function fixture(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(fs.readFileSync('migrations/0001_initial.sql','utf8'));
 const DB={prepare(sql){let values=[];return {bind(...args){values=args;return this},async first(){return sqlite.prepare(sql).get(...values)||null},async run(){sqlite.prepare(sql).run(...values);return {success:true}},async all(){return {success:true,results:sqlite.prepare(sql).all(...values)}}}}};
 return {sqlite,env:{DB,ADMIN_PASSWORD:'test-only-admin-passphrase',SESSION_SECRET:'test-only-session-secret-with-32-characters-minimum'}};
}
function request(route,body,options={}){
 const headers={'content-type':'application/json',origin,'cf-connecting-ip':'192.0.2.1',...options.headers};
 return new Request(origin+route,{method:options.method||'POST',headers,...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
}
const valid={name:'Test Customer',email:'CUSTOMER@example.com',company:'Example Works',service:'web',budget:'Discuss together',timeline:'Exploring options',message:'Please create a catalogue website for our factory.',consent:'yes',website:''};
async function test(label,fn){const f=fixture();try{await fn(f);passed++;console.log('PASS',label)}finally{f.sqlite.close()}}
await test('valid enquiry is saved, normalized and assigned a reference',async({env,sqlite})=>{
 const response=await submit({env,request:request('/api/enquiries',valid)});
 assert.equal(response.status,201);const data=await response.json();assert.match(data.reference,/^VIHA-[0-9A-F]{8}$/);
 const row=sqlite.prepare('SELECT * FROM enquiries').get();assert.equal(row.email,'customer@example.com');assert.equal(row.message,valid.message);assert.equal(row.reference,data.reference);
});
await test('cross-origin requests cannot submit enquiries or sign in',async({env,sqlite})=>{
 for(const handler of [submit,login])assert.equal((await handler({env,request:request('/api/enquiries',valid,{headers:{origin:'https://other.example'}})})).status,403);
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM enquiries').get().n,0);
});
await test('invalid fields, missing consent, bots, oversized and malformed bodies are rejected',async({env,sqlite})=>{
 for(const body of [{...valid,consent:undefined},{...valid,email:'invalid'},{...valid,website:'spam'},{...valid,message:'short'},{...valid,message:'x'.repeat(13000)},'{'])assert.equal((await submit({env,request:request('/api/enquiries',body)})).status,400);
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM enquiries').get().n,0);
 assert.equal((await submit({env,request:request('/api/enquiries',undefined,{method:'GET'})})).status,405);
});
await test('customer text is bound safely and stored literally',async({env,sqlite})=>{
 const name="Robert'); DROP TABLE enquiries;--";
 assert.equal((await submit({env,request:request('/api/enquiries',{...valid,name})})).status,201);
 assert.equal(sqlite.prepare('SELECT name FROM enquiries').get().name,name);
});
await test('email limit blocks a fourth enquiry and resets after the window',async({env,sqlite})=>{
 for(let i=0;i<3;i++)assert.equal((await submit({env,request:request('/api/enquiries',valid)})).status,201);
 assert.equal((await submit({env,request:request('/api/enquiries',valid)})).status,429);
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM enquiries').get().n,3);
 sqlite.prepare('UPDATE rate_limits SET reset_at=0').run();
 assert.equal((await submit({env,request:request('/api/enquiries',valid)})).status,201);
});
await test('IP limit applies across email addresses',async({env})=>{
 for(let i=0;i<20;i++)assert.equal((await submit({env,request:request('/api/enquiries',{...valid,email:`customer${i}@example.com`})})).status,201);
 assert.equal((await submit({env,request:request('/api/enquiries',{...valid,email:'another@example.com'})})).status,429);
});
await test('unconfigured storage and database failures never return success',async({env})=>{
 assert.equal((await submit({env:{...env,DB:undefined},request:request('/api/enquiries',valid)})).status,503);
 assert.equal((await submit({env:{...env,DB:{prepare(){throw new Error('database unavailable')}}},request:request('/api/enquiries',valid)})).status,503);
});
await test('inbox requires authentication and handles invalid passwords',async({env})=>{
 assert.equal((await inbox({env,request:request('/api/admin/enquiries',undefined,{method:'GET'})})).status,401);
 assert.equal((await login({env,request:request('/api/admin/login',{password:'wrong'})})).status,401);
 assert.equal((await login({env,request:request('/api/admin/login','{')})).status,400);
 assert.equal((await login({env:{...env,SESSION_SECRET:undefined},request:request('/api/admin/login',{password:env.ADMIN_PASSWORD})})).status,503);
});
await test('signed session opens inbox, rejects tampering and expires',async({env})=>{
 await submit({env,request:request('/api/enquiries',valid)});
 const response=await login({env,request:request('/api/admin/login',{password:env.ADMIN_PASSWORD})});assert.equal(response.status,200);
 const header=response.headers.get('set-cookie');for(const flag of ['__Host-vihacorp_admin=','HttpOnly','Secure','SameSite=Strict','Path=/'])assert.ok(header.includes(flag));
 const cookie=header.split(';')[0];const authenticated=()=>({env,request:request('/api/admin/enquiries',undefined,{method:'GET',headers:{cookie}})});
 const result=await inbox(authenticated());assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');assert.equal((await result.json()).enquiries.length,1);
 assert.equal((await inbox({env,request:request('/api/admin/enquiries',undefined,{method:'GET',headers:{cookie:cookie+'x'}})})).status,401);
 const now=Date.now;try{Date.now=()=>now()+9*3600000;assert.equal((await inbox(authenticated())).status,401)}finally{Date.now=now}
 const cleared=await logout({env,request:request('/api/admin/logout',{})});assert.match(cleared.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await logout({env,request:request('/api/admin/logout',{}, {headers:{origin:'https://other.example'}})})).status,403);
});
await test('repeated password guesses are rate limited',async({env})=>{
 for(let i=0;i<5;i++)assert.equal((await login({env,request:request('/api/admin/login',{password:'wrong'})})).status,401);
 assert.equal((await login({env,request:request('/api/admin/login',{password:env.ADMIN_PASSWORD})})).status,429);
});
console.log(`All ${passed} integration checks passed.`);
