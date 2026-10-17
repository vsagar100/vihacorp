import {z} from 'zod';
import {Env,json,sameOrigin,readJson,takeRateLimit,sha256} from '../_lib/security';
const schema=z.object({name:z.string().trim().min(2).max(100),email:z.string().trim().email().max(254).transform(s=>s.toLowerCase()),company:z.string().trim().max(160).default(''),service:z.enum(['consulting','web','automation','cloud','documents','support','partnership','unsure']),budget:z.enum(['Discuss together','Under ₹25,000','₹25,000–₹75,000','₹75,000–₹2 lakh','₹2 lakh+']),timeline:z.enum(['Exploring options','As soon as practical','Within 1–3 months','3 months or later']),message:z.string().trim().min(20).max(4000),consent:z.literal('yes'),website:z.string().max(0).optional()});
const onRequestPost:PagesFunction<Env>=async({request,env})=>{
 if(!sameOrigin(request))return json({error:'Please submit your enquiry from this website.'},403);
 let input;try{input=schema.safeParse(await readJson(request))}catch{return json({error:'Please check your form and shorten the description if necessary.'},400)}
 if(!input.success)return json({error:'Please complete the required fields and include at least 20 characters of project detail.'},400);
 if(!env.DB)return json({error:'Enquiry storage is not configured yet. Please try again later.'},503);
 try{const ip=request.headers.get('cf-connecting-ip')||'unknown';if(!await takeRateLimit(env,'form-ip:'+await sha256(ip),20,3600000))return json({error:'Too many requests. Please try again in an hour.'},429);
 if(!await takeRateLimit(env,'form-email:'+await sha256(input.data.email),3,3600000))return json({error:'Several enquiries have already been received for this email. Please try again in an hour.'},429);
 const {name,email,company,service,budget,timeline,message}=input.data;const id=crypto.randomUUID(),reference='VIHA-'+id.slice(0,8).toUpperCase();
 await env.DB.prepare('DELETE FROM rate_limits WHERE reset_at < ?').bind(Date.now()-86400000).run();
 await env.DB.prepare('INSERT INTO enquiries (id,reference,name,email,company,service,budget,timeline,message,consent_version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,reference,name,email,company,service,budget,timeline,message,'2026-10-17',Date.now()).run();
 return json({reference},201)
 }catch{return json({error:'We could not save your enquiry right now. Please try again shortly.'},503)}
};
export const onRequest:PagesFunction<Env>=context=>context.request.method==='POST'?onRequestPost(context):json({error:'Method not allowed'},405,{Allow:'POST'});
