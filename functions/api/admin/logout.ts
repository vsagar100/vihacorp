import {Env,json,sameOrigin,cookieName} from '../../_lib/security';
export const onRequestPost:PagesFunction<Env>=async({request})=>sameOrigin(request)?json({ok:true},200,{'Set-Cookie':`${cookieName}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`}):json({error:'Invalid request origin.'},403);
