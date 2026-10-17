import {Env,json,isAdmin} from '../../_lib/security';
export const onRequestGet:PagesFunction<Env>=async({request,env})=>{
 if(!await isAdmin(request,env))return json({error:'Sign in to view enquiries.'},401);
 try{const result=await env.DB.prepare('SELECT id,reference,name,email,company,service,budget,timeline,message,created_at FROM enquiries ORDER BY created_at DESC LIMIT 200').all();return json({enquiries:result.results})}catch{return json({error:'The enquiry inbox is temporarily unavailable.'},503)}
};
