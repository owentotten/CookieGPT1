import http from 'node:http';
import {createHmac, timingSafeEqual, randomBytes, scryptSync} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||3000);
const SYSTEM=`You are CookieGPT, a thoughtful, precise AI college coursework tutor. Your name honors a person named Cookie, not food. Never use baking puns or cookie metaphors. Help with college-level coursework across mathematics, statistics, writing, research, computer science, business, science, and humanities. Ask clarifying questions when essential. Prefer clear, accurate, student-friendly explanations and worked examples. For math show steps and verify results. For code explain the approach and include runnable examples. For papers help plan, outline, revise, and cite appropriately; never invent citations, page numbers, quotations, or research findings. For quizzes offer interactive practice and feedback. Support independent learning; when asked for a direct answer, provide it with concise reasoning rather than being evasive. Acknowledge uncertainty and distinguish assumptions from facts. Never claim to have seen a syllabus or assignment unless provided. Be friendly, direct, and professional.`;
const send=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj))};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const secret=process.env.SESSION_SECRET||'';
const password=process.env.COOKIEGPT_PASSWORD||'';
if(!secret||secret.length<32||!password||password.length<12){console.error('Set SESSION_SECRET (32+ characters) and COOKIEGPT_PASSWORD (12+ characters)');process.exit(1)}
const secure=process.env.NODE_ENV==='production';
const signature=v=>createHmac('sha256',secret).update(v).digest('hex');
const auth=req=>{const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('cg_session='));if(!cookie)return false;const [expires,sig]=(cookie.slice(11)).split('.');if(!expires||!sig||!/^\d+$/.test(expires)||Number(expires)<Date.now())return false;const expected=signature(expires);return sig.length===expected.length&&timingSafeEqual(Buffer.from(sig),Buffer.from(expected))};
const attempts=new Map();
const body=async req=>{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>250000)throw Error('Request too large')}return JSON.parse(raw)};
const sameOrigin=req=>{const origin=req.headers.origin;if(!origin)return false;try{const u=new URL(origin);return u.host===req.headers.host&&(u.protocol==='https:'||!secure&&u.protocol==='http:')}catch{return false}};
const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Cache-Control':'no-store'};
http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
 if(req.method==='POST'&&req.url==='/api/login'){
  if(!sameOrigin(req))return send(res,403,{error:'Invalid origin'});
  const ip=(req.socket.remoteAddress||'unknown');const now=Date.now();const a=attempts.get(ip)||{n:0,until:now+900000};if(now>a.until){a.n=0;a.until=now+900000}if(a.n>=10)return send(res,429,{error:'Too many attempts. Try again in 15 minutes.'});
  try{const data=await body(req);const given=typeof data.password==='string'?data.password:'';const salt='CookieGPT-password-check-v1';const x=scryptSync(given,salt,64),y=scryptSync(password,salt,64);if(!timingSafeEqual(x,y)){a.n++;attempts.set(ip,a);return send(res,401,{error:'Incorrect password'})}attempts.delete(ip);const expires=String(Date.now()+7*86400000);res.setHeader('Set-Cookie',`cg_session=${expires}.${signature(expires)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure?'; Secure':''}`);return send(res,200,{ok:true})}catch{return send(res,400,{error:'Invalid request'})}
 }
 if(req.method==='GET'&&req.url==='/api/session')return send(res,200,{authenticated:auth(req)});
 if(req.method==='POST'&&req.url==='/api/logout'){if(!sameOrigin(req))return send(res,403,{error:'Invalid origin'});res.setHeader('Set-Cookie',`cg_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure?'; Secure':''}`);return send(res,200,{ok:true})}
 if(req.method==='POST'&&req.url==='/api/chat'){
  if(!auth(req))return send(res,401,{error:'Please sign in again'});
  if(!sameOrigin(req))return send(res,403,{error:'Invalid origin'});
  if(!process.env.OPENAI_API_KEY)return send(res,503,{error:'Server is missing OPENAI_API_KEY. Add it to the environment and restart.'});
  let raw='';try{for await(const chunk of req){raw+=chunk;if(raw.length>250000)throw Error('Request too large')}const body=JSON.parse(raw);if(!Array.isArray(body.messages))return send(res,400,{error:'Invalid messages'});
   const messages=body.messages.slice(-24).filter(m=>['user','assistant'].includes(m.role)&&typeof m.content==='string').map(m=>({role:m.role,content:m.content.slice(0,12000)}));
   if(!messages.length||messages.at(-1).role!=='user')return send(res,400,{error:'Missing user message'});
   const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',messages:[{role:'system',content:SYSTEM},...messages],temperature:0.4})});
   const data=await response.json();if(!response.ok)return send(res,response.status,{error:data.error?.message||'AI request failed'});
   return send(res,200,{reply:data.choices?.[0]?.message?.content||'No response received.'});
  }catch(e){return send(res,500,{error:e.message||'Unexpected server error'})}
 }
 if(req.method!=='GET')return send(res,405,{error:'Method not allowed'});
 let url;try{url=new URL(req.url,'http://localhost')}catch{return send(res,400,{error:'Invalid URL'})}
 const pathname=url.pathname==='/'?'/index.html':url.pathname;
 if(pathname!=='/login.html'&&!auth(req)){res.writeHead(302,{Location:'/login.html',...headers});return res.end() }
 if(pathname==='/login.html'&&auth(req)){res.writeHead(302,{Location:'/',...headers});return res.end()}
const file = await readFile(path.join(base,pathname));

try{const file=await readFile(path.join(base,pathname.slice(1)));res.writeHead(200,{'Content-Type':types[path.extname(pathname)],...headers});res.end(file)}catch{res.writeHead(404);res.end('Not found')}
 // Serve website files
 const allowedFiles = new Set([
  '/index.html',
  '/login.html',
  '/app.js',
  '/styles.css'
 ]);

 if (!allowedFiles.has(pathname)) {
  res.writeHead(404, headers);
  return res.end('Not found');
 }

 try {
  // Files are in the same folder as server.js
  const file = await readFile(
   path.join(base, pathname.slice(1))
  );

  res.writeHead(200, {
   'Content-Type': types[path.extname(pathname)],
   ...headers
  });

  res.end(file);
 } catch (error) {
  console.error('File serving error:', error.message);
  res.writeHead(404, headers);
  res.end('Not found');
 }

}).listen(PORT, '0.0.0.0', () => {
 console.log(`CookieGPT running on port ${PORT}`);
});
