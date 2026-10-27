/* CloseCircle frontend — vanilla SPA */
const $ = (s,el=document)=>el.querySelector(s);
const app = $('#app');
let token = localStorage.getItem('cc_token')||'';
let me = null, socket=null, online=new Set(), deferredInstall=null;
let view='home', currentChat=null, currentProfile=null, feedCache=[], convCache=[], storyGroups=[];
let pendingFile=null, pendingKind='post', cachedUsers=[];

window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredInstall=e; renderInstallHints(); });
const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials = u=> (u?.name||u?.username||'?').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
function avatarHTML(u,size=40,extra=''){ if(!u) return `<div class="avatar" style="width:${size}px;height:${size}px"></div>`;
  return `<div class="avatar ${extra}" style="width:${size}px;height:${size}px;background:${esc(u.colour||'#555')};font-size:${Math.max(12,size*0.36)}px">${u.avatarUrl?`<img src="${esc(u.avatarUrl)}" alt=""/>`:esc(initials(u))}</div>`; }
function timeAgo(ts){ const s=(Date.now()-ts)/1000; if(s<60) return 'now'; if(s<3600) return Math.floor(s/60)+'m'; if(s<86400) return Math.floor(s/3600)+'h'; if(s<604800) return Math.floor(s/86400)+'d'; return new Date(ts).toLocaleDateString(); }
function clock(ts){ return new Date(ts).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}); }
function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2600); }
async function api(path, opts={}){ const r=await fetch(path,{...opts, headers:{'Content-Type':'application/json', ...(token?{Authorization:'Bearer '+token}:{}) , ...(opts.headers||{})}}); const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error||'Something went wrong'); return d; }
async function apiForm(path, form){ const r=await fetch(path,{method:'POST', headers: token?{Authorization:'Bearer '+token}:{}, body:form}); const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error||'Upload failed'); return d; }

/* ---------- AUTH ---------- */
async function renderAuth(mode='login', err='', ok=''){
  let cfg={userCount:0,maxUsers:20,spotsLeft:20}; try{ cfg=await api('/api/config'); }catch{}
  app.innerHTML=`<div class="phone authWrap">
    <div class="logo">Close<span>Circle</span></div>
    <p class="tagline">Our own private Instagram — only for our people.<br/>Posts • Stories • Chat with photo/video</p>
    <div class="center"><span class="pill">🔒 Invite-only • ${cfg.userCount}/${cfg.maxUsers} members • ${cfg.spotsLeft} spots left</span></div>
    <div class="card">
      <div class="tabs"><button class="${mode==='login'?'on':''}" id="tabLogin">Log in</button><button class="${mode==='register'?'on':''}" id="tabReg">Sign up</button></div>
      ${mode==='register'?`<label>Your name</label><input id="f_name" placeholder="e.g. Priya Sharma" autocomplete="name"/>`:''}
      <label>Username</label><input id="f_user" placeholder="e.g. priya" autocomplete="username" autocapitalize="none"/>
      <label>Password</label><input id="f_pass" type="password" placeholder="••••••••" autocomplete="${mode==='login'?'current-password':'new-password'}"/>
      ${mode==='register'?`<label>Private invite code</label><input id="f_invite" placeholder="Ask admin for the code" autocapitalize="characters"/><p class="hint">Only people with this code can join. Max ${cfg.maxUsers} people.</p>`:''}
      ${err?`<div class="err">${esc(err)}</div>`:''}${ok?`<div class="ok">${esc(ok)}</div>`:''}
      <button class="btn" id="submitBtn">${mode==='login'?'Log in':'Create my account'}</button>
      <div class="demoBox"><b>👀 Just want to try the demo?</b><br/>Username <code>priya</code> • Password <code>demo123</code><br/>Invite code for new accounts: <code>FRIENDS20</code> <span style="color:#a1a1aa">(admin can change it inside)</span><br/><button class="btn grey" id="demoBtn" style="margin-top:10px">▶ One-tap demo login</button></div>
      <p class="hint">📱 <b>Install on Android:</b> open this page in Chrome → menu ⋮ → <b>Install app / Add to Home screen</b>. It will work like a real app with its own icon.</p>
    </div></div>`;
  $('#tabLogin').onclick=()=>renderAuth('login'); $('#tabReg').onclick=()=>renderAuth('register');
  const submit=async()=>{ try{
      let data;
      if(mode==='login') data=await api('/api/auth/login',{method:'POST', body:JSON.stringify({username:$('#f_user').value,password:$('#f_pass').value})});
      else data=await api('/api/auth/register',{method:'POST', body:JSON.stringify({name:$('#f_name').value,username:$('#f_user').value,password:$('#f_pass').value,inviteCode:$('#f_invite').value})});
      token=data.token; localStorage.setItem('cc_token',token); me=data.user; boot();
    }catch(e){ renderAuth(mode,e.message); } };
  $('#submitBtn').onclick=submit;
  document.addEventListener('keydown', function h(e){ if(e.key==='Enter'){ document.removeEventListener('keydown',h); submit(); }});
  $('#demoBtn').onclick=async()=>{ try{ const d=await api('/api/auth/login',{method:'POST',body:JSON.stringify({username:'priya',password:'demo123'})}); token=d.token; localStorage.setItem('cc_token',token); me=d.user; boot(); }catch(e){ toast(e.message);} };
}

/* ---------- SHELL ---------- */
function shell(inner, {title=null, showDM=true}={}){
  const unread = convCache.reduce((a,c)=>a+(c.unread||0),0);
  app.innerHTML=`<div class="phone"><div class="mainPad">
    <div class="topbar"><div class="brand">Close<span>Circle</span></div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="iconBtn" id="navActivity" title="Activity">♡</button>
        ${showDM?`<button class="iconBtn" id="navDM" title="Messages">✈️${unread?`<span class="badge">${unread}</span>`:''}</button>`:''}
      </div></div>
    ${inner}
  </div>
  <nav class="bottomNav">
    <button data-nav="home" class="${view==='home'?'on':''}">🏠</button>
    <button data-nav="search" class="${view==='search'?'on':''}">🔍</button>
    <button data-nav="create" class="${view==='create'?'on':''}">➕</button>
    <button data-nav="chat" class="${view==='chat'?'on':''}">💬</button>
    <button data-nav="profile" class="${view==='profile'?'on':''}">${avatarHTML(me,27,'navAvatar')}</button>
  </nav></div>`;
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>go(b.dataset.nav));
  const dm=$('#navDM'); if(dm) dm.onclick=()=>go('chat');
  $('#navActivity').onclick=()=>go('activity');
}
function go(v, arg){ view=v; if(v==='home') renderHome(); else if(v==='search') renderSearch(); else if(v==='create') renderCreate(); else if(v==='chat') renderChatList(); else if(v==='profile') renderProfile(me.username); else if(v==='activity') renderActivity(); else if(v==='user') renderProfile(arg); else if(v==='thread') renderThread(arg); window.scrollTo(0,0); }
function renderInstallHints(){ /* banner appears on home re-render */ }

/* ---------- HOME ---------- */
async function renderHome(){
  shell(`<div id="storiesBox" class="stories"></div><div id="installBox"></div><div id="feedBox"><div class="empty">Loading your circle…</div></div>`);
  if(deferredInstall){ $('#installBox').innerHTML=`<div class="installBar">📱 <b>Install CloseCircle on your phone</b> — full-screen app with its own icon, no Play Store needed.<br/><button class="btn small" id="installBtn" style="margin-top:8px">⬇ Install app</button></div>`; $('#installBtn').onclick=async()=>{ deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall=null; renderHome(); }; }
  loadStories(); loadFeed(); loadConversations(true);
}
async function loadStories(){ try{ const d=await api('/api/stories'); storyGroups=d.groups;
  const myGroup=storyGroups.find(g=>g.user.id===me.id); const others=storyGroups.filter(g=>g.user.id!==me.id);
  $('#storiesBox').innerHTML=`
    <div class="storyItem"><button id="myStoryBtn"><div class="${myGroup?'ring':'ring seen'} plusBadge"><div class="inner">${avatarHTML(me,58)}</div></div></button><div class="name">Your story</div></div>
    ${others.map((g,i)=>`<div class="storyItem"><button data-story="${g.user.id}"><div class="ring ${g.hasUnseen?'':'seen'}"><div class="inner">${avatarHTML(g.user,58)}</div></div></button><div class="name">${esc(g.user.username)}</div></div>`).join('')}`;
  $('#myStoryBtn').onclick=()=>{ if(myGroup) openStoryViewer(myGroup); else { pendingKind='story'; pickFile(f=>{ pendingFile=f; renderCreate('story'); }); } };
  document.querySelectorAll('[data-story]').forEach(b=>b.onclick=()=>{ const g=storyGroups.find(x=>x.user.id===b.dataset.story); if(g) openStoryViewer(g); });
 }catch(e){} }
function postHTML(p){ return `<article class="post" id="post-${p.id}">
  <div class="postHead"><button data-user="${esc(p.user.username)}">${avatarHTML(p.user,38)}</button><div class="who"><button data-user="${esc(p.user.username)}" class="uname">${esc(p.user.username)}</button><div class="time">${timeAgo(p.createdAt)} ago</div></div>${(p.userId===me.id||me.isAdmin)?`<button data-delpost="${p.id}" title="Delete">🗑️</button>`:''}</div>
  ${p.mediaUrl?`<div class="postMedia">${p.mediaType==='video'?`<video src="${esc(p.mediaUrl)}" controls playsinline preload="metadata"></video>`:`<img src="${esc(p.mediaUrl)}" loading="lazy" alt=""/>`}</div>`:''}
  <div class="postActions"><button data-like="${p.id}">${p.likedByMe?'❤️':'♡'}</button><button data-comments="${p.id}">💬</button><button data-share="${p.id}">✈️</button><span class="sp"></span></div>
  <div class="likes" data-likes="${p.id}">${p.likeCount} likes</div>
  ${p.caption?`<div class="caption"><b>${esc(p.user.username)}</b>${esc(p.caption)}</div>`:''}
  <button class="viewComments" data-comments="${p.id}">${p.commentCount?`View all ${p.commentCount} comments`:'Add a comment…'}</button>
</article>`; }
function bindPostEvents(root=document){
  root.querySelectorAll('[data-user]').forEach(b=>b.onclick=()=>go('user',b.dataset.user));
  root.querySelectorAll('[data-like]').forEach(b=>b.onclick=async()=>{ const id=b.dataset.like; try{ const d=await api(`/api/posts/${id}/like`,{method:'POST',body:'{}'}); b.textContent=d.liked?'❤️':'♡'; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); const l=document.querySelector(`[data-likes="${id}"]`); if(l) l.textContent=d.likeCount+' likes'; const p=feedCache.find(x=>x.id===id); if(p){p.likedByMe=d.liked;p.likeCount=d.likeCount;} }catch(e){toast(e.message);} });
  root.querySelectorAll('[data-comments]').forEach(b=>b.onclick=()=>openComments(b.dataset.comments));
  root.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>{ go('chat'); toast('Pick a person or the group to share in chat 💬'); });
  root.querySelectorAll('[data-delpost]').forEach(b=>b.onclick=async()=>{ if(!confirm('Delete this post?'))return; try{ await api(`/api/posts/${b.dataset.delpost}`,{method:'DELETE'}); document.getElementById('post-'+b.dataset.delpost)?.remove(); toast('Post deleted'); }catch(e){toast(e.message);} });
}
async function loadFeed(){ try{ const d=await api('/api/feed'); feedCache=d.posts; const box=$('#feedBox'); if(!box) return;
  box.innerHTML= feedCache.length? feedCache.map(postHTML).join('') : `<div class="empty"><span class="big">📸</span>No posts yet.<br/>Tap <b>➕</b> below to share the first photo with your circle!</div>`; bindPostEvents(box);
 }catch(e){ const b=$('#feedBox'); if(b) b.innerHTML=`<div class="empty">${esc(e.message)}</div>`; } }

/* comments sheet */
async function openComments(postId){
  const ov=document.createElement('div'); ov.className='overlay'; ov.innerHTML=`<div class="sheet"><h3>Comments</h3><div id="cList">Loading…</div>
  <div style="display:flex;gap:8px;margin-top:12px"><input id="cInput" placeholder="Add a comment…"/><button class="sendBtn" id="cSend">Post</button></div>
  <button class="btn grey" id="cClose">Close</button></div>`; document.body.appendChild(ov);
  const close=()=>ov.remove(); ov.onclick=e=>{if(e.target===ov)close();}; $('#cClose',ov).onclick=close;
  async function reload(){ const d=await api(`/api/posts/${postId}/comments`); $('#cList',ov).innerHTML= d.comments.length? d.comments.map(c=>`<div class="commentRow">${avatarHTML(c.user,34)}<div><b>${esc(c.user.username)}</b> ${esc(c.text)}<div class="time">${timeAgo(c.createdAt)}</div></div></div>`).join('') : '<p class="sub">No comments yet. Be first!</p>'; }
  await reload();
  const send=async()=>{ const t=$('#cInput',ov).value.trim(); if(!t)return; try{ await api(`/api/posts/${postId}/comments`,{method:'POST',body:JSON.stringify({text:t})}); $('#cInput',ov).value=''; await reload(); const p=feedCache.find(x=>x.id===postId); if(p)p.commentCount++; }catch(e){toast(e.message);} };
  $('#cSend',ov).onclick=send; $('#cInput',ov).addEventListener('keydown',e=>{if(e.key==='Enter')send();});
}

/* story viewer */
function openStoryViewer(group){ let idx=0, timer=null;
  const ov=document.createElement('div'); ov.className='storyViewer'; document.body.appendChild(ov);
  function show(){ const s=group.stories[idx]; if(!s){ ov.remove(); loadStories(); return; }
    api(`/api/stories/${s.id}/view`,{method:'POST',body:'{}'}).catch(()=>{});
    ov.innerHTML=`<div class="progress">${group.stories.map((x,i)=>`<i><b style="width:${i<idx?100:0}%"></b></i>`).join('')}</div>
    <div class="storyTop">${avatarHTML(group.user,36)}<div style="flex:1"><b>${esc(group.user.username)}</b> <span class="time">${timeAgo(s.createdAt)}</span><div class="time">Disappears in ${Math.max(0,Math.round((s.expiresAt-Date.now())/3600000))}h • 👁 ${(s.viewers||[]).length} views</div></div><button id="sClose" style="font-size:24px">✕</button></div>
    <div class="media" id="sMedia">${s.mediaType==='video'?`<video src="${esc(s.mediaUrl)}" autoplay playsinline></video>`:`<img src="${esc(s.mediaUrl)}"/>`}</div>
    <div style="display:flex;gap:10px;padding:12px"><button class="btn grey" id="sPrev">← Prev</button><button class="btn" id="sNext" style="margin-top:16px">Next →</button></div>`;
    $('#sClose',ov).onclick=()=>{clearTimeout(timer);ov.remove();loadStories();};
    $('#sNext',ov).onclick=()=>{clearTimeout(timer);idx++;show();};
    $('#sPrev',ov).onclick=()=>{clearTimeout(timer);idx=Math.max(0,idx-1);show();};
    const vid=$('video',ov); if(vid){ vid.onended=()=>{idx++;show();}; }
    const bar=ov.querySelectorAll('.progress i b')[idx]; let start=Date.now(); const dur= vid? 60000:5000;
    (function tick(){ if(!document.body.contains(ov))return; const p=Math.min(100,(Date.now()-start)/dur*100); if(bar)bar.style.width=p+'%'; if(p<100) requestAnimationFrame(tick); })();
    if(!vid) timer=setTimeout(()=>{idx++;show();},5000);
  } show();
}

/* ---------- SEARCH / MEMBERS ---------- */
async function renderSearch(){ shell(`<div class="viewTitle">Our circle 👥</div><div class="sub">Only invited people are here. Tap a person to see their profile or message them.</div><div class="searchBox"><input id="q" placeholder="Search people…"/></div><div id="userList"></div>`);
  async function load(q=''){ const d=await api('/api/users'+(q?('?q='+encodeURIComponent(q)):'')); cachedUsers=d.users;
    $('#userList').innerHTML=d.users.map(u=>`<div class="row"><button class="rel" data-u="${esc(u.username)}">${avatarHTML(u,50)}${online.has(u.id)?'<span class="dot"></span>':''}</button><button class="grow" data-u="${esc(u.username)}" style="text-align:left"><div class="t1">${esc(u.name)} ${u.id===me.id?'<span class="time">(you)</span>':''} ${u.isAdmin?'<span class="time">• admin</span>':''}</div><div class="t2">@${esc(u.username)} • ${online.has(u.id)?'🟢 online':'offline'}</div></button>${u.id!==me.id?`<button class="btn small blue" data-msg="${u.id}">Message</button>`:''}</div>`).join('')||'<div class="empty">No one found</div>';
    document.querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>go('user',b.dataset.u));
    document.querySelectorAll('[data-msg]').forEach(b=>b.onclick=()=>openThreadWith(b.dataset.msg));
  } load(); let deb; $('#q').oninput=e=>{clearTimeout(deb);deb=setTimeout(()=>load(e.target.value),200);};
}

/* ---------- CREATE ---------- */
function pickFile(cb){ const p=$('#filePicker'); p.value=''; p.onchange=()=>{ if(p.files[0]) cb(p.files[0]); }; p.click(); }
function renderCreate(kind){ pendingKind=kind||pendingKind||'post'; view='create';
  const preview = pendingFile? `<div class="preview">${pendingFile.type.startsWith('video')?`<video src="${URL.createObjectURL(pendingFile)}" controls playsinline></video>`:`<img src="${URL.createObjectURL(pendingFile)}"/>`}</div>`:'';
  shell(`<div style="padding:14px"><div class="viewTitle" style="padding:2px 0">Create ✨</div>
    <div class="choiceRow"><button class="choice ${pendingKind==='post'?'on':''}" id="chPost"><span class="big">🖼️</span><br/><b>Post</b><br/><span class="time">Stay on feed forever</span></button>
    <button class="choice ${pendingKind==='story'?'on':''}" id="chStory"><span class="big">⭕</span><br/><b>Story</b><br/><span class="time">Disappears in 24 hours</span></button></div>
    <button class="btn grey" id="pickBtn">📷 Choose photo / video</button>
    ${preview}
    ${pendingKind==='post'?`<label>Caption</label><textarea id="caption" placeholder="Write a caption…"></textarea>`:''}
    <div id="createErr"></div>
    <button class="btn" id="shareBtn">${pendingKind==='story'?'Share story':'Share post'}</button>
    <p class="hint">Photo or video up to 30 MB. Only your private circle can see it.</p></div>`);
  $('#chPost').onclick=()=>renderCreate('post'); $('#chStory').onclick=()=>renderCreate('story');
  $('#pickBtn').onclick=()=>pickFile(f=>{pendingFile=f; renderCreate(pendingKind);});
  $('#shareBtn').onclick=async()=>{ try{ $('#createErr').innerHTML='';
      if(!pendingFile && pendingKind==='story') throw new Error('Choose a photo/video first');
      const form=new FormData(); if(pendingFile) form.append('media',pendingFile);
      if(pendingKind==='post'){ form.append('caption',$('#caption')?.value||''); await apiForm('/api/posts',form); toast('Posted to your circle 🎉'); }
      else { await apiForm('/api/stories',form); toast('Story added ⭕'); }
      pendingFile=null; go('home');
    }catch(e){ $('#createErr').innerHTML=`<div class="err">${esc(e.message)}</div>`; } };
}

/* ---------- CHAT ---------- */
async function loadConversations(silent=false){ try{ const d=await api('/api/conversations'); convCache=d.conversations; online=new Set(d.online||[]); if(!silent||view==='home'){ /* refresh badge by re-render only on chat list */ if(view==='chat') renderChatList(true); } }catch{} }
async function renderChatList(keep=false){
  if(!keep) shell(`<div class="viewTitle">Messages 💬</div><div class="sub">Group chat + private DMs. Send text, photos & videos. 🟢 = online now.</div><div id="convList"><div class="empty">Loading chats…</div></div>`);
  try{ const d=await api('/api/conversations'); convCache=d.conversations; online=new Set(d.online||online);
    const box=$('#convList'); if(!box) return;
    box.innerHTML=convCache.map(c=>{ const last=c.lastMessage; const isOnline=c.user&&online.has(c.user.id);
      return `<button class="row" data-conv="${c.id}" data-type="${c.type}" data-uid="${c.user?c.user.id:''}"><span class="rel">${c.type==='group'?`<div class="avatar" style="width:52px;height:52px;background:linear-gradient(45deg,#f59e0b,#ec4899)">👥</div>`:avatarHTML(c.user,52)}${isOnline?'<span class="dot"></span>':''}</span><span class="grow"><span class="t1">${esc(c.title)}</span><span class="t2" style="display:block">${last? esc((last.user?.id===me.id?'You: ':'')+(last.text||'📷 Photo/video')) : esc(c.subtitle)} ${last?'• '+timeAgo(last.createdAt):''}</span></span>${c.unread?`<span class="unread">${c.unread}</span>`:''}</button>`; }).join('');
    box.querySelectorAll('[data-conv]').forEach(b=>b.onclick=()=>{ currentChat={ id:b.dataset.conv, type:b.dataset.type, userId:b.dataset.uid||null }; renderThread(currentChat); });
  }catch(e){ const b=$('#convList'); if(b)b.innerHTML=`<div class="empty">${esc(e.message)}</div>`; }
}
function openThreadWith(userId){ const ids=[me.id,userId].sort().join('__'); currentChat={id:ids,type:'dm',userId}; view='thread'; renderThread(currentChat); }
async function renderThread(chat){ currentChat=chat; view='thread';
  let title='Everyone 👥', other=null;
  if(chat.type==='dm'){ try{ const d=await api('/api/users'); other=d.users.find(u=>u.id===chat.userId); title=other?other.name:'Chat'; }catch{} }
  app.innerHTML=`<div class="phone"><div class="chatHead"><button id="backBtn" style="font-size:22px">←</button>${other?avatarHTML(other,38):`<div class="avatar" style="width:38px;height:38px;background:linear-gradient(45deg,#f59e0b,#ec4899)">👥</div>`}<div style="flex:1"><b>${esc(title)}</b><div class="time">${chat.type==='group'?'Group chat • everyone in the circle':(other&&online.has(other.id)?'🟢 Online now':'Offline')} </div></div></div>
  <div class="chatBody" id="chatBody"></div><div class="typing" id="typingBox"></div>
  <div class="chatInput"><button class="attachBtn" id="attachBtn" title="Send photo/video">📷</button><input id="msgInput" placeholder="Message…"/><button class="sendBtn" id="sendBtn">Send</button></div></div>`;
  $('#backBtn').onclick=()=>go('chat');
  const body=$('#chatBody');
  function addMsg(m){ const mine=m.fromUserId===me.id; const div=document.createElement('div'); div.className='msg '+(mine?'me':'them'); div.dataset.mid=m.id;
    div.innerHTML=`${(!mine&&chat.type==='group')?`<div class="sender">${esc(m.user?.name||m.user?.username||'')}</div>`:''}${m.mediaUrl?(m.mediaType==='video'?`<video src="${esc(m.mediaUrl)}" controls playsinline></video>`:`<img src="${esc(m.mediaUrl)}"/>`):''}${m.text?`<div>${esc(m.text)}</div>`:''}<div class="meta">${clock(m.createdAt)}${mine?' ✓':''}</div>`; body.appendChild(div); body.scrollTop=body.scrollHeight; window.scrollTo(0,document.body.scrollHeight); }
  window._addMsg=addMsg;
  try{ const d=await api(`/api/conversations/${encodeURIComponent(chat.id)}/messages`); body.innerHTML= d.messages.length?'':'<div class="empty">Say hello 👋<br/>Send a message, photo or video.</div>'; d.messages.forEach(addMsg); }catch(e){ body.innerHTML=`<div class="empty">${esc(e.message)}</div>`; }
  const sendText=()=>{ const v=$('#msgInput').value.trim(); if(!v)return; $('#msgInput').value='';
    if(socket) socket.emit('send_message',{conversationId:chat.id,toUserId:chat.userId,text:v}); };
  $('#sendBtn').onclick=sendText; $('#msgInput').addEventListener('keydown',e=>{ if(e.key==='Enter')sendText(); else if(socket) socket.emit('typing',{conversationId:chat.id,toUserId:chat.userId}); });
  $('#attachBtn').onclick=()=>pickFile(async f=>{ try{ toast('Uploading…'); const form=new FormData(); form.append('media',f); const up=await apiForm('/api/chat/upload',form); const caption=$('#msgInput').value.trim(); $('#msgInput').value=''; socket.emit('send_message',{conversationId:chat.id,toUserId:chat.userId,text:caption,mediaUrl:up.mediaUrl,mediaType:up.mediaType}); }catch(e){toast(e.message);} });
  loadConversations(true);
}

/* ---------- PROFILE ---------- */
async function renderProfile(username){ view = (username===me.username)?'profile':'user'; currentProfile=username;
  shell(`<div id="profBox"><div class="empty">Loading profile…</div></div>`);
  try{ const d=await api('/api/users/'+encodeURIComponent(username)); const u=d.user; const isMe=u.id===me.id;
    let adminBox='';
    if(isMe){ try{ const m=await api('/api/me'); if(m.inviteCode) adminBox=`<div class="installBar">🔑 <b>Admin — invite code:</b> <span class="kbd">${esc(m.inviteCode)}</span><br/>${m.userCount}/${m.maxUsers} members joined. Share this code only with your 20 people.<br/><span style="display:flex;gap:8px;margin-top:8px"><input id="newInvite" placeholder="New code (optional)" style="flex:1"/><button class="btn small" id="chInvite">Change</button></span></div>`; }catch{} }
    $('#profBox').innerHTML=`
    <div class="profileTop">${avatarHTML(u,82)}<div class="stats"><div><b>${d.posts.length}</b><span>posts</span></div><div><b>${u.followers.length}</b><span>followers</span></div><div><b>${u.following.length}</b><span>following</span></div></div></div>
    <div class="bioBox"><b>${esc(u.name)}</b> <span class="time">@${esc(u.username)}${online.has(u.id)?' • 🟢 online':''}</span><br/>${esc(u.bio||'')}</div>
    <div class="twoBtns">${isMe?`<button class="btn grey" id="editBtn">Edit profile</button><button class="btn outline" id="logoutBtn">Log out</button>`:`<button class="btn ${d.isFollowing?'grey':'blue'}" id="followBtn">${d.isFollowing?'Following':'Follow'}</button><button class="btn grey" id="msgBtn">Message</button>`}</div>
    ${adminBox}
    <div id="editBox"></div>
    <div class="grid">${d.posts.map(p=>`<div class="cell">${p.mediaUrl?(p.mediaType==='video'?`<video src="${esc(p.mediaUrl)}" muted preload="metadata"></video><span class="vidMark">▶️</span>`:`<img src="${esc(p.mediaUrl)}"/>`):`<div style="padding:10px;font-size:13px">${esc(p.caption)}</div>`}</div>`).join('')||'<div class="empty" style="grid-column:1/-1">No posts yet</div>'}</div>
    <div style="padding:10px">${d.posts.map(postHTML).join('')}</div>`;
    bindPostEvents($('#profBox'));
    if(isMe){ $('#logoutBtn').onclick=()=>{ localStorage.removeItem('cc_token'); location.reload(); };
      $('#editBtn').onclick=()=>{ $('#editBox').innerHTML=`<div style="padding:6px 16px"><label>Name</label><input id="e_name" value="${esc(me.name)}"/><label>Bio</label><textarea id="e_bio">${esc(me.bio||'')}</textarea><button class="btn grey" id="e_avatar">🖼️ Change profile photo</button><button class="btn" id="e_save">Save</button></div>`;
        $('#e_avatar').onclick=()=>pickFile(async f=>{ const form=new FormData(); form.append('media',f); const r=await apiForm('/api/me/avatar',form); me=r.user; toast('Profile photo updated'); renderProfile(me.username); });
        $('#e_save').onclick=async()=>{ const r=await api('/api/me',{method:'PUT',body:JSON.stringify({name:$('#e_name').value,bio:$('#e_bio').value})}); me=r.user; toast('Saved ✓'); renderProfile(me.username); }; };
      const ch=$('#chInvite'); if(ch) ch.onclick=async()=>{ const v=$('#newInvite').value.trim(); if(!v)return toast('Type a new code first'); const r=await api('/api/admin/invite',{method:'POST',body:JSON.stringify({inviteCode:v})}); toast('Invite code changed to '+r.inviteCode); renderProfile(me.username); };
    } else { $('#msgBtn').onclick=()=>openThreadWith(u.id);
      $('#followBtn').onclick=async(e)=>{ const r=await api(`/api/users/${u.id}/follow`,{method:'POST',body:'{}'}); me=r.me; renderProfile(username); }; }
  }catch(e){ $('#profBox').innerHTML=`<div class="empty">${esc(e.message)}</div>`; }
}

/* ---------- ACTIVITY ---------- */
async function renderActivity(){ view='activity'; shell(`<div class="viewTitle">Activity ♡</div><div id="actBox"><div class="empty">Loading…</div></div>`);
  try{ const d=await api('/api/notifications'); $('#actBox').innerHTML= d.notifications.length? d.notifications.map(n=>`<div class="row">${avatarHTML(n.fromUser,46)}<div class="grow"><div style="font-size:14.5px;line-height:1.4">${esc(n.text)}</div><div class="time">${timeAgo(n.createdAt)} ago</div></div><span>${n.type==='like'?'❤️':n.type==='comment'?'💬':n.type==='message'?'✈️':'👋'}</span></div>`).join('') : `<div class="empty"><span class="big">♡</span>No activity yet.<br/>Likes, comments & messages will show here.</div>`; }catch(e){ $('#actBox').innerHTML=`<div class="empty">${esc(e.message)}</div>`; }
}

/* ---------- SOCKET ---------- */
function connectSocket(){ if(socket) socket.disconnect(); socket=io({auth:{token}});
  socket.on('presence', d=>{ online=new Set(d.online); if(view==='chat') renderChatList(true); });
  socket.on('new_message', m=>{ if(view==='thread'&&currentChat&&m.conversationId===currentChat.id&&window._addMsg){ if(!document.querySelector(`[data-mid="${m.id}"]`)) window._addMsg(m); api(`/api/conversations/${encodeURIComponent(currentChat.id)}/messages`).catch(()=>{}); }
    else { if(m.fromUserId!==me.id) toast((m.user?.name||'New message')+': '+(m.text||'📷 media')); loadConversations(view!=='chat'); if(view==='chat') renderChatList(true); if(view==='home') renderHomeBadge(); } });
  socket.on('typing', d=>{ if(view==='thread'&&currentChat&&d.conversationId===currentChat.id){ const b=$('#typingBox'); if(b){ b.textContent='typing…'; clearTimeout(window._tt); window._tt=setTimeout(()=>b.textContent='',1600);} }});
  socket.on('new_post', p=>{ if(p.userId!==me.id && view==='home') toast('@'+p.user.username+' posted something new 📸'); if(view==='home') loadFeed(); });
  socket.on('new_story', ()=>{ if(view==='home') loadStories(); });
  socket.on('post_deleted', ({id})=>document.getElementById('post-'+id)?.remove());
}
function renderHomeBadge(){ loadConversations(true); if(view==='home') renderHome(); }

/* ---------- BOOT ---------- */
async function boot(){ try{ if(!me){ const d=await api('/api/me'); me=d.user; } connectSocket(); await loadConversations(true); renderHome(); }catch(e){ token=''; localStorage.removeItem('cc_token'); renderAuth('login'); } }
if(token) boot(); else renderAuth('login');
