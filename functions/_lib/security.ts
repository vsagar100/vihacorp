export interface Env {DB:D1Database;ADMIN_PASSWORD?:string;SESSION_SECRET?:string;}
const encoder=new TextEncoder();
export const cookieName='__Host-vihacorp_admin';
export const json=(value:unknown,status=200,headers:Record<string,string>={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export function sameOrigin(request:Request){return request.headers.get('origin')===new URL(request.url).origin;}
export async function readJson(request:Request,limit=12000):Promise<unknown>{
 if(!request.headers.get('content-type')?.includes('application/json'))throw new Error('Unsupported format');
 if(Number(request.headers.get('content-length')||0)>limit)throw new Error('Request too large');
 const reader=request.body?.getReader();if(!reader)throw new Error('Missing body');let size=0;const chunks:Uint8Array[]=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('Request too large')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length}return JSON.parse(new TextDecoder().decode(bytes));
}
export async function sha256(value:string){const digest=await crypto.subtle.digest('SHA-256',encoder.encode(value));return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function passwordMatches(input:string,expected:string){const a=await sha256(input),b=await sha256(expected);let different=0;for(let i=0;i<a.length;i++)different|=a.charCodeAt(i)^b.charCodeAt(i);return different===0;}
function encode(value:Uint8Array){return btoa(String.fromCharCode(...value)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function decode(value:string){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))}
async function key(secret:string){return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
export async function issueSession(secret:string){const payload=encode(encoder.encode(JSON.stringify({purpose:'vihacorp-admin',exp:Date.now()+8*3600000,nonce:crypto.randomUUID()})));const signature=await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(payload));return `${payload}.${encode(new Uint8Array(signature))}`}
export async function isAdmin(request:Request,env:Env){
 if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32||!env.ADMIN_PASSWORD||env.ADMIN_PASSWORD.length<16)return false;
 const cookie=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(!cookie||cookie.length>2000)return false;
 try{const parts=cookie.split('.');if(parts.length!==2)return false;const [payload,signature]=parts;if(!await crypto.subtle.verify('HMAC',await key(env.SESSION_SECRET),decode(signature),encoder.encode(payload)))return false;const data=JSON.parse(new TextDecoder().decode(decode(payload)));return data.purpose==='vihacorp-admin'&&typeof data.exp==='number'&&data.exp>Date.now()&&data.exp<=Date.now()+8*3600000}catch{return false}
}
export async function takeRateLimit(env:Env,keyValue:string,limit:number,windowMs:number){
 const now=Date.now(),reset=now+windowMs;
 const record=await env.DB.prepare('INSERT INTO rate_limits (key,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<=? THEN ? ELSE reset_at END RETURNING attempts').bind(keyValue,reset,now,now,reset).first<{attempts:number}>();
 return !!record&&record.attempts<=limit;
}
