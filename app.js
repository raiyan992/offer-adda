firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth(), db = firebase.firestore(), FV = firebase.firestore.FieldValue;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = p => String(p || '').replace(/\D/g, '').slice(-10);
let me, myPhone, tab = 'home', cur = '', groups = [], offers = {}, notifs = [], invites = [], unsubs = [], offUnsubs = [], chatUnsub = null;
const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 3200); };
const ago = d => { const m = Math.floor((Date.now() - d) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.floor(m / 60) + ' hr ago' : Math.floor(m / 1440) + ' day ago'; };
const modal = h => { if (chatUnsub) { chatUnsub(); chatUnsub = null; } const m = $('#modal'); m.hidden = !h; m.innerHTML = h ? `<div class="sheet">${h}<button class="btn" data-a="close">Band karo</button></div>` : ''; };
const setTheme = t => { document.documentElement.dataset.theme = t; localStorage.theme = t; };
setTheme(localStorage.theme || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'));
const shrink = f => new Promise((ok, no) => { const i = new Image(); i.onload = () => { const s = Math.min(1, 720 / Math.max(i.width, i.height)), c = document.createElement('canvas'); c.width = i.width * s; c.height = i.height * s; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', .65)); }; i.onerror = no; i.src = URL.createObjectURL(f); });
const msg = e => ({ 'auth/invalid-credential': 'Number ya PIN galat hai', 'auth/email-already-in-use': 'Ye number pehle se registered hai, Login karein', 'auth/weak-password': 'PIN 6 digit ka hona chahiye', 'permission-denied': 'Is kaam ki ijazat nahi hai' }[e.code] || e.message || 'Kuch gadbad hui');

// ---------- login ----------
function authView(reg) {
  $('#app').innerHTML = `<main style="text-align:center"><img class="logo big" src="logo.jpg" alt="Offer Adda"><h2>Welcome! 👋</h2><p class="mu">Apne doston ke saath offers share karein</p>
  <form id="f"><input id="ph" type="tel" inputmode="numeric" placeholder="📱 Mobile number (10 digit)" maxlength="13" required>${reg ? '<input id="nm" placeholder="👤 Aapka naam" maxlength="30" required>' : ''}
  <input id="pin" type="password" inputmode="numeric" placeholder="🔑 6 digit PIN" maxlength="6" minlength="6" required><button class="btn p">${reg ? '✅ ACCOUNT BANAO' : '✅ LOGIN'}</button></form>
  <button class="link" data-a="authMode" data-r="${reg ? '' : 1}">${reg ? 'Pehle se account hai? Login' : 'Naye ho? Account banao'}</button></main>`;
  $('#f').onsubmit = async e => {
    e.preventDefault(); const b = e.submitter; b.classList.add('load'); b.disabled = true;
    try {
      const p = norm($('#ph').value), em = p + '@offeradda.app', pin = $('#pin').value;
      if (p.length != 10) throw { message: '10 digit number likhein' };
      if (reg) { const c = await auth.createUserWithEmailAndPassword(em, pin); await db.doc('users/' + c.user.uid).set({ name: $('#nm').value.trim(), blocked: [] }); }
      else await auth.signInWithEmailAndPassword(em, pin);
    } catch (x) { toast(msg(x)); b.classList.remove('load'); b.disabled = false; }
  };
}
auth.onAuthStateChanged(async u => {
  unsubs.forEach(f => f()); offUnsubs.forEach(f => f()); unsubs = []; offUnsubs = []; offers = {};
  if (!u) { me = null; return authView(); }
  let d; for (let i = 0; i < 5 && !(d = await db.doc('users/' + u.uid).get()).exists; i++) await new Promise(r => setTimeout(r, 400));
  me = { uid: u.uid, name: d.data().name, blocked: d.data().blocked || [] }; myPhone = norm(u.email.split('@')[0]);
  let f1 = true, f2 = true;
  unsubs.push(db.collection('groups').where('members', 'array-contains', me.uid).onSnapshot(s => { groups = s.docs.map(x => ({ id: x.id, ...x.data() })); watch(); render(); }));
  unsubs.push(db.collection('notifs').where('to', '==', me.uid).onSnapshot(s => {
    notifs = s.docs.map(x => ({ id: x.id, ...x.data() })).sort((a, b) => b.at - a.at);
    if (!f1) s.docChanges().forEach(c => c.type == 'added' && toast('🔔 ' + c.doc.data().text)); f1 = false; render(!0);
  }));
  unsubs.push(db.collection('invites').where('phone', '==', myPhone).onSnapshot(s => { invites = s.docs.map(x => ({ id: x.id, ...x.data() })); if (tab == 'groups') render(); }));
});
function watch() {
  offUnsubs.forEach(f => f()); offUnsubs = [];
  groups.forEach(g => offUnsubs.push(db.collection(`groups/${g.id}/offers`).onSnapshot(s => { offers[g.id] = s.docs.map(x => ({ id: x.id, g: g.id, ...x.data() })); if (tab == 'home') feed(); })));
}

// ---------- screens ----------
const unread = () => notifs.filter(n => !n.read).length;
function render(soft) {
  if (!me) return; if (soft && tab == 'alerts') return show();
  if (soft) { const b = $('nav .badge'); return shell(), tab == 'home' && feed(); } show();
}
function shell() {
  const u = unread();
  $('#app').innerHTML = `<header><div class="in"><img class="logo" src="logo.jpg" alt=""><b>OFFER ADDA</b><button class="link" data-a="tab" data-t="alerts" style="font-size:22px">🔔</button><button class="link" data-a="tab" data-t="profile" style="font-size:22px">👤</button></div></header><main id="v"></main>
  <nav>${[['home', '🏠', 'Home'], ['groups', '👥', 'Groups'], ['post', '➕', 'Post'], ['alerts', '🔔', 'Alerts'], ['profile', '👤', 'Profile']].map(([t, i, l]) => `<button class="${t == tab ? 'on' : ''} ${t == 'post' ? 'post' : ''}" data-a="${t == 'post' ? 'postForm' : 'tab'}" data-t="${t}"><span>${i}</span>${l}${t == 'alerts' && u ? `<i class="badge">${u}</i>` : ''}</button>`).join('')}</nav>`;
}
function show(t) {
  if (t) tab = t; shell(); const v = $('#v');
  if (tab == 'home') {
    v.innerHTML = `<button class="btn p" data-a="postForm" style="font-size:20px">➕ POST OFFER</button><h3>My Groups</h3><div class="chips"><button class="chip ${!cur ? 'on' : ''}" data-a="grp" data-g="">Sab</button>${groups.map(g => `<button class="chip ${cur == g.id ? 'on' : ''}" data-a="grp" data-g="${g.id}">${esc(g.name)}</button>`).join('')}</div><h3>🔥 LATEST OFFERS</h3><div id="feed"></div>`; feed();
  } else if (tab == 'groups') {
    v.innerHTML = `${invites.map(i => `<div class="card pad"><div class="n"><img class="logo" src="logo.jpg" alt=""><div><b>${esc(i.groupName)}</b><div class="mu">Aapko is group mein bulaya gaya hai</div></div></div><div class="row"><button class="btn p" data-a="inv" data-id="${i.id}" data-g="${i.groupId}" data-x="accept">✅ JOIN</button><button class="btn" data-a="inv" data-id="${i.id}" data-x="decline">NAHI</button></div></div>`).join('')}
    <div class="card pad"><label>➕ Naya Group</label><input id="gn" placeholder="e.g. MANUU Hostel Offers" maxlength="40"><button class="btn p" data-a="newGroup">GROUP BANAO</button></div>
    ${groups.map(g => `<div class="card pad"><div class="n"><img class="logo" src="logo.jpg" alt=""><div><b>${esc(g.name)}</b><div class="mu">${g.members.length} members ${g.admin == me.uid ? '• Admin' : ''}</div></div></div>
    ${g.admin == me.uid ? `<input id="p${g.id}" type="tel" inputmode="numeric" placeholder="+91 Mobile Number"><button class="btn" data-a="invite" data-id="${g.id}" data-n="${esc(g.name)}">SEND INVITE</button>` : ''}<button class="link" data-a="leave" data-id="${g.id}">🚪 Group chhodo</button></div>`).join('')}`;
  } else if (tab == 'alerts') {
    v.innerHTML = notifs.length ? notifs.map(n => `<div class="card pad n ${n.read ? '' : 'un'}"><img class="logo" src="logo.jpg" alt=""><div style="flex:1"><b>${{ request: '🔔 New Request', given: '✅ Mil gaya', chat: '💬 Message' }[n.type] || 'ℹ️ Update'}</b><div>${esc(n.text)}</div><div class="mu">${ago(n.at)}</div>
      ${n.rq ? `<div class="row"><button class="btn sm" data-a="chat" data-g="${n.g}" data-o="${n.offerId}" data-r="${n.rq}" data-w="${n.ow}">💬 CHAT</button>${n.type == 'request' ? `<button class="btn sm p" data-a="give" data-g="${n.g}" data-o="${n.offerId}" data-u="${n.rq}">✅ GIVEN</button>` : ''}</div>` : ''}</div></div>`).join('') : '<p class="mu" style="text-align:center">Abhi koi alert nahi</p>';
    notifs.filter(n => !n.read).forEach(n => db.doc('notifs/' + n.id).update({ read: true }));
  } else v.innerHTML = `<div class="card pad"><label>Naam</label><input id="pn" value="${esc(me.name)}" maxlength="30"><p class="mu">📱 XXXXXX${myPhone.slice(-4)}</p><button class="btn p" data-a="saveName">SAVE</button><button class="btn" data-a="theme">🌗 Light / Dark</button><button class="btn" data-a="logout">LOGOUT</button></div>`;
}
const ser = o => {
  const rs = o.requests || {}, c = Object.keys(rs).length;
  const status = o.status == 'TAKEN' ? 'TAKEN' : o.availableUntil && o.availableUntil < Date.now() ? 'EXPIRED' : c ? 'REQUESTED' : 'AVAILABLE';
  return { ...o, count: c, status, isOwner: o.postedBy == me.uid, requested: !!rs[me.uid], won: o.givenTo == me.uid };
};
function feed() {
  const f = $('#feed'); if (!f) return;
  const os = Object.entries(offers).filter(([g]) => !cur || g == cur).flatMap(([, a]) => a).filter(o => !me.blocked.includes(o.postedBy)).sort((a, b) => b.at - a.at).slice(0, 50).map(ser);
  f.innerHTML = os.length ? os.map(card).join('') : '<p class="mu" style="text-align:center">Koi offer nahi. Pehla offer post karein! 🍗</p>';
}
const ST = { AVAILABLE: '🟢 AVAILABLE', REQUESTED: '🟡 REQUESTED', TAKEN: '🔴 TAKEN', EXPIRED: '⚫ EXPIRED' };
function card(o) {
  const d = (c, t, a = '') => `<button class="btn ${c}" ${a || 'disabled'}>${t}</button>`; let b;
  if (o.isOwner) b = o.status == 'TAKEN' ? d('', '🔴 OFFER TAKEN') : o.count ? d('p', `👥 DEKHO KISNE MAANGA (${o.count})`, `data-a="people" data-g="${o.g}" data-id="${o.id}"`) : '';
  else if (o.won) b = d('', '✅ OFFER MIL GAYA');
  else if (o.status == 'TAKEN') b = d('', '❌ OFFER TAKEN');
  else if (o.status == 'EXPIRED') b = d('', '⚫ EXPIRED');
  else if (o.requested) b = d('', '✅ REQUESTED') + `<button class="link" data-a="chat" data-g="${o.g}" data-o="${o.id}" data-r="${me.uid}" data-w="${o.postedBy}">💬 Chat</button>`;
  else b = d('p', '✅ MUJHE CHAHIYE', `data-a="want" data-g="${o.g}" data-id="${o.id}"`);
  return `<div class="card"><div class="pad who"><b>👤 ${esc(o.posterName)}</b><span>${ago(o.at)} • ${ST[o.status]}</span></div><img class="pic" loading="lazy" src="${o.image}" alt="">
  <div class="pad"><b style="font-size:19px">🍗 ${esc(o.itemName)}</b><div class="price">💰 ₹${o.price}</div>${o.shopName ? `<div>🏪 ${esc(o.shopName)}</div>` : ''}${o.description ? `<div class="mu">📝 ${esc(o.description)}</div>` : ''}${o.availableUntil ? `<div>⏰ Until ${new Date(o.availableUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>` : ''}
  ${o.count ? `<div style="margin-top:6px">👥 ${o.count} ${o.count > 1 ? 'people want' : 'person wants'} this</div>` : ''}${b}
  ${o.isOwner ? '' : `<button class="link" data-a="report" data-id="${o.id}" data-u="${o.postedBy}">🚩 Report</button><button class="link" data-a="block" data-u="${o.postedBy}" data-n="${esc(o.posterName)}">🚫 Block</button>`}</div></div>`;
}
function postForm() {
  if (!groups.length) { toast('Pehle group banayein ya join karein'); return show('groups'); }
  modal(`<h3>➕ POST OFFER</h3><form id="pf"><label>🏠 Group</label><select name="g">${groups.map(g => `<option value="${g.id}" ${cur == g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
  <label>📸 Add Photo</label><input type="file" name="image" accept="image/*" required><label>🍴 What is it?</label><input name="itemName" placeholder="Biryani" required maxlength="60">
  <label>💰 Price (₹)</label><input name="price" type="number" min="0" inputmode="numeric" placeholder="150" required><label>🏪 Shop / Restaurant</label><input name="shopName" placeholder="Mahfil">
  <label>📝 Short Description</label><input name="description" placeholder="Chicken Biryani"><label>⏰ Available Until</label><input name="until" type="time"><button class="btn p">POST OFFER</button></form>`);
  $('#pf').onsubmit = async e => {
    e.preventDefault(); const b = e.submitter; b.classList.add('load'); b.disabled = true;
    try {
      const f = new FormData(e.target), t = f.get('until'); let until = null;
      if (t) { const d = new Date(), [h, m] = t.split(':'); d.setHours(h, m, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); until = d.getTime(); }
      await db.collection(`groups/${f.get('g')}/offers`).add({ image: await shrink(f.get('image')), itemName: f.get('itemName').trim(), price: Number(f.get('price')), shopName: f.get('shopName').trim(), description: f.get('description').trim(), availableUntil: until, postedBy: me.uid, posterName: me.name, status: 'AVAILABLE', requests: {}, at: Date.now() });
      modal(); toast('Offer post ho gaya! 🎉');
    } catch (x) { toast(msg(x)); b.classList.remove('load'); b.disabled = false; }
  };
}
const notify = (to, o, type, text, extra = {}) => db.collection('notifs').add({ to, type, text, g: o.g, offerId: o.id, from: me.uid, read: false, at: Date.now(), ...extra });
const find = (g, id) => (offers[g] || []).find(o => o.id == id);
function chat(g, o, rq, ow) {
  const cid = o + '_' + rq, off = find(g, o), peer = me.uid == ow ? rq : ow;
  modal(`<h3>💬 ${esc(off ? off.itemName : 'Chat')}</h3><div class="msgs" id="ms"></div><form id="cf" class="row"><input id="ct" placeholder="Message likhein..." autocomplete="off"><button class="btn p sm" style="margin:6px 0">➤</button></form>`);
  chatUnsub = db.collection(`groups/${g}/chats/${cid}/msgs`).orderBy('at').onSnapshot(s => { const ms = $('#ms'); if (!ms) return; ms.innerHTML = s.docs.map(x => `<div class="m ${x.data().from == me.uid ? 'me' : ''}">${esc(x.data().text)}</div>`).join(''); ms.scrollTop = 1e9; }, x => toast(msg(x)));
  $('#cf').onsubmit = async e => {
    e.preventDefault(); const t = $('#ct').value.trim(); if (!t) return; $('#ct').value = '';
    try { await db.collection(`groups/${g}/chats/${cid}/msgs`).add({ from: me.uid, text: t, at: Date.now() }); await notify(peer, { g, id: o }, 'chat', `${me.name}: ${t.slice(0, 60)}`, { rq, ow }); } catch (x) { toast(msg(x)); }
  };
}

// ---------- actions ----------
const A = {
  close: () => modal(), tab: (b, d) => show(d.t), authMode: (b, d) => authView(!!d.r), postForm,
  grp: (b, d) => { cur = d.g; show('home'); },
  want: async (b, d) => {
    const o = find(d.g, d.id); if (!o || o.status == 'TAKEN') throw { message: 'Sorry, this offer has already been taken.' };
    await db.doc(`groups/${d.g}/chats/${d.id}_${me.uid}`).set({ owner: o.postedBy, requester: me.uid });
    await db.doc(`groups/${d.g}/offers/${d.id}`).update({ ['requests.' + me.uid]: { name: me.name, at: Date.now() } });
    await notify(o.postedBy, o, 'request', `${me.name} wants your ${o.itemName} offer for ₹${o.price}.`, { rq: me.uid, ow: o.postedBy });
    toast('Request sent! The person who posted this offer has been notified.');
  },
  people: (b, d) => {
    const o = find(d.g, d.id), rs = Object.entries(o.requests || {}).sort((a, b) => a[1].at - b[1].at);
    modal(`<h3>People who want this</h3>${rs.map(([u, r]) => `<div class="card pad"><b>👤 ${esc(r.name)}</b> <span class="mu">${ago(r.at)}</span><div class="row"><button class="btn sm" data-a="chat" data-g="${d.g}" data-o="${d.id}" data-r="${u}" data-w="${me.uid}">💬 CHAT</button><button class="btn sm p" data-a="give" data-g="${d.g}" data-o="${d.id}" data-u="${u}">✅ GIVEN</button></div></div>`).join('')}`);
  },
  give: async (b, d) => {
    const o = find(d.g, d.o); if (!o || o.postedBy != me.uid) throw { message: 'Sirf offer ka malik ye kar sakta hai' }; if (o.status == 'TAKEN') throw { message: 'Offer pehle hi de diya gaya' };
    await db.doc(`groups/${d.g}/offers/${d.o}`).update({ status: 'TAKEN', givenTo: d.u });
    for (const u in o.requests) await notify(u, o, u == d.u ? 'given' : 'sorry', u == d.u ? `Offer successfully given: ${o.itemName} ₹${o.price}.` : `Sorry, ${o.itemName} offer has already been taken.`);
    modal(); toast('Offer given to ' + o.requests[d.u].name);
  },
  chat: (b, d) => chat(d.g, d.o, d.r, d.w),
  newGroup: async () => { const n = $('#gn').value.trim(); if (!n) throw { message: 'Group ka naam likhein' }; await db.collection('groups').add({ name: n.slice(0, 40), admin: me.uid, members: [me.uid] }); },
  invite: async (b, d) => { const p = norm($('#p' + d.id).value); if (p.length != 10) throw { message: '10 digit number likhein' }; await db.doc(`invites/${d.id}_${p}`).set({ groupId: d.id, groupName: d.n, phone: p }); toast('Invite bhej diya gaya ✅'); $('#p' + d.id).value = ''; },
  inv: async (b, d) => { if (d.x == 'accept') await db.doc('groups/' + d.g).update({ members: FV.arrayUnion(me.uid) }); await db.doc('invites/' + d.id).delete(); },
  leave: async (b, d) => { if (confirm('Group chhodna hai?')) { await db.doc('groups/' + d.id).update({ members: FV.arrayRemove(me.uid) }); cur = ''; } },
  report: async (b, d) => { const r = prompt('Report ka karan likhein:'); if (r) { await db.collection('reports').add({ by: me.uid, offerId: d.id, userId: d.u, reason: r.slice(0, 300), at: Date.now() }); toast('Report bhej di gayi. Shukriya!'); } },
  block: async (b, d) => { if (confirm(d.n + ' ko block karna hai?')) { await db.doc('users/' + me.uid).update({ blocked: FV.arrayUnion(d.u) }); me.blocked.push(d.u); feed(); } },
  saveName: async () => { const n = $('#pn').value.trim(); if (n) { await db.doc('users/' + me.uid).update({ name: n }); me.name = n; toast('Save ho gaya ✅'); } },
  theme: () => setTheme(document.documentElement.dataset.theme == 'dark' ? 'light' : 'dark'),
  logout: () => auth.signOut()
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const f = A[b.dataset.a]; if (!f) return;
  b.classList.add('load'); Promise.resolve().then(() => f(b, b.dataset)).catch(x => toast(msg(x))).finally(() => b.classList.remove('load'));
});
