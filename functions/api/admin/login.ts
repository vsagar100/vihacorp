import {Env,json,sameOrigin,readJson,takeRateLimit,sha256,passwordMatches,issueSession,cookieName} from '../../_lib/security';
export const onRequestPost:PagesFunction<Env>=async({request,env})=>{
 if(!sameOrigin(request))return json({error:'Invalid request origin.'},403);
 if(!env.DB||!env.ADMIN_PASSWORD||env.ADMIN_PASSWORD.length<16||!env.SESSION_SECRET||env.SESSION_SECRET.length<32)return json({error:'Admin access is not configured. Complete the Cloudflare setup first.'},503);
 try{const ip=request.headers.get('cf-connecting-ip')||'unknown';if(!await takeRateLimit(env,'login:'+await sha256(ip),5,15*60000))return json({error:'Too many sign-in attempts. Try again in 15 minutes.'},429);
 let data:{password?:unknown}|null;try{data=await readJson(request,1500) as {password?:unknown}|null}catch{return json({error:'Please enter a valid password.'},400)}
 if(typeof data?.password!=='string'||data.password.length>200||!await passwordMatches(data.password,env.ADMIN_PASSWORD))return json({error:'Incorrect admin password.'},401);
 const token=await issueSession(env.SESSION_SECRET);return json({ok:true},200,{'Set-Cookie':`${cookieName}=${token}; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Strict`})
 }catch{return json({error:'Sign-in could not be completed. Please try again.'},503)}
};
