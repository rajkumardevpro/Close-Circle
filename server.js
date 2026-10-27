/* CloseCircle — private social app for up to 20 invite-only people
   Posts • 24h Stories • DM + Group chat with text/photo/video • Likes • Comments • Follow
   Single Node server, file DB (data/db.json), uploads in /uploads. No external DB needed. */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cors = require('cors');

const PORT = process.env.PORT || 4173;
const HOST = '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_closecircle_secret_2026';
const MAX_USERS = parseInt(process.env.MAX_USERS || '20', 10);
const DEFAULT_INVITE = process.env.INVITE_CODE || 'FRIENDS20';

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(ROOT, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const uid = () => crypto.randomUUID();
const now = () => Date.now();
const AVATAR_COLOURS = ['#f59e0b','#ec4899','#8b5cf6','#06b6d4','#10b981','#ef4444','#3b82f6','#f97316'];

/* ---------------- DB ---------------- */
function seedDB() {
  const hash = bcrypt.hashSync('demo123', 10);
  const t = now();
  const mk = (username, name, bio, minsAgo) => ({
    id: uid(), username, name, bio, passwordHash: hash, avatarUrl: '',
    colour: AVATAR_COLOURS[Math.floor(Math.random()*AVATAR_COLOURS.length)],
    followers: [], following: [], isAdmin: false, createdAt: t - minsAgo*60000
  });
  const users = [
    mk('priya', 'Priya Sharma', 'Admin 🌸 Our private circle', 60*24*10),
    mk('arjunpat', 'Arjun Patel', 'Photos, chai & road trips ☕', 60*24*9),
    mk('sneha', 'Sneha Patel', 'Foodie 🍲 | Lucknow', 60*24*8),
    mk('Rohan Mehta', 'Rohan Mehta', 'Cricket Sundays 🏏', 60*24*7),
    mk('kavya', 'Kavya Singh', 'Books & sunsets 🌇', 60*24*6),
  ];
  users[0].isAdmin = true;
  users[0].colour = '#ec4899'; users[1].colour='#3b82f6'; users[2].colour='#f59e0b'; users[3].colour='#10b981'; users[4].colour='#8b5cf6';
  // everyone follows everyone (private circle)
  users.forEach(u => { u.following = users.filter(x=>x.id!==u.id).map(x=>x.id); u.followers = users.filter(x=>x.id!==u.id).map(x=>x.id); });

  const posts = [
    { id: uid(), userId: users[1].id, mediaUrl: 'https://picsum.photos/seed/circle1/900/900', mediaType:'image', caption:'Sunday morning ride 🚴‍♂️ Who is joining next week?', likes:[users[0].id, users[2].id, users[4].id], createdAt: t-2*3600000 },
    { id: uid(), userId: users[2].id, mediaUrl: 'https://picsum.photos/seed/circle-food/900/900', mediaType:'image', caption:'Made this today! Recipe in the group chat 😋', likes:[users[0].id, users[1].id], createdAt: t-5*3600000 },
    { id: uid(), userId: users[4].id, mediaUrl: 'https://picsum.photos/seed/circle-sunset/900/900', mediaType:'image', caption:'That sunset though 🌇✨', likes:[users[1].id, users[2].id, users[3].id], createdAt: t-9*3600000 },
    { id: uid(), userId: users[0].id, mediaUrl: 'https://picsum.photos/seed/circle-family/900/900', mediaType:'image', caption:'Welcome to our private CloseCircle! ❤️ Only we 20 can see this. Post freely!', likes: users.map(u=>u.id), createdAt: t-26*3600000 },
  ];
  const comments = [
    { id: uid(), postId: posts[0].id, userId: users[2].id, text:'Count me in! 🙌', createdAt: t-110*60000 },
    { id: uid(), postId: posts[0].id, userId: users[3].id, text:'Same route as last time?', createdAt: t-95*60000 },
    { id: uid(), postId: posts[1].id, userId: users[4].id, text:'Looks amazing 🤤', createdAt: t-4*3600000 },
    { id: uid(), postId: posts[3].id, userId: users[1].id, text:'Finally our own private space 🎉', createdAt: t-25*3600000 },
  ];
  const stories = [
    { id: uid(), userId: users[2].id, mediaUrl:'https://picsum.photos/seed/story1/720/1280', mediaType:'image', viewers:[], createdAt: t-45*60000, expiresAt: t + (24*3600000-45*60000) },
    { id: uid(), userId: users[1].id, mediaUrl:'https://picsum.photos/seed/story2/720/1280', mediaType:'image', viewers:[], createdAt: t-80*60000, expiresAt: t + (24*3600000-80*60000) },
    { id: uid(), userId: users[4].id, mediaUrl:'https://picsum.photos/seed/story3/720/1280', mediaType:'image', viewers:[], createdAt: t-3*3600000, expiresAt: t + 21*3600000 },
    { id: uid(), userId: users[0].id, mediaUrl:'https://picsum.photos/seed/story4/720/1280', mediaType:'image', viewers:[], createdAt: t-6*3600000, expiresAt: t + 18*3600000 },
  ];
  const messages = [
    { id: uid(), conversationId:'group', fromUserId: users[0].id, toUserId:null, text:'Welcome everyone! This is our group chat 👋', mediaUrl:'', mediaType:'', readBy:[users[0].id], createdAt: t-20*3600000 },
    { id: uid(), conversationId:'group', fromUserId: users[3].id, toUserId:null, text:'Hello hello! 🎉', mediaUrl:'', mediaType:'', readBy:[users[3].id], createdAt: t-19*3600000 },
    { id: uid(), conversationId:'group', fromUserId: users[2].id, toUserId:null, text:'Dinner plan this Saturday?', mediaUrl:'', mediaType:'', readBy:[users[2].id], createdAt: t-2*3600000 },
  ];
  return { config:{ inviteCode: DEFAULT_INVITE, appName:'CloseCircle', maxUsers: MAX_USERS }, users, posts, comments, stories, messages, notifications:[] };
}
let db;
function saveDB() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
if (fs.existsSync(DB_FILE)) { try { db = JSON.parse(fs.readFileSync(DB_FILE,'utf8')); } catch { db = seedDB(); saveDB(); } }
else { db = seedDB(); saveDB(); console.log('🌱 Seeded demo data. Demo login: priya / demo123  • Invite code:', db.config.inviteCode); }

/* ---------------- Helpers ---------------- */
const publicUser = (u) => u && ({ id:u.id, username:u.username, name:u.name, bio:u.bio, avatarUrl:u.avatarUrl, colour:u.colour, isAdmin:!!u.isAdmin, followers:u.followers, following:u.following, createdAt:u.createdAt });
const byId = (id) => db.users.find(u=>u.id===id);
function convIdFor(a,b){ return [a,b].sort().join('__'); }
function notify(userId, type, fromUserId, text, refId=''){ if(userId===fromUserId) return; db.notifications.unshift({ id:uid(), userId, type, fromUserId, text, refId, read:false, createdAt:now() }); db.notifications = db.notifications.slice(0,500); }
function enrichPost(p, meId){
  const cs = db.comments.filter(c=>c.postId===p.id);
  return { ...p, user: publicUser(byId(p.userId)), likeCount:p.likes.length, likedByMe: p.likes.includes(meId), commentCount: cs.length };
}
function auth(req,res,next){
  const h = req.headers.authorization||''; const tok = h.startsWith('Bearer ')?h.slice(7):'';
  if(!tok) return res.status(401).json({error:'Please login again'});
  try { const d = jwt.verify(tok, JWT_SECRET); req.user = byId(d.id); if(!req.user) throw 0; next(); }
  catch { return res.status(401).json({error:'Session expired, please login again'}); }
}

/* ---------------- App / Uploads ---------------- */
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors:{ origin:'*'} });
app.use(cors()); app.use(express.json({limit:'2mb'}));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(ROOT,'public'), { extensions:['html'] }));

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req,file,cb)=> cb(null, Date.now()+'-'+crypto.randomBytes(4).toString('hex')+path.extname(file.originalname||'').slice(0,10))
});
const upload = multer({ storage, limits:{ fileSize: 30*1024*1024 },
  fileFilter:(req,file,cb)=>{ if(/^(image|video)\//.test(file.mimetype)) cb(null,true); else cb(new Error('Only photo/video files allowed')); }});
const mediaOf = (file) => file ? ({ mediaUrl:'/uploads/'+file.filename, mediaType: file.mimetype.startsWith('video')?'video':'image' }) : ({mediaUrl:'',mediaType:''});

/* ---------------- Auth ---------------- */
app.get('/api/config', (req,res)=> res.json({ appName: db.config.appName, maxUsers: db.config.maxUsers||MAX_USERS, userCount: db.users.length, spotsLeft: Math.max(0,(db.config.maxUsers||MAX_USERS)-db.users.length) }));

app.post('/api/auth/register', (req,res)=>{
  const { username='', name='', password='', inviteCode='' } = req.body||{};
  const un = String(username).trim().toLowerCase().replace(/[^a-z0-9_.]/g,'');
  if(un.length<3) return res.status(400).json({error:'Username must be at least 3 characters (letters, numbers, _ .)'});
  if(!String(name).trim()) return res.status(400).json({error:'Please enter your name'});
  if(String(password).length<6) return res.status(400).json({error:'Password must be at least 6 characters'});
  if(String(inviteCode).trim().toUpperCase() !== String(db.config.inviteCode).toUpperCase()) return res.status(403).json({error:'Wrong invite code. Ask the admin for the private code.'});
  if(db.users.length >= (db.config.maxUsers||MAX_USERS)) return res.status(403).json({error:`This private circle is full (${db.config.maxUsers} people max).`});
  if(db.users.some(u=>u.username===un)) return res.status(409).json({error:'That username is taken'});
  const u = { id:uid(), username:un, name:String(name).trim().slice(0,60), bio:'', passwordHash:bcrypt.hashSync(String(password),10), avatarUrl:'', colour:AVATAR_COLOURS[db.users.length%AVATAR_COLOURS.length], followers:[], following:[], isAdmin: db.users.length===0, createdAt:now() };
  db.users.push(u);
  // welcome group message
  db.messages.push({ id:uid(), conversationId:'group', fromUserId:u.id, toUserId:null, text:`👋 ${u.name} (@${u.username}) joined CloseCircle!`, mediaUrl:'', mediaType:'', readBy:[u.id], createdAt:now() });
  saveDB();
  const token = jwt.sign({id:u.id}, JWT_SECRET, {expiresIn:'30d'});
  res.json({ token, user: publicUser(u) });
});
app.post('/api/auth/login', (req,res)=>{
  const { username='', password='' } = req.body||{};
  const u = db.users.find(x=>x.username===String(username).trim().toLowerCase());
  if(!u || !bcrypt.compareSync(String(password), u.passwordHash)) return res.status(401).json({error:'Wrong username or password'});
  res.json({ token: jwt.sign({id:u.id}, JWT_SECRET, {expiresIn:'30d'}), user: publicUser(u) });
});
app.get('/api/me', auth, (req,res)=> res.json({ user: publicUser(req.user), inviteCode: req.user.isAdmin ? db.config.inviteCode : undefined, userCount: db.users.length, maxUsers: db.config.maxUsers||MAX_USERS }));
app.put('/api/me', auth, (req,res)=>{ req.user.name = String(req.body.name??req.user.name).trim().slice(0,60)||req.user.name; req.user.bio = String(req.body.bio??req.user.bio).slice(0,160); saveDB(); res.json({user:publicUser(req.user)}); });
app.post('/api/me/avatar', auth, upload.single('media'), (req,res)=>{ if(!req.file) return res.status(400).json({error:'No photo selected'}); req.user.avatarUrl='/uploads/'+req.file.filename; saveDB(); res.json({user:publicUser(req.user)}); });
app.post('/api/admin/invite', auth, (req,res)=>{ if(!req.user.isAdmin) return res.status(403).json({error:'Admin only'}); const c=String(req.body.inviteCode||'').trim().toUpperCase(); if(c.length<4) return res.status(400).json({error:'Code must be at least 4 characters'}); db.config.inviteCode=c; saveDB(); res.json({inviteCode:c}); });

/* ---------------- Users ---------------- */
app.get('/api/users', auth, (req,res)=>{
  const q = String(req.query.q||'').toLowerCase();
  let list = db.users.map(publicUser);
  if(q) list = list.filter(u=>u.username.includes(q)||u.name.toLowerCase().includes(q));
  res.json({ users: list });
});
app.get('/api/users/:username', auth, (req,res)=>{
  const u = db.users.find(x=>x.username===req.params.username.toLowerCase()); if(!u) return res.status(404).json({error:'User not found'});
  const posts = db.posts.filter(p=>p.userId===u.id).sort((a,b)=>b.createdAt-a.createdAt).map(p=>enrichPost(p,req.user.id));
  res.json({ user: publicUser(u), posts, isFollowing: req.user.following.includes(u.id) });
});
app.post('/api/users/:id/follow', auth, (req,res)=>{
  const other = byId(req.params.id); if(!other||other.id===req.user.id) return res.status(400).json({error:'Invalid user'});
  const i = req.user.following.indexOf(other.id);
  let following;
  if(i>=0){ req.user.following.splice(i,1); other.followers = other.followers.filter(x=>x!==req.user.id); following=false; }
  else { req.user.following.push(other.id); other.followers.push(req.user.id); following=true; notify(other.id,'follow',req.user.id,`@${req.user.username} started following you`); }
  saveDB(); res.json({following, user:publicUser(other), me:publicUser(req.user)});
});

/* ---------------- Feed / Posts ---------------- */
app.get('/api/feed', auth, (req,res)=>{
  const posts = [...db.posts].sort((a,b)=>b.createdAt-a.createdAt).slice(0,100).map(p=>enrichPost(p,req.user.id));
  res.json({ posts });
});
app.post('/api/posts', auth, upload.single('media'), (req,res)=>{
  const caption = String(req.body.caption||'').slice(0,1000);
  if(!req.file && !caption.trim()) return res.status(400).json({error:'Add a photo/video or write something'});
  const m = mediaOf(req.file);
  const p = { id:uid(), userId:req.user.id, ...m, caption, likes:[], createdAt:now() };
  db.posts.unshift(p); saveDB();
  const ep = enrichPost(p, req.user.id); io.emit('new_post', ep);
  res.json({ post: ep });
});
app.delete('/api/posts/:id', auth, (req,res)=>{
  const p = db.posts.find(x=>x.id===req.params.id); if(!p) return res.status(404).json({error:'Post not found'});
  if(p.userId!==req.user.id && !req.user.isAdmin) return res.status(403).json({error:'You can only delete your own posts'});
  db.posts = db.posts.filter(x=>x.id!==p.id); db.comments = db.comments.filter(c=>c.postId!==p.id); saveDB(); io.emit('post_deleted',{id:p.id}); res.json({ok:true});
});
app.post('/api/posts/:id/like', auth, (req,res)=>{
  const p = db.posts.find(x=>x.id===req.params.id); if(!p) return res.status(404).json({error:'Post not found'});
  const i = p.likes.indexOf(req.user.id); let liked;
  if(i>=0){ p.likes.splice(i,1); liked=false; } else { p.likes.push(req.user.id); liked=true; notify(p.userId,'like',req.user.id,`@${req.user.username} liked your post`,p.id); }
  saveDB(); res.json({ liked, likeCount:p.likes.length });
});
app.get('/api/posts/:id/comments', auth, (req,res)=>{
  const cs = db.comments.filter(c=>c.postId===req.params.id).sort((a,b)=>a.createdAt-b.createdAt).map(c=>({...c, user:publicUser(byId(c.userId))}));
  res.json({ comments: cs });
});
app.post('/api/posts/:id/comments', auth, (req,res)=>{
  const p = db.posts.find(x=>x.id===req.params.id); if(!p) return res.status(404).json({error:'Post not found'});
  const text = String(req.body.text||'').trim().slice(0,500); if(!text) return res.status(400).json({error:'Write a comment first'});
  const c = { id:uid(), postId:p.id, userId:req.user.id, text, createdAt:now() }; db.comments.push(c);
  notify(p.userId,'comment',req.user.id,`@${req.user.username} commented: “${text.slice(0,60)}”`,p.id); saveDB();
  res.json({ comment:{...c, user:publicUser(req.user)} });
});

/* ---------------- Stories (24h) ---------------- */
app.get('/api/stories', auth, (req,res)=>{
  const t=now(); db.stories = db.stories.filter(s=>s.expiresAt>t);
  const groups={}; [...db.stories].sort((a,b)=>a.createdAt-b.createdAt).forEach(s=>{ (groups[s.userId] ||= { user:publicUser(byId(s.userId)), stories:[], hasUnseen:false }); groups[s.userId].stories.push(s); if(!s.viewers.includes(req.user.id)&&s.userId!==req.user.id) groups[s.userId].hasUnseen=true; });
  res.json({ groups: Object.values(groups).sort((a,b)=>(b.hasUnseen-a.hasUnseen)) });
});
app.post('/api/stories', auth, upload.single('media'), (req,res)=>{
  if(!req.file) return res.status(400).json({error:'Select a photo or video for your story'});
  const m=mediaOf(req.file); const s={ id:uid(), userId:req.user.id, ...m, viewers:[], createdAt:now(), expiresAt:now()+24*3600000 };
  db.stories.push(s); saveDB(); io.emit('new_story',{}); res.json({story:s});
});
app.post('/api/stories/:id/view', auth, (req,res)=>{ const s=db.stories.find(x=>x.id===req.params.id); if(s&&!s.viewers.includes(req.user.id)){s.viewers.push(req.user.id); saveDB();} res.json({ok:true, viewers: s? s.viewers.map(id=>publicUser(byId(id))).filter(Boolean):[]}); });

/* ---------------- Chat ---------------- */
function lastAndUnread(convId, meId){
  const ms = db.messages.filter(m=>m.conversationId===convId);
  return { last: ms[ms.length-1]||null, unread: ms.filter(m=>m.fromUserId!==meId && !m.readBy.includes(meId)).length };
}
function enrichMsg(m){ return {...m, user: publicUser(byId(m.fromUserId))}; }
app.get('/api/conversations', auth, (req,res)=>{
  const convs=[];
  const g = lastAndUnread('group', req.user.id);
  convs.push({ id:'group', type:'group', title:'Everyone 👥', subtitle:`Group chat • ${db.users.length} members`, user:null, lastMessage: g.last?enrichMsg(g.last):null, unread:g.unread });
  db.users.filter(u=>u.id!==req.user.id).forEach(u=>{ const cid=convIdFor(req.user.id,u.id); const x=lastAndUnread(cid,req.user.id); convs.push({ id:cid, type:'dm', title:u.name, subtitle:'@'+u.username, user:publicUser(u), lastMessage:x.last?enrichMsg(x.last):null, unread:x.unread }); });
  convs.sort((a,b)=> ((b.lastMessage?.createdAt||0)-(a.lastMessage?.createdAt||0)) || (a.type==='group'?-1:1));
  res.json({ conversations: convs, online: [...onlineUsers] });
});
app.get('/api/conversations/:id/messages', auth, (req,res)=>{
  const cid = req.params.id;
  if(cid!=='group' && !cid.split('__').includes(req.user.id)) return res.status(403).json({error:'Not your chat'});
  const ms = db.messages.filter(m=>m.conversationId===cid).sort((a,b)=>a.createdAt-b.createdAt).slice(-300);
  // mark read
  let changed=false; ms.forEach(m=>{ if(!m.readBy.includes(req.user.id)){m.readBy.push(req.user.id); changed=true;} }); if(changed) saveDB();
  res.json({ messages: ms.map(enrichMsg) });
});
app.post('/api/chat/upload', auth, upload.single('media'), (req,res)=>{ if(!req.file) return res.status(400).json({error:'No file'}); res.json(mediaOf(req.file)); });

/* ---------------- Notifications ---------------- */
app.get('/api/notifications', auth, (req,res)=>{
  const list = db.notifications.filter(n=>n.userId===req.user.id).slice(0,80).map(n=>({...n, fromUser:publicUser(byId(n.fromUserId))}));
  list.forEach(n=>{ const o=db.notifications.find(x=>x.id===n.id); if(o)o.read=true; }); saveDB();
  res.json({ notifications:list });
});

/* ---------------- Socket.IO (realtime chat + presence) ---------------- */
const onlineUsers = new Set();
io.use((socket,next)=>{ try{ const d=jwt.verify(socket.handshake.auth.token||'', JWT_SECRET); socket.user=byId(d.id); if(!socket.user) throw 0; next(); }catch(e){ next(new Error('unauthorized')); } });
io.on('connection', (socket)=>{
  const me = socket.user; onlineUsers.add(me.id);
  socket.join('user:'+me.id); socket.join('group');
  io.emit('presence', { online:[...onlineUsers] });
  socket.on('send_message', (payload, ack)=>{
    try{
      const text=String(payload?.text||'').trim().slice(0,2000); const mediaUrl=String(payload?.mediaUrl||''); const mediaType=String(payload?.mediaType||'');
      if(!text && !mediaUrl) return;
      let convId, toUserId=null;
      if(payload.conversationId==='group'){ convId='group'; }
      else if(payload.toUserId && byId(payload.toUserId)){ toUserId=payload.toUserId; convId=convIdFor(me.id,toUserId); }
      else if(payload.conversationId && payload.conversationId.split('__').includes(me.id)){ convId=payload.conversationId; toUserId=convId.split('__').find(x=>x!==me.id); }
      else return;
      const m={ id:uid(), conversationId:convId, fromUserId:me.id, toUserId, text, mediaUrl, mediaType, readBy:[me.id], createdAt:now() };
      db.messages.push(m);
      if(toUserId) notify(toUserId,'message',me.id,`@${me.username}: ${text?text.slice(0,60):'📷 sent media'}`, convId);
      saveDB(); const em=enrichMsg(m);
      if(convId==='group') io.to('group').emit('new_message', em);
      else { io.to('user:'+me.id).emit('new_message', em); io.to('user:'+toUserId).emit('new_message', em); }
      if(typeof ack==='function') ack({ok:true, message:em});
    }catch(e){ console.error(e); }
  });
  socket.on('typing', ({conversationId,toUserId}={})=>{
    const data={ conversationId, fromUserId:me.id, username:me.username };
    if(conversationId==='group') socket.to('group').emit('typing',data);
    else if(toUserId) io.to('user:'+toUserId).emit('typing',{...data, conversationId:convIdFor(me.id,toUserId)});
  });
  socket.on('disconnect', ()=>{ // only remove if no other socket for user remains
    const still=[...io.sockets.sockets.values()].some(s=>s.user&&s.user.id===me.id&&s.id!==socket.id);
    if(!still) onlineUsers.delete(me.id); io.emit('presence',{online:[...onlineUsers]});
  });
});

app.use((err,req,res,next)=>{ console.error(err); res.status(400).json({error: err.message||'Something went wrong'}); });
// SPA fallback (not for /api)
app.get('*', (req,res)=>{ if(req.path.startsWith('/api')) return res.status(404).json({error:'Not found'}); res.sendFile(path.join(ROOT,'public','index.html')); });

server.listen(PORT, HOST, ()=> console.log(`✅ CloseCircle running on http://${HOST}:${PORT}  •  Invite: ${db.config.inviteCode}  •  Max users: ${db.config.maxUsers}`));
