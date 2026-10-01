import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Clé publique (peut être dans le frontend). Ne jamais mettre la clé service_role ici.
const SB_URL = 'https://rvsjhsugqxtgrfnqnbxu.supabase.co', SB_KEY = 'sb_publishable_zIBVaJbFsAg_1otYTEXpiA_SCBidk6P';
const sb = createClient(SB_URL, SB_KEY);

['append', 'prepend', 'replaceChildren', 'after', 'before'].forEach(m => {
  const orig = Element.prototype[m];
  Element.prototype[m] = function (...a) { return orig.apply(this, a.flat().filter(x => x != null && x !== false)); };
});
const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...kids.flat().filter(k => k != null && k !== false));
  return e;
};
const quand = d => new Date(d).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
const av = (url, nom, t = 40) => url
  ? h('img', { src: url, alt: '', className: 'av', style: `width:${t}px;height:${t}px` })
  : h('span', { className: 'av', style: `width:${t}px;height:${t}px;font-size:${Math.round(t * .42)}px` }, (nom || '?').trim().charAt(0).toUpperCase());
async function reduireImage(f, max = 1280) {
  const bmp = await createImageBitmap(f), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', .8));
}
const root = document.getElementById('app');
const normaliserTel = v => { let t = String(v).replace(/[\s.\-()]/g, ''); if (t.startsWith('00')) t = '+' + t.slice(2); return /^\+\d{8,15}$/.test(t) ? t : null; };
const cacheUrl = new Map();
const urlSignee = (bucket, chemin) => { const k = bucket + '/' + chemin; if (!cacheUrl.has(k)) cacheUrl.set(k, sb.storage.from(bucket).createSignedUrl(chemin, 3600).then(r => r.data?.signedUrl)); return cacheUrl.get(k); };
const heureCourte = d => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const jourHeure = d => { const x = new Date(d); return x.toDateString() === new Date().toDateString() ? `aujourd’hui à ${heureCourte(x)}` : x.toDateString() === new Date(Date.now() - 864e5).toDateString() ? `hier à ${heureCourte(x)}` : `le ${x.toLocaleDateString('fr-FR')} à ${heureCourte(x)}`; };
const libelleJour = d => { const x = new Date(d); return x.toDateString() === new Date().toDateString() ? 'Aujourd’hui' : x.toDateString() === new Date(Date.now() - 864e5).toDateString() ? 'Hier' : x.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); };
const heureListe = d => { const x = new Date(d); return x.toDateString() === new Date().toDateString() ? heureCourte(x) : x.toDateString() === new Date(Date.now() - 864e5).toDateString() ? 'Hier' : x.toLocaleDateString('fr-FR'); };

// Présence « en ligne »
const champMdp = (ph, ac) => {
  const input = h('input', { type: 'password', placeholder: ph, autocomplete: ac });
  const oeil = h('button', { type: 'button', className: 'oeil', title: 'Afficher ou masquer le mot de passe', 'aria-label': 'Afficher ou masquer le mot de passe' }, '👁');
  oeil.onclick = () => { const cache = input.type === 'password'; input.type = cache ? 'text' : 'password'; oeil.textContent = cache ? '🙈' : '👁'; };
  return { input, el: h('div', { className: 'mdp' }, input, oeil) };
};
let nouv = {};
function majBadges(nav) {
  nav = nav || document.querySelector('nav'); if (!nav) return;
  sb.rpc('mes_conversations').then(r => { const n = (r.data || []).reduce((a, c) => a + (c.muted ? 0 : Number(c.non_lus)), 0); nav.children[2].textContent = n > 0 ? `Messages (${n})` : 'Messages'; });
  sb.rpc('nouveautes').then(r => {
    nouv = Object.fromEntries((r.data || []).map(x => [x.section, Number(x.n)]));
    const n = Object.values(nouv).reduce((a, b) => a + b, 0);
    nav.children[3].textContent = n > 0 ? `Plus (${n})` : 'Plus'; nav.children[3].classList.toggle('alerte', n > 0);
  });
}
const enLigne = new Set(); let canalPresence = null, canalConv = null, surPresence = null, battementId = null;
function demarrerPresence() {
  if (canalPresence) return;
  canalPresence = sb.channel('presence-mna', { config: { presence: { key: session.user.id } } });
  canalPresence.on('presence', { event: 'sync' }, () => { enLigne.clear(); Object.keys(canalPresence.presenceState()).forEach(k => enLigne.add(k)); surPresence?.(); })
    .subscribe(async st => { if (st === 'SUBSCRIBED' && profile?.show_online !== false) await canalPresence.track({ t: Date.now() }); });
  const battement = () => { if (session && profile?.show_online !== false) sb.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', session.user.id); };
  battement(); battementId = setInterval(battement, 60000);
}
function arreterPresence() { if (canalGlobal) { sb.removeChannel(canalGlobal); canalGlobal = null; } if (canalPresence) { sb.removeChannel(canalPresence); canalPresence = null; } clearInterval(battementId); enLigne.clear(); }
document.addEventListener('visibilitychange', () => {
  if (!canalPresence || profile?.show_online === false) return;
  if (document.hidden) { canalPresence.untrack(); sb.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', session.user.id); }
  else canalPresence.track({ t: Date.now() });
});
let syncConv = null;
let perms = new Set(), serieOuverte = null, sessionOuverte = null;
let session = null, profile = null, tab = 'accueil', groupe = null, conv = null, sous = null, ecranContact = false;

async function charger() {
  const { data } = await sb.auth.getSession();
  session = data.session;
  profile = null;
  if (session) {
    const r = await sb.from('profiles').select('id,full_name,avatar_url,bio,church_id,role,status,show_bio,show_church,last_seen_at,show_online,show_phone').eq('id', session.user.id).single();
    profile = r.data;
    if (profile) profile.phone = (await sb.rpc('mon_telephone')).data;
    perms = new Set(((await sb.from('admin_permissions').select('permission').eq('user_id', session.user.id)).data || []).map(x => x.permission));
  }
  if (session) { demarrerPresence(); demarrerEcoute(); memoriserUid(session.user.id); majPushAuto(); } else { arreterPresence(); memoriserUid(''); }
  afficher();
}
sb.auth.onAuthStateChange((_e, s) => { if ((s?.user?.id) !== (session?.user?.id)) charger(); });

function afficher() {
  if (canalConv) { sb.removeChannel(canalConv); canalConv = null; }
  clearInterval(syncConv);
  surPresence = null;
  root.replaceChildren();
  if (!session) return root.append(vueAuth());
  if (profile?.status === 'suspendu') {
    return root.append(h('div', { className: 'auth' }, h('h2', {}, 'Compte suspendu'),
      h('p', {}, 'Contactez l’administration du ministère.'),
      h('button', { className: 'btn', onclick: deconnexion }, 'Se déconnecter')));
  }
  if (tab === 'messages' && conv) { const plein = h('div', { className: 'plein' }); root.append(plein); (ecranContact ? vueContact() : vueConv()).then(v => plein.append(v)); return; }
  const main = h('main');
  const onglets = [['accueil', 'Accueil'], ['communautes', 'Groupes'], ['messages', 'Messages'], ['plus', 'Plus'], ['profil', 'Profil']];
  const nav = h('nav', {}, ...onglets.map(([k, l]) =>
    h('button', { className: tab === k ? 'on' : '', onclick: () => { tab = k; groupe = null; conv = null; sous = null; afficher(); } }, l)));
  majBadges(nav);
  root.append(h('header', {}, h('img', { src: 'logo-entete.png', alt: 'MNA Connect', className: 'logo-tete' })), main, nav);
  if (tab === 'accueil' && 'Notification' in window && 'PushManager' in window && Notification.permission === 'default' && !sessionStorage.getItem('pushIgnore'))
    main.append(h('div', { className: 'card epingle' }, h('p', {}, '🔔 Recevoir les messages et annonces même quand l’application est fermée ?'),
      h('div', { className: 'actions' }, h('button', { className: 'btn primaire', onclick: async () => { try { await activerPush(); } catch (e) { alert(e.message); } afficher(); } }, 'Activer'),
        h('button', { className: 'btn', onclick: () => { sessionStorage.setItem('pushIgnore', '1'); afficher(); } }, 'Plus tard'))));
  (tab === 'accueil' ? vueFil(null) : tab === 'communautes' ? (groupe ? vueGroupe() : vueGroupes()) : tab === 'messages' ? (conv ? vueConv() : vueMessages()) : tab === 'plus' ? vuePlus() : vueProfil()).then(v => main.append(v));
}

function vueAuth() {
  let inscription = false, parTel = false;
  const wrap = h('div', { className: 'auth' });
  const dessiner = () => {
    const nom = h('input', { placeholder: 'Nom complet', autocomplete: 'name' });
    const email = h('input', { type: 'email', placeholder: 'Adresse e-mail', autocomplete: 'email' });
    const tel = h('input', { type: 'tel', placeholder: inscription ? 'Téléphone (facultatif) : +243 8XX XXX XXX' : 'Numéro : +243 8XX XXX XXX', autocomplete: 'tel' });
    const mdpC = champMdp('Mot de passe (8 caractères minimum)', inscription ? 'new-password' : 'current-password'); const mdp = mdpC.input;
    const msg = h('p', { className: 'erreur' });
    const go = h('button', { className: 'btn primaire', style: 'width:100%' }, inscription ? 'Créer mon compte' : 'Se connecter');
    go.onclick = async () => {
      msg.className = 'erreur'; msg.textContent = ''; go.disabled = true;
      try {
        if (inscription) {
          const numero = tel.value.trim() ? normaliserTel(tel.value) : null;
          if (tel.value.trim() && !numero) throw new Error('Numéro invalide. Indiquez-le avec l’indicatif du pays, par exemple +243…');
          const r = await sb.auth.signUp({ email: email.value.trim(), password: mdp.value, options: { data: { full_name: nom.value.trim(), phone: numero || '' } } });
          if (r.error) throw r.error;
          if (!r.data.session) { msg.className = 'ok'; msg.textContent = 'Compte créé. Confirmez votre adresse e-mail via le message reçu, puis connectez-vous.'; }
        } else if (parTel) {
          const numero = normaliserTel(tel.value);
          if (!numero) throw new Error('Numéro invalide. Utilisez le format international, par exemple +243…');
          const res = await fetch(`${SB_URL}/functions/v1/connexion-telephone`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY }, body: JSON.stringify({ phone: numero, password: mdp.value }) });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || 'Connexion impossible');
          const { error } = await sb.auth.setSession({ access_token: j.access_token, refresh_token: j.refresh_token });
          if (error) throw error;
        } else {
          const r = await sb.auth.signInWithPassword({ email: email.value.trim(), password: mdp.value });
          if (r.error) throw r.error;
        }
      } catch (e) { msg.textContent = e.message; }
      go.disabled = false;
    };
    const onglets = inscription ? null : h('div', { className: 'onglets-auth' },
      h('button', { className: 'btn' + (parTel ? '' : ' primaire'), onclick: () => { parTel = false; dessiner(); } }, 'E-mail'),
      h('button', { className: 'btn' + (parTel ? ' primaire' : ''), onclick: () => { parTel = true; dessiner(); } }, 'Téléphone'));
    const bascule = h('button', { className: 'btn lien', onclick: () => { inscription = !inscription; dessiner(); } }, inscription ? 'J’ai déjà un compte' : 'Créer un compte');
    wrap.replaceChildren(h('img', { src: 'logo.png', alt: 'MNA Connect – Le réseau de la Nouvelle Alliance', className: 'logo-login' }), onglets,
      inscription ? nom : null, (inscription || !parTel) ? email : null, (inscription || parTel) ? tel : null, mdpC.el, msg, go, h('p', {}, bascule),
      invitation ? h('button', { className: 'btn primaire', style: 'width:100%;margin-top:1rem', onclick: () => invitation.prompt() }, '📲 Installer l’application sur mon téléphone') : null);
  };
  dessiner();
  return wrap;
}
async function vueFil(groupId) {
  const box = h('div');
  if (!groupId) box.append(await accueilHaut());
  const texte = h('textarea', { rows: 3, placeholder: 'Partagez quelque chose avec la communauté…' });
  const err = h('p', { className: 'erreur' });
  const pub = h('button', { className: 'btn primaire' }, 'Publier');
  const liste = h('div');
  let image = null;
  const fichier = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const apercu = h('div');
  fichier.onchange = () => { image = fichier.files[0] || null; apercu.replaceChildren(image ? h('img', { src: URL.createObjectURL(image), className: 'photo', alt: '' }) : ''); };
  const bPhoto = h('button', { className: 'btn', onclick: () => fichier.click() }, '📷 Photo');
  pub.onclick = async () => {
    err.textContent = '';
    if (!texte.value.trim() && !image) return;
    pub.disabled = true;
    const ligne = { content: texte.value.trim(), group_id: groupId };
    try {
      if (image) {
        const blob = await reduireImage(image);
        const chemin = `${session.user.id}/${crypto.randomUUID()}.jpg`;
        const up = await sb.storage.from('post-media').upload(chemin, blob, { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
        ligne.media_url = chemin; ligne.media_type = 'image';
      }
      const { error } = await sb.from('posts').insert(ligne);
      if (error) throw error;
      texte.value = ''; image = null; fichier.value = ''; apercu.replaceChildren(); remplir();
    } catch (e) { err.textContent = e.message || 'Échec de la publication'; }
    pub.disabled = false;
  };
  if (groupId || can('publier')) box.append(h('div', { className: 'card' }, texte, apercu, err, h('div', { className: 'actions' }, bPhoto, pub, fichier)));
  box.append(liste);

  async function remplir() {
    let q = sb.from('posts').select('id,content,pinned,created_at,author_id,media_url,media_type,profiles!posts_author_id_fkey(full_name,avatar_url),comments(count),reactions(count)');
    q = groupId ? q.eq('group_id', groupId) : q.is('group_id', null);
    const [{ data: posts, error }, { data: mes }, { data: sv }] = await Promise.all([
      q.order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50),
      sb.from('reactions').select('post_id').eq('user_id', session.user.id),
      sb.from('saved_posts').select('post_id')
    ]);
    const enreg = new Set((sv || []).map(x => x.post_id));
    liste.replaceChildren();
    if (error) return liste.append(h('p', { className: 'erreur' }, error.message));
    if (!posts.length) return liste.append(h('p', { className: 'vide' }, 'Aucune publication pour le moment. Soyez le premier à partager.'));
    const aime = new Set((mes || []).map(r => r.post_id));
    const chemins = posts.filter(p => p.media_url).map(p => p.media_url), urls = {};
    if (chemins.length) { const { data: sg } = await sb.storage.from('post-media').createSignedUrls(chemins, 3600); (sg || []).forEach(x => { if (x.signedUrl) urls[x.path] = x.signedUrl; }); }
    posts.forEach(p => liste.append(carte(p, aime.has(p.id), remplir, urls[p.media_url], enreg.has(p.id))));
  }
  remplir();
  return box;
}

function carte(p, aime, recharger, urlImage, enregistre) {
  let nbR = p.reactions[0]?.count || 0, nbC = p.comments[0]?.count || 0, moi = aime;
  const bR = h('button', { className: moi ? 'on' : '' });
  const bC = h('button');
  const zone = h('div');
  const maj = () => { bR.className = moi ? 'on' : ''; bR.textContent = `${moi ? '❤️' : '🤍'} ${nbR}`; bC.textContent = `💬 ${nbC}`; };
  maj();
  bR.onclick = async () => {
    const r = moi ? await sb.from('reactions').delete().eq('post_id', p.id).eq('user_id', session.user.id)
                  : await sb.from('reactions').insert({ post_id: p.id });
    if (r.error) return;
    moi = !moi; nbR += moi ? 1 : -1; maj();
  };
  bC.onclick = async () => {
    if (zone.childElementCount) return zone.replaceChildren();
    const c = h('div', { className: 'com' });
    const { data } = await sb.from('comments').select('id,author_id,content,created_at,profiles!comments_author_id_fkey(full_name)').eq('post_id', p.id).order('created_at');
    (data || []).forEach(x => c.append(h('p', {}, h('span', { className: 'auteur' }, (x.profiles?.full_name || 'Membre') + ' '), x.content, x.author_id !== session.user.id ? h('button', { className: 'btn lien discret', title: 'Plus d’options', onclick: () => confirm('Signaler ce commentaire à l’administration ?') && signaler('comment', x.id) }, '⋯') : null)));
    const champ = h('input', { placeholder: 'Écrire un commentaire…' });
    const envoi = h('button', { className: 'btn' }, 'Envoyer');
    const ids = new Map(), choix = h('div');
    const arobase = h('button', { className: 'btn', title: 'Identifier un membre' }, '@ Identifier');
    arobase.onclick = async () => {
      if (choix.childElementCount) return choix.replaceChildren();
      const { data: mb } = await sb.from('profiles').select('id,full_name').neq('id', session.user.id).eq('status', 'actif').order('full_name').limit(80);
      const sel = h('select', {}, h('option', { value: '' }, 'Choisir un membre…'), ...(mb || []).map(u => h('option', { value: u.id }, u.full_name || 'Sans nom')));
      sel.onchange = () => { const u = (mb || []).find(x => x.id === sel.value); if (u) { champ.value += (champ.value && !champ.value.endsWith(' ') ? ' ' : '') + '@' + u.full_name + ' '; ids.set(u.id, u.full_name); } choix.replaceChildren(); champ.focus(); };
      choix.append(sel);
    };
    envoi.onclick = async () => {
      if (!champ.value.trim()) return;
      const mentions = [...ids].filter(([, n]) => champ.value.includes('@' + n)).map(([i]) => i);
      const { error } = await sb.from('comments').insert({ post_id: p.id, content: champ.value.trim(), mentions });
      if (error) return alert(error.message);
      nbC++; maj(); zone.replaceChildren(); bC.onclick();
    };
    c.append(champ, h('div', { className: 'actions' }, arobase, envoi), choix); zone.append(c);
  };
  let sauve = enregistre;
  const bS = h('button', { title: 'Enregistrer sur mon compte' });
  const majS = () => { bS.textContent = sauve ? '🔖' : '📑'; bS.className = sauve ? 'on' : ''; }; majS();
  bS.onclick = async () => {
    const r = sauve ? await sb.from('saved_posts').delete().eq('post_id', p.id).eq('user_id', session.user.id) : await sb.from('saved_posts').insert({ post_id: p.id });
    if (!r.error) { sauve = !sauve; majS(); }
  };
  const bP = h('button', { title: 'Partager', onclick: () => partager('MNA Connect', (p.content || 'Une publication sur MNA Connect').slice(0, 120)) }, '↗️');
  const bD = urlImage ? h('button', { title: 'Télécharger la photo', onclick: async () => {
    const { data } = await sb.storage.from('post-media').createSignedUrl(p.media_url, 120, { download: 'photo-mna.jpg' });
    if (data) { const a = h('a', { href: data.signedUrl }); document.body.append(a); a.click(); a.remove(); }
  } }, '⬇️') : null;
  const mien = p.author_id === session.user.id || can('moderer');
  const sup = mien ? h('button', { className: 'btn lien', onclick: async () => {
    if (confirm('Supprimer cette publication ?')) { if (p.media_url) await sb.storage.from('post-media').remove([p.media_url]); await sb.from('posts').delete().eq('id', p.id); recharger(); }
  } }, 'Supprimer') : null;
  const pin = can('publier') ? h('button', { className: 'btn lien', onclick: async () => {
    const { error } = await sb.from('posts').update({ pinned: !p.pinned }).eq('id', p.id);
    if (error) alert(error.message); else recharger();
  } }, p.pinned ? 'Désépingler' : 'Épingler') : null;
  return h('article', { className: 'card' + (p.pinned ? ' epingle' : '') },
    h('div', { className: 'ligne' }, h('div', { className: 'qui' }, av(p.profiles?.avatar_url, p.profiles?.full_name, 40),
      h('div', {}, h('div', { className: 'auteur' }, p.profiles?.full_name || 'Membre'),
      h('div', { className: 'meta' }, (p.pinned ? 'Épinglé · ' : '') + quand(p.created_at)))), h('div', {}, pin, sup, p.author_id !== session.user.id ? h('button', { className: 'btn lien discret', title: 'Plus d’options', onclick: () => confirm('Signaler cette publication à l’administration ?') && signaler('post', p.id) }, '⋯') : null)),
    p.content ? h('p', { style: 'white-space:pre-wrap' }, p.content) : null,
    urlImage ? h('img', { src: urlImage, className: 'photo', alt: 'Photo de la publication', loading: 'lazy', onclick: () => window.open(urlImage, '_blank') }) : null,
    h('div', { className: 'actions' }, bR, bC, bP, bS, bD), zone);
}

async function vueGroupes() {
  const box = h('div', {}, h('h2', {}, 'Communautés'));
  const [{ data: gs }, { data: mem }] = await Promise.all([
    sb.from('groups').select('*').order('name'),
    sb.from('group_members').select('group_id,status').eq('user_id', session.user.id)
  ]);
  const statut = new Map((mem || []).map(m => [m.group_id, m.status]));
  if (!gs?.length) box.append(h('p', { className: 'vide' }, 'Aucune communauté pour le moment. L’administration peut en créer.'));
  (gs || []).forEach(g => {
    const s = statut.get(g.id);
    const bouton = s === 'actif' ? h('button', { className: 'btn primaire', onclick: () => { groupe = g; afficher(); } }, 'Ouvrir')
      : s === 'en_attente' ? h('span', { className: 'meta' }, 'Demande envoyée')
      : g.join_policy === 'ferme' ? h('span', { className: 'meta' }, 'Sur invitation')
      : h('button', { className: 'btn', onclick: async () => {
          const { error } = await sb.from('group_members').insert({ group_id: g.id, user_id: session.user.id, status: g.join_policy === 'ouvert' ? 'actif' : 'en_attente' });
          if (error) alert(error.message); else afficher();
        } }, g.join_policy === 'ouvert' ? 'Rejoindre' : 'Demander à rejoindre');
    box.append(h('div', { className: 'card ligne' }, h('div', {}, h('div', { className: 'auteur' }, g.name), h('div', { className: 'meta' }, g.description || '')), bouton));
  });
  return box;
}

async function vueGroupe() {
  const box = h('div', {}, h('button', { className: 'btn lien', onclick: () => { groupe = null; afficher(); } }, '‹ Communautés'), h('h2', {}, groupe.name));
  box.append(await vueFil(groupe.id));
  return box;
}

async function vueProfil() {
  const nom = h('input', { value: profile.full_name || '' });
  const bio = h('textarea', { rows: 3, value: profile.bio || '' });
  const vb = h('input', { type: 'checkbox', checked: profile.show_bio });
  const tel = h('input', { type: 'tel', placeholder: '+243 8XX XXX XXX', value: profile.phone || '' });
  const po = h('input', { type: 'checkbox', checked: profile.show_online !== false });
  const sp = h('input', { type: 'checkbox', checked: !!profile.show_phone });
  const zoneApp = h('div', { className: 'com' }, h('h3', {}, 'Application et notifications'));
  const etat = h('p', { className: 'meta' });
  const majEtat = () => { etat.textContent = !('Notification' in window) ? 'Notifications non prises en charge sur cet appareil.' : Notification.permission === 'granted' ? '✅ Notifications activées sur cet appareil.' : Notification.permission === 'denied' ? '⛔ Notifications bloquées : autorisez-les dans les réglages du navigateur.' : ''; };
  majEtat();
  prefsNotif().then(el => zoneApp.append(el));
  const dejaInstallee = matchMedia('(display-mode: standalone)').matches;
  zoneApp.append(etat,
    h('div', { className: 'actions', style: 'flex-wrap:wrap' },
      h('button', { className: 'btn', onclick: async () => { try { await activerPush(); } catch (e) { alert(e.message); } majEtat(); } }, '🔔 Activer les notifications'),
      h('button', { className: 'btn', onclick: () => { debloquerAudio(); bip(); } }, '🔊 Tester le son'),
      dejaInstallee ? h('span', { className: 'meta' }, '✅ Application installée')
        : invitation ? h('button', { className: 'btn primaire', onclick: () => invitation.prompt() }, '📲 Installer l’application') : null),
    !dejaInstallee && !invitation ? h('p', { className: 'meta' }, 'Pour installer : menu ⋮ du navigateur, puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».') : null);
  const msg = h('p', { className: 'ok' });
  const enr = h('button', { className: 'btn primaire' }, 'Enregistrer');
  enr.onclick = async () => {
    const numero = tel.value.trim() ? normaliserTel(tel.value) : null;
    if (tel.value.trim() && !numero) { msg.className = 'erreur'; msg.textContent = 'Numéro invalide : utilisez le format international, ex. +243…'; return; }
    const { error } = await sb.from('profiles').update({ full_name: nom.value.trim(), bio: bio.value.trim(), show_bio: vb.checked, phone: numero, show_online: po.checked, show_phone: sp.checked }).eq('id', session.user.id);
    msg.className = error ? 'erreur' : 'ok'; msg.textContent = error ? (error.code === '23505' ? 'Ce numéro est déjà utilisé par un autre compte.' : error.message) : 'Profil enregistré';
    if (!error) {
      profile.full_name = nom.value.trim(); profile.bio = bio.value.trim(); profile.phone = numero; profile.show_online = po.checked; profile.show_phone = sp.checked;
      if (!po.checked) { canalPresence?.untrack(); sb.from('profiles').update({ last_seen_at: null }).eq('id', session.user.id); } else canalPresence?.track({ t: Date.now() });
    }
  };
  const photo = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const cadre = h('span', {}, av(profile.avatar_url, profile.full_name, 88));
  photo.onchange = async () => {
    const f = photo.files[0]; if (!f) return;
    msg.className = 'ok'; msg.textContent = 'Envoi de la photo…';
    try {
      const blob = await rogner(f);
      if (!blob) { msg.textContent = ''; return; }
      const chemin = `${session.user.id}/avatar.jpg`;
      const up = await sb.storage.from('avatars').upload(chemin, blob, { upsert: true, contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      const url = sb.storage.from('avatars').getPublicUrl(chemin).data.publicUrl + '?v=' + Date.now();
      const r = await sb.from('profiles').update({ avatar_url: url }).eq('id', session.user.id);
      if (r.error) throw r.error;
      profile.avatar_url = url; cadre.replaceChildren(av(url, profile.full_name, 88)); msg.textContent = 'Photo mise à jour';
    } catch (e) { msg.className = 'erreur'; msg.textContent = e.message || 'Échec de l’envoi'; }
  };
  return h('div', { className: 'card' }, h('h2', {}, 'Mon profil'),
    h('div', { className: 'qui' }, cadre, h('button', { className: 'btn', onclick: () => photo.click() }, 'Changer la photo'), photo),
    h('p', { className: 'meta' }, session.user.email + ' · ' + profile.role),
    h('label', {}, 'Nom complet'), nom, h('label', {}, 'Biographie'), bio,
    h('label', {}, 'Téléphone (pour vous connecter avec votre numéro)'), tel,
    h('label', { className: 'check' }, vb, 'Afficher ma biographie aux autres membres'),
    h('label', { className: 'check', style: 'margin-top:.6rem' }, po, 'Afficher quand je suis en ligne et ma dernière connexion'),
    h('label', { className: 'check', style: 'margin-top:.6rem' }, sp, 'Montrer mon numéro aux membres avec qui je discute'),
    zoneApp,
    h('p'), msg, enr, ' ', h('button', { className: 'btn', onclick: deconnexion }, 'Se déconnecter'));
}

async function vueMessages() {
  const box = h('div', {}, h('h2', {}, 'Messages'));
  const { data, error } = await sb.rpc('mes_conversations');
  if (error) box.append(h('p', { className: 'erreur' }, error.message));
  const pts = [];
  (data || []).forEach(c => {
    const pt = h('span', { className: 'pt' }); pt.dataset.id = c.autre_id; pts.push(pt);
    box.append(h('div', { className: 'wa-ligne', onclick: () => { conv = c; afficher(); } },
      h('div', { className: 'av-wrap' }, av(c.autre_avatar, c.autre_nom, 52), pt),
      h('div', { className: 'wa-mid' }, h('div', { className: 'auteur coupe' }, c.autre_nom || 'Membre'),
        h('div', { className: 'meta coupe' + (c.non_lus > 0 ? ' fort' : '') }, c.dernier || 'Aucun message')),
      h('div', { className: 'wa-droite' }, h('div', { className: 'meta' }, c.dernier_at ? heureListe(c.dernier_at) : ''),
        c.non_lus > 0 ? h('span', { className: 'pastille' }, String(c.non_lus)) : null)));
  });
  const majPt = () => pts.forEach(p => { p.style.display = enLigne.has(p.dataset.id) ? '' : 'none'; });
  surPresence = majPt; majPt();
  if (!(data || []).length) box.append(h('p', { className: 'vide' }, 'Aucune conversation. Choisissez un membre ci-dessous pour écrire.'));
  const { data: us } = await sb.from('profiles').select('id,full_name,avatar_url').neq('id', session.user.id).eq('status', 'actif').order('full_name');
  const lm = h('div', { className: 'card' }, h('h3', {}, 'Écrire à un membre'));
  (us || []).forEach(u => lm.append(h('div', { className: 'ligne com' }, h('span', { className: 'qui' }, av(u.avatar_url, u.full_name, 34), u.full_name || 'Sans nom'),
    h('span', {}, h('button', { className: 'btn', onclick: async () => {
      const r = await sb.rpc('start_conversation', { autre: u.id });
      if (r.error) return alert(r.error.message);
      conv = { conversation_id: r.data, autre_id: u.id, autre_nom: u.full_name, autre_avatar: u.avatar_url }; afficher();
    } }, 'Écrire')))));
  if (!us?.length) lm.append(h('p', { className: 'meta' }, 'Aucun autre membre pour le moment.'));
  box.append(lm);
  return box;
}

const resume = m => m.deleted_at ? 'Message supprimé' : m.kind === 'vocal' ? '🎤 Message vocal' : m.kind === 'image' ? '📷 Photo' : m.kind === 'video' ? '🎥 Vidéo' : m.kind === 'fichier' ? '📎 ' + (m.media_name || 'Document') : m.content;

async function vueConv() {
  const cid = conv.conversation_id, autre = conv.autre_id, me = session.user.id;
  const msgs = new Map(), els = new Map(), coches = new Map();
  let luAutre = 0, livreAutre = 0, bloque = false, vu = null, reponse = null, dernierJour = '', ecrit = false, minuteurEcrit = null, initial = true;
  setTimeout(() => { initial = false; }, 3000);

  const statut = h('div', { className: 'statut' });
  const tete = h('div', { className: 'chat-tete' },
    h('button', { className: 'retour', onclick: async () => { await lu(); conv = null; afficher(); } }, '‹'),
    h('div', { className: 'tete-cliquable', onclick: () => { ecranContact = true; afficher(); } }, av(conv.autre_avatar, conv.autre_nom, 40),
      h('div', { style: 'min-width:0' }, h('div', { className: 'coupe', style: 'font-weight:600' }, conv.autre_nom || 'Membre'), statut)));
  const majEntete = () => {
    const tape = (canalConv?.presenceState?.()[autre] || []).some(x => x.typing);
    statut.textContent = tape ? 'en train d’écrire…' : enLigne.has(autre) ? 'en ligne' : vu ? 'vu ' + jourHeure(vu) : '';
  };
  surPresence = majEntete;

  const fil = h('div', { className: 'fil' });
  const champ = h('textarea', { placeholder: 'Message', rows: 1 });
  const fichier = h('input', { type: 'file', hidden: true, accept: 'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip' });
  const clip = h('button', { className: 'ico', title: 'Joindre un fichier', onclick: () => fichier.click() }, '📎');
  const action = h('button', { className: 'rond' }, '🎤');
  const cadre = h('div', { className: 'wa-champ' }, champ, clip);
  const barre = h('div', { className: 'wa-saisie' }, cadre, action);
  const barreRep = h('div', { className: 'rep-barre', style: 'display:none' });
  const majAction = () => { action.textContent = champ.value.trim() ? '➤' : '🎤'; };
  const majReponse = () => {
    barreRep.replaceChildren(); barreRep.style.display = reponse ? '' : 'none';
    if (reponse) barreRep.append(h('div', { style: 'flex:1;min-width:0' }, h('b', {}, reponse.sender_id === me ? 'Vous' : conv.autre_nom || 'Membre'), h('div', { className: 'coupe' }, resume(reponse))),
      h('button', { className: 'btn lien', onclick: () => { reponse = null; majReponse(); } }, '✕'));
  };
  const majCoches = () => coches.forEach((el, id) => { const t = Date.parse(msgs.get(id).created_at), lu2 = t <= luAutre, livre = lu2 || t <= livreAutre; el.textContent = livre ? '✓✓' : '✓'; el.className = 'coche' + (lu2 ? ' lu' : ''); });

  const contenu = m => {
    if (m.kind === 'texte') return h('div', { className: 'texte' }, m.content);
    if (m.kind === 'vocal') {
      const a = h('audio', { controls: true, preload: 'none', style: 'width:230px;max-width:100%' });
      urlSignee('voice', m.audio_path).then(u => { if (u) a.src = u; });
      return h('div', {}, a, h('div', { className: 'meta' }, `🎤 ${m.audio_seconds} s`));
    }
    const zone = h('div', { className: 'media-zone' });
    urlSignee('chat-media', m.media_path).then(u => {
      if (!u) return zone.append(h('span', { className: 'meta' }, 'Média indisponible'));
      if (m.kind === 'image') zone.append(h('img', { src: u, className: 'media', alt: 'Photo', onload: () => { if (initial) fil.scrollTop = fil.scrollHeight; }, onclick: () => window.open(u, '_blank') }));
      else if (m.kind === 'video') zone.append(h('video', { src: u, className: 'media', controls: true, preload: 'metadata', playsInline: true }));
      else zone.append(h('a', { href: u, target: '_blank', rel: 'noopener', className: 'fichier' }, '📎 ' + (m.media_name || 'Document')));
    });
    return zone;
  };

  const bulle = m => {
    const moi = m.sender_id === me;
    const b = h('div', { className: 'bulle ' + (moi ? 'moi' : 'autre') });
    if (m.deleted_at) b.append(h('div', { className: 'supprime' }, '🚫 Ce message a été supprimé'));
    else {
      const r = m.reply_to && msgs.get(m.reply_to);
      if (m.reply_to) b.append(h('div', { className: 'citation' }, h('b', {}, r ? (r.sender_id === me ? 'Vous' : conv.autre_nom || 'Membre') : 'Message'), h('div', { className: 'coupe' }, r ? resume(r) : 'Message précédent')));
      b.append(contenu(m));
    }
    const coche = moi && !m.deleted_at ? h('span', { className: 'coche' }, '✓') : null;
    if (coche) coches.set(m.id, coche);
    b.append(h('div', { className: 'heure' }, heureCourte(m.created_at) + (coche ? ' ' : ''), coche));
    if (!m.deleted_at) b.onclick = e => {
      if (e.target.closest('audio,video,a,img')) return;
      document.querySelectorAll('.menu-msg').forEach(x => x.remove());
      const acts = [['↩️ Répondre', () => { reponse = msgs.get(m.id); majReponse(); champ.focus(); }]];
      if (m.kind === 'texte') acts.push(['📋 Copier', () => navigator.clipboard?.writeText(m.content)]);
      if (moi) acts.push(['🗑️ Supprimer pour tous', async () => {
        if (!confirm('Supprimer ce message pour tous ?')) return;
        const r2 = await sb.rpc('supprimer_message', { mid: m.id });
        if (r2.error) return alert(r2.error.message);
        remplacer({ id: m.id, deleted_at: new Date().toISOString(), content: '' });
      }]);
      const menu = h('div', { className: 'menu-msg ' + (moi ? 'moi' : 'autre') }, ...acts.map(([l, f]) => h('button', { onclick: ev => { ev.stopPropagation(); menu.remove(); f(); } }, l)));
      b.after(menu);
    };
    return b;
  };
  const ajouter = (m, doux) => {
    if (els.has(m.id)) return;
    msgs.set(m.id, m);
    const jour = new Date(m.created_at).toDateString();
    if (jour !== dernierJour) { dernierJour = jour; fil.append(h('div', { className: 'jour' }, libelleJour(m.created_at))); }
    const b = bulle(m); els.set(m.id, b); fil.append(b);
    if (!doux) { majCoches(); fil.scrollTop = fil.scrollHeight; }
  };
  function remplacer(m) {
    const ancien = els.get(m.id); if (!ancien) return;
    const fusion = { ...msgs.get(m.id), ...m }; msgs.set(m.id, fusion); coches.delete(m.id);
    const b = bulle(fusion); ancien.replaceWith(b); els.set(m.id, b); majCoches();
  }

  const lu = () => sb.rpc('marquer_lu', { cid });
  async function rattraper() {
    if (conv?.conversation_id !== cid) return;
    const dernier = [...msgs.values()].reduce((m, x) => x.created_at > m ? x.created_at : m, cmM?.cleared_at || '1970-01-01T00:00:00Z');
    const [{ data: nv }, { data: cm2 }] = await Promise.all([
      sb.from('messages').select('*').eq('conversation_id', cid).gt('created_at', dernier).order('created_at').limit(100),
      sb.from('conversation_members').select('last_read_at,last_delivered_at').eq('conversation_id', cid).eq('user_id', autre).single()]);
    (nv || []).forEach(m => ajouter(m));
    if ((nv || []).some(m => m.sender_id !== me)) lu();
    if (cm2) { luAutre = Date.parse(cm2.last_read_at); livreAutre = Date.parse(cm2.last_delivered_at); majCoches(); }
  }
  const tape = etat => { if (ecrit === etat) return; ecrit = etat; canalConv?.track({ typing: etat }); };
  const poster = async champs => {
    const ligne = { conversation_id: cid, ...champs };
    if (reponse) ligne.reply_to = reponse.id;
    const { data: m, error } = await sb.from('messages').insert(ligne).select().single();
    if (error) { alert(error.code === '42501' ? 'Message non envoyé.' : error.message); return false; }
    reponse = null; majReponse(); ajouter(m); return true;
  };
  const envoyerTexte = async () => {
    const t = champ.value.trim(); if (!t) return;
    champ.value = ''; champ.style.height = 'auto'; majAction(); tape(false);
    if (!await poster({ kind: 'texte', content: t })) { champ.value = t; majAction(); }
  };
  champ.oninput = () => { champ.style.height = 'auto'; champ.style.height = Math.min(champ.scrollHeight, 120) + 'px'; majAction(); if (champ.value.trim()) { tape(true); clearTimeout(minuteurEcrit); minuteurEcrit = setTimeout(() => tape(false), 2500); } else tape(false); };

  fichier.onchange = async () => {
    const f = fichier.files[0]; fichier.value = ''; if (!f) return;
    if (f.size > 25 * 1024 * 1024) return alert('Fichier trop volumineux (25 Mo maximum). Pour une longue vidéo, partagez un lien YouTube.');
    clip.textContent = '⏳';
    try {
      const kind = f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : 'fichier';
      let blob = f, mime = f.type || 'application/octet-stream', ext = (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
      if (kind === 'image') { blob = await reduireImage(f); mime = 'image/jpeg'; ext = 'jpg'; }
      const chemin = `${cid}/${crypto.randomUUID()}.${ext}`;
      const up = await sb.storage.from('chat-media').upload(chemin, blob, { contentType: mime });
      if (up.error) throw up.error;
      await poster({ kind, media_path: chemin, media_mime: mime, media_name: f.name });
    } catch (e) { alert(e.message || 'Échec de l’envoi'); }
    clip.textContent = '📎';
  };

  // Messages vocaux
  let rec = null, flux = null, morceaux = [], debut = 0, minuteur = null;
  const finVocal = () => { clearInterval(minuteur); flux?.getTracks().forEach(t => t.stop()); };
  const afficherBarre = () => barre.replaceChildren(cadre, action);
  const demarrerVocal = async () => {
    if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') return alert('Enregistrement non pris en charge sur cet appareil.');
    try { flux = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return alert('Autorisez le microphone pour envoyer un message vocal.'); }
    const type = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm' : 'audio/mp4';
    rec = new MediaRecorder(flux); morceaux = []; debut = Date.now();
    rec.ondataavailable = e => morceaux.push(e.data);
    const temps = h('span', { className: 'auteur', style: 'flex:1' }, '🔴 0:00');
    const annuler = h('button', { className: 'btn lien' }, '🗑️ Annuler'), envoi = h('button', { className: 'rond' }, '➤');
    minuteur = setInterval(() => { const x = Math.floor((Date.now() - debut) / 1000); temps.textContent = `🔴 ${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`; if (x >= 120) envoi.click(); }, 500);
    annuler.onclick = () => { rec.onstop = null; rec.stop(); finVocal(); afficherBarre(); };
    envoi.onclick = () => {
      envoi.disabled = true;
      rec.onstop = async () => {
        const secondes = Math.min(120, Math.max(1, Math.round((Date.now() - debut) / 1000))), blob = new Blob(morceaux, { type }); finVocal();
        const chemin = `${cid}/${crypto.randomUUID()}.${type === 'audio/webm' ? 'webm' : 'm4a'}`;
        const up = await sb.storage.from('voice').upload(chemin, blob, { contentType: type });
        if (up.error) { alert(up.error.message); return afficherBarre(); }
        await poster({ kind: 'vocal', audio_path: chemin, audio_seconds: secondes });
        afficherBarre();
      };
      rec.stop();
    };
    rec.start(); barre.replaceChildren(annuler, temps, envoi);
  };
  action.onclick = () => champ.value.trim() ? envoyerTexte() : demarrerVocal();

  // Chargement
  const [{ data: po }, { data: cmA }, { data: cmM }, { data: bl }] = await Promise.all([
    sb.from('profiles').select('last_seen_at,show_online').eq('id', autre).single(),
    sb.from('conversation_members').select('last_read_at,last_delivered_at').eq('conversation_id', cid).eq('user_id', autre).single(),
    sb.from('conversation_members').select('cleared_at').eq('conversation_id', cid).eq('user_id', me).single(),
    sb.from('blocks').select('blocked_id').eq('blocker_id', me).eq('blocked_id', autre).maybeSingle()]);
  let req = sb.from('messages').select('*').eq('conversation_id', cid);
  if (cmM?.cleared_at) req = req.gt('created_at', cmM.cleared_at);
  const { data } = await req.order('created_at', { ascending: false }).limit(80);
  bloque = !!bl;
  vu = po?.show_online === false ? null : po?.last_seen_at;
  luAutre = cmA ? Date.parse(cmA.last_read_at) : 0; livreAutre = cmA ? Date.parse(cmA.last_delivered_at) : 0;
  const liste = (data || []).reverse();
  liste.forEach(m => msgs.set(m.id, m));
  liste.forEach(m => ajouter(m, true));
  lu(); majCoches(); majEntete(); setTimeout(() => { fil.scrollTop = fil.scrollHeight; }, 60);

  canalConv = sb.channel('conv-' + cid, { config: { presence: { key: me } } })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${cid}` }, p => { ajouter(p.new); if (p.new.sender_id !== me) lu(); })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${cid}` }, p => remplacer(p.new))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `conversation_id=eq.${cid}` }, p => { if (p.new.user_id === autre) { luAutre = Date.parse(p.new.last_read_at); livreAutre = Date.parse(p.new.last_delivered_at); majCoches(); } })
    .on('presence', { event: 'sync' }, majEntete)
    .subscribe(async st => { if (st === 'SUBSCRIBED') { await canalConv.track({ typing: false }); rattraper(); } });
  clearInterval(syncConv); syncConv = setInterval(() => { if (!document.hidden) rattraper(); }, 12000);

  if (bloque) barre.replaceChildren(h('button', { className: 'btn', style: 'flex:1', onclick: async () => { await sb.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', autre); afficher(); } }, 'Vous avez bloqué ce contact. Appuyez pour débloquer.'));
  return h('div', { className: 'chat' }, tete, fil, barreRep, barre, fichier);
}

// ---------- Section « Plus » ----------
const admin = () => profile?.role === 'admin';
const can = p => profile?.role === 'admin' || perms.has(p);
const PERM_TABLE = { announcements: 'annonces', videos: 'videos', teachings: 'enseignements', events: 'agenda', churches: 'assemblees', meditations: 'meditations', series: 'parcours', sessions: 'parcours' };
const PERMS = [['publier', 'Publier à l’accueil et épingler'], ['annonces', 'Annonces'], ['videos', 'Vidéothèque et directs'], ['enseignements', 'Enseignements'], ['agenda', 'Agenda'], ['meditations', 'Méditation du jour'], ['assemblees', 'Assemblées'], ['groupes', 'Communautés (créer, supprimer)'], ['bibliotheque', 'Lien de la bibliothèque'], ['moderer', 'Modération : signalements, suppressions, suspensions'], ['parcours', 'Parcours « 5 minutes avec Christ »']];
const lab = (liste, v) => (liste.find(x => x[0] === v) || [v, v])[1];
const CAT_ANN = [['generale', 'Générale'], ['reunion', 'Réunion'], ['culte', 'Culte'], ['conference', 'Conférence'], ['formation', 'Formation'], ['evenement', 'Événement'], ['important', 'Important']];
const CAT_VID = [['culte', 'Cultes'], ['predication', 'Prédications'], ['enseignement', 'Enseignements'], ['conference', 'Conférences'], ['formation', 'Formations'], ['temoignage', 'Témoignages']];
const SERIES = [['conscience_christ', 'La conscience du Christ'], ['conscience_corps', 'La conscience du Corps de Christ'], ['nouvelle_alliance', 'La Nouvelle Alliance'], ['royaume', 'Le Royaume de Dieu'], ['foi', 'La foi'], ['vie_chretienne', 'La vie chrétienne'], ['bibliques', 'Enseignements bibliques'], ['autres', 'Autres séries']];
const CAT_EVT = [['culte', 'Culte'], ['conference', 'Conférence'], ['formation', 'Formation'], ['reunion', 'Réunion'], ['special', 'Événement spécial'], ['jeunesse', 'Jeunesse'], ['femmes', 'Femmes'], ['hommes', 'Hommes']];
const ytId = u => (String(u).match(/(?:v=|youtu\.be\/|embed\/|live\/|shorts\/)([\w-]{11})/) || [])[1] || (/^[\w-]{11}$/.test(String(u).trim()) ? String(u).trim() : null);

const retour = titre => h('div', { className: 'qui', style: 'margin-bottom:.8rem' },
  h('button', { className: 'btn lien', onclick: () => { sous = null; afficher(); } }, '‹ Plus'), h('h2', {}, titre));
const supprimer = (table, id) => can(PERM_TABLE[table]) ? h('button', { className: 'btn lien', onclick: async () => {
  if (confirm('Supprimer définitivement ?')) { await sb.from(table).delete().eq('id', id); afficher(); } } }, 'Supprimer') : null;

function formulaire(titre, table, champs, extra = {}) {
  const els = champs.map(c => [c, c.type === 'textarea' ? h('textarea', { rows: 3, placeholder: c.label })
    : c.type === 'select' ? h('select', {}, ...c.options.map(([v, l]) => h('option', { value: v }, l)))
    : c.type === 'checkbox' ? h('input', { type: 'checkbox' })
    : h('input', { type: c.type || 'text', placeholder: c.label, title: c.label })]);
  const msg = h('p', { className: 'erreur' });
  const bt = h('button', { className: 'btn primaire' }, 'Publier');
  bt.onclick = async () => {
    msg.textContent = ''; const row = { ...extra };
    for (const [c, el] of els) {
      let v = c.type === 'checkbox' ? el.checked : el.value.trim();
      if (c.type === 'datetime-local' && v) v = new Date(v).toISOString();
      if (c.transform) v = c.transform(v);
      if (v === '' || v == null) { if (c.requis) { msg.textContent = `${c.label} : valeur manquante ou invalide`; return; } v = null; }
      if (v !== null) row[c.k] = v;
    }
    bt.disabled = true; const { error } = await sb.from(table).insert(row); bt.disabled = false;
    if (error) msg.textContent = error.message; else afficher();
  };
  return h('details', { className: 'card' }, h('summary', {}, '+ ' + titre),
    ...els.flatMap(([c, el]) => c.type === 'checkbox' ? [h('label', { className: 'check' }, el, c.label)] : [h('label', {}, c.label), el]), msg, bt);
}

async function listeFiltree(box, requete, cle, cats, rendu, vide) {
  const { data, error } = await requete;
  if (error) return box.append(h('p', { className: 'erreur' }, error.message));
  const sel = h('select', {}, h('option', { value: '' }, 'Toutes les catégories'), ...cats.map(([v, l]) => h('option', { value: v }, l)));
  const zone = h('div');
  const dessiner = () => {
    zone.replaceChildren();
    const f = data.filter(x => !sel.value || x[cle] === sel.value);
    if (f.length) f.forEach(x => zone.append(rendu(x))); else zone.append(h('p', { className: 'vide' }, vide));
  };
  sel.onchange = dessiner; dessiner();
  box.append(sel, zone);
}

function vignette(id) {
  const zone = h('div');
  const img = h('img', { src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, alt: 'Lire la vidéo', className: 'vignette', loading: 'lazy' });
  img.onclick = () => zone.replaceChildren(h('iframe', { src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`, className: 'lecteur', allow: 'autoplay; encrypted-media; picture-in-picture', allowFullscreen: true }));
  zone.append(img); return zone;
}

const SECTIONS = {
  recherche: ['🔍 Recherche', () => vueRecherche()],
  parcours: ['🔥 Mes parcours · 5 minutes avec Christ', () => vueParcours()],
  monassemblee: ['🏛️ Mon assemblée', () => vueMonAssemblee()],
  meditations: ['🌅 Méditation du jour', () => vueMeditations()],
  annonces: ['📢 Annonces', () => vueAnnonces()],
  videos: ['🎥 Vidéothèque et direct', () => vueVideos()],
  enseignements: ['📖 Enseignements du Dr S-J Nepios', () => vueEnseignements()],
  agenda: ['📅 Agenda', () => vueAgenda()],
  priere: ['🙏 Espace de prière', () => vuePriere()],
  assemblees: ['⛪ Nos assemblées', () => vueAssemblees()],
  enregistres: ['🔖 Publications enregistrées', () => vueEnregistres()],
  inviter: ['📲 Inviter quelqu’un à installer l’app', () => vueInviter()],
  bibliotheque: ['📚 Bibliothèque numérique', () => vueBibliotheque()],
  notifications: ['🔔 Notifications', () => vueNotifs()],
  signalements: ['🚩 Signalements', () => vueSignalements()],
  admin: ['⚙️ Administration', () => vueAdmin()]
};

async function vuePlus() {
  if (sous && SECTIONS[sous]) { sb.rpc('marquer_section', { sec: sous }).then(() => majBadges()); return SECTIONS[sous][1](); }
  const { data } = await sb.rpc('nouveautes'); nouv = Object.fromEntries((data || []).map(x => [x.section, Number(x.n)]));
  const box = h('div', { className: 'menu' }, h('h2', { style: 'margin-bottom:.8rem' }, 'Plus'));
  Object.entries(SECTIONS).filter(([k]) => k === 'admin' ? (admin() || can('groupes')) : k === 'signalements' ? can('moderer') : true).forEach(([k, [titre]]) =>
    box.append(h('button', { className: 'btn', onclick: () => { sous = k; afficher(); } }, h('span', {}, titre), nouv[k] > 0 ? h('span', { className: 'pastille rouge' }, 'Nouveau · ' + nouv[k]) : null)));
  return box;
}

async function vueAnnonces() {
  const box = h('div', {}, retour('Annonces'));
  if (can('annonces')) box.append(formulaire('Nouvelle annonce', 'announcements', [
    { k: 'title', label: 'Titre', requis: 1 }, { k: 'body', label: 'Message', type: 'textarea' },
    { k: 'category', label: 'Type', type: 'select', options: CAT_ANN }, { k: 'pinned', label: 'Mettre en évidence', type: 'checkbox' }]));
  await listeFiltree(box, sb.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(60),
    'category', CAT_ANN, a => h('article', { className: 'card' + (a.pinned ? ' epingle' : '') },
      h('div', { className: 'ligne' }, h('div', {}, h('div', { className: 'auteur' }, a.title),
        h('div', { className: 'meta' }, lab(CAT_ANN, a.category) + ' · ' + quand(a.created_at))), supprimer('announcements', a.id)),
      a.body ? h('p', { style: 'white-space:pre-wrap' }, a.body) : null), 'Aucune annonce pour le moment.');
  return box;
}

async function vueVideos() {
  const box = h('div', {}, retour('Vidéothèque et direct'));
  if (can('videos')) box.append(formulaire('Ajouter une vidéo ou un direct', 'videos', [
    { k: 'title', label: 'Titre', requis: 1 }, { k: 'youtube_id', label: 'Lien YouTube', requis: 1, transform: ytId },
    { k: 'speaker', label: 'Intervenant' }, { k: 'category', label: 'Catégorie', type: 'select', options: CAT_VID },
    { k: 'published_on', label: 'Date', type: 'date' }, { k: 'description', label: 'Description', type: 'textarea' },
    { k: 'is_live', label: 'Direct en cours', type: 'checkbox' }]));
  await listeFiltree(box, sb.from('videos').select('*').order('is_live', { ascending: false }).order('published_on', { ascending: false }).limit(60),
    'category', CAT_VID, v => h('article', { className: 'card' },
      vignette(v.youtube_id),
      h('div', { className: 'ligne', style: 'margin-top:.6rem' }, h('div', {}, h('div', { className: 'auteur' }, v.title),
        h('div', { className: 'meta' }, [lab(CAT_VID, v.category), v.speaker, new Date(v.published_on).toLocaleDateString('fr-FR')].filter(Boolean).join(' · '))),
        v.is_live ? h('span', { className: 'direct' }, 'EN DIRECT') : supprimer('videos', v.id)),
      v.description ? h('p', {}, v.description) : null, v.is_live ? supprimer('videos', v.id) : null), 'Aucune vidéo pour le moment.');
  return box;
}

async function vueEnseignements() {
  const box = h('div', {}, retour('Enseignements du Dr S-J Nepios'));
  if (can('enseignements')) box.append(formulaire('Ajouter un enseignement', 'teachings', [
    { k: 'title', label: 'Titre', requis: 1 }, { k: 'series', label: 'Série', type: 'select', options: SERIES },
    { k: 'kind', label: 'Format', type: 'select', options: [['article', 'Texte'], ['video', 'Vidéo YouTube'], ['pdf', 'Document PDF']] },
    { k: 'url', label: 'Lien (YouTube ou PDF)', type: 'url' }, { k: 'description', label: 'Description', type: 'textarea' },
    { k: 'body', label: 'Texte de l’enseignement', type: 'textarea' }]));
  await listeFiltree(box, sb.from('teachings').select('*').order('created_at', { ascending: false }).limit(100),
    'series', SERIES, t => h('article', { className: 'card' },
      h('div', { className: 'ligne' }, h('div', {}, h('div', { className: 'auteur' }, t.title), h('div', { className: 'meta' }, lab(SERIES, t.series))), supprimer('teachings', t.id)),
      t.description ? h('p', {}, t.description) : null,
      t.kind === 'video' && ytId(t.url) ? vignette(ytId(t.url)) : (t.url ? h('a', { className: 'btn', href: t.url, target: '_blank', rel: 'noopener' }, 'Ouvrir le document') : null),
      t.body ? h('details', {}, h('summary', {}, 'Lire le texte'), h('p', { style: 'white-space:pre-wrap' }, t.body)) : null),
    'Les enseignements seront publiés ici par l’administration.');
  return box;
}

async function vueAgenda() {
  const box = h('div', {}, retour('Agenda'));
  if (can('agenda')) box.append(formulaire('Nouvel événement', 'events', [
    { k: 'title', label: 'Titre', requis: 1 }, { k: 'category', label: 'Type', type: 'select', options: CAT_EVT },
    { k: 'starts_at', label: 'Date et heure', type: 'datetime-local', requis: 1 }, { k: 'location', label: 'Lieu' },
    { k: 'responsable', label: 'Responsable' }, { k: 'link', label: 'Lien (facultatif)', type: 'url' }, { k: 'description', label: 'Description', type: 'textarea' }]));
  await listeFiltree(box, sb.from('events').select('*').gte('starts_at', new Date(Date.now() - 864e5).toISOString()).order('starts_at').limit(60),
    'category', CAT_EVT, e => h('article', { className: 'card' },
      h('div', { className: 'ligne' }, h('div', {}, h('div', { className: 'auteur' }, e.title),
        h('div', { className: 'meta' }, new Date(e.starts_at).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))), supprimer('events', e.id)),
      h('p', { className: 'meta' }, [lab(CAT_EVT, e.category), e.location, e.responsable && 'Resp. ' + e.responsable].filter(Boolean).join(' · ')),
      e.description ? h('p', {}, e.description) : null,
      e.link ? h('a', { className: 'btn', href: e.link, target: '_blank', rel: 'noopener' }, 'Plus d’informations') : null), 'Aucun événement à venir.');
  return box;
}

async function vuePriere() {
  const box = h('div', {}, retour('Mur de prière'));
  const texte = h('textarea', { rows: 3, placeholder: 'Partagez une demande de prière ou un témoignage…' });
  const genre = h('select', {}, h('option', { value: 'demande' }, '🙏 Demande de prière'), h('option', { value: 'temoignage' }, '🎉 Témoignage / reconnaissance'));
  const vis = h('select', {}, h('option', { value: 'public' }, '🌍 Publique (tous les membres)'), h('option', { value: 'groupe' }, '👥 Réservée à un groupe'), h('option', { value: 'prive' }, '🔒 Privée (moi seul)'));
  const { data: mg } = await sb.from('group_members').select('group_id,groups!group_members_group_id_fkey(name)').eq('user_id', session.user.id).eq('status', 'actif');
  const grp = h('select', { style: 'display:none' }, ...(mg || []).map(m => h('option', { value: m.group_id }, m.groups?.name || 'Groupe')));
  vis.onchange = () => { grp.style.display = vis.value === 'groupe' ? '' : 'none'; };
  const err = h('p', { className: 'erreur' }), bt = h('button', { className: 'btn primaire' }, 'Partager');
  bt.onclick = async () => {
    err.textContent = ''; if (!texte.value.trim()) return;
    if (vis.value === 'groupe' && !grp.value) { err.textContent = 'Rejoignez d’abord un groupe.'; return; }
    const { error } = await sb.from('prayer_requests').insert({ content: texte.value.trim(), kind: genre.value, visibility: vis.value, group_id: vis.value === 'groupe' ? grp.value : null });
    if (error) err.textContent = error.message; else afficher();
  };
  box.append(h('div', { className: 'card' }, texte, genre, vis, grp, err, bt));
  const [{ data, error }, { data: mes }] = await Promise.all([
    sb.from('prayer_requests').select('id,content,kind,visibility,created_at,author_id,profiles!prayer_requests_author_id_fkey(full_name,avatar_url),prayer_supports(count),prayer_comments(count)').order('created_at', { ascending: false }).limit(40),
    sb.from('prayer_supports').select('request_id').eq('user_id', session.user.id)]);
  if (error) return box.append(h('p', { className: 'erreur' }, error.message)), box;
  const prie = new Set((mes || []).map(x => x.request_id));
  if (!data.length) box.append(h('p', { className: 'vide' }, 'Aucun message pour le moment. Soyez le premier à partager.'));
  data.forEach(r => {
    const tem = r.kind === 'temoignage';
    let n = r.prayer_supports[0]?.count || 0, nc = r.prayer_comments[0]?.count || 0, moi = prie.has(r.id);
    const ligne = h('div', { className: 'meta' }), b = h('button', {}), bc = h('button', {}), zone = h('div');
    const maj = () => {
      b.className = moi ? 'on' : ''; b.textContent = tem ? (moi ? '🙌 Gloire à Dieu !' : '🙌 Gloire à Dieu') : (moi ? '🙏 Je prie pour toi ✓' : '🙏 Je prie pour toi'); bc.textContent = `💬 ${nc}`;
      ligne.textContent = n ? (tem ? `🎉 ${n} personne${n > 1 ? 's' : ''} se réjouissent avec vous.` : `🙏 ${n} personne${n > 1 ? 's' : ''} prie${n > 1 ? 'nt' : ''} pour cette demande.`) : '';
    }; maj();
    b.onclick = async () => {
      const x = moi ? await sb.from('prayer_supports').delete().eq('request_id', r.id).eq('user_id', session.user.id) : await sb.from('prayer_supports').insert({ request_id: r.id });
      if (!x.error) { moi = !moi; n += moi ? 1 : -1; maj(); }
    };
    bc.onclick = async () => {
      if (zone.childElementCount) return zone.replaceChildren();
      const { data: cs } = await sb.from('prayer_comments').select('id,content,created_at,author_id,profiles!prayer_comments_author_id_fkey(full_name)').eq('request_id', r.id).order('created_at');
      const c = h('div', { className: 'com' });
      (cs || []).forEach(x => c.append(h('p', {}, h('span', { className: 'auteur' }, (x.profiles?.full_name || 'Membre') + ' '), x.content)));
      const champ = h('input', { placeholder: 'Un mot d’encouragement…' }), ok = h('button', { className: 'btn' }, 'Envoyer');
      ok.onclick = async () => {
        if (!champ.value.trim()) return;
        const { error: e } = await sb.from('prayer_comments').insert({ request_id: r.id, content: champ.value.trim() });
        if (e) return alert(e.message); nc++; maj(); zone.replaceChildren(); bc.onclick();
      };
      c.append(champ, ok); zone.append(c);
    };
    const sup = (r.author_id === session.user.id || can('moderer')) ? h('button', { className: 'btn lien', onclick: async () => {
      if (confirm('Supprimer ce message ?')) { await sb.from('prayer_requests').delete().eq('id', r.id); afficher(); } } }, 'Supprimer') : null;
    box.append(h('article', { className: 'card' }, h('div', { className: 'ligne' }, h('div', { className: 'qui' }, av(r.profiles?.avatar_url, r.profiles?.full_name, 36),
      h('div', {}, h('div', { className: 'auteur' }, r.profiles?.full_name || 'Membre'),
        h('div', { className: 'meta' }, (tem ? '🎉 Témoignage · ' : '🙏 Demande · ') + quand(r.created_at) + (r.visibility === 'prive' ? ' · 🔒 Privé' : r.visibility === 'groupe' ? ' · 👥 Groupe' : '')))), sup),
      h('p', { style: 'white-space:pre-wrap' }, r.content), ligne, h('div', { className: 'actions' }, b, bc), zone));
  });
  return box;
}

async function vueBibliotheque() {
  const box = h('div', {}, retour('Bibliothèque numérique'));
  const { data } = await sb.from('reglages').select('valeur').eq('cle', 'url_bibliotheque').maybeSingle();
  const url = data?.valeur;
  box.append(url ? h('div', { className: 'card' }, h('h3', {}, 'Grande Bibliothèque numérique MNA'),
      h('p', {}, 'Livres, documents et ressources du Ministère de la Nouvelle Alliance et de l’École Biblique Kainos.'),
      h('a', { className: 'btn primaire', href: url, target: '_blank', rel: 'noopener' }, 'Ouvrir la bibliothèque'))
    : h('p', { className: 'vide' }, 'Le lien de la bibliothèque sera bientôt disponible.'));
  if (can('bibliotheque')) {
    const champ = h('input', { type: 'url', placeholder: 'https://…', value: url || '' }), msg = h('p', { className: 'ok' });
    box.append(h('div', { className: 'card' }, h('h3', {}, 'Adresse du site de la bibliothèque'), champ, msg,
      h('button', { className: 'btn primaire', onclick: async () => {
        const v = champ.value.trim();
        if (!/^https:\/\//.test(v)) { msg.className = 'erreur'; msg.textContent = 'Le lien doit commencer par https://'; return; }
        const { error } = await sb.from('reglages').upsert({ cle: 'url_bibliotheque', valeur: v });
        if (error) { msg.className = 'erreur'; msg.textContent = error.message; } else afficher();
      } }, 'Enregistrer')));
  }
  return box;
}

async function vueNotifs() {
  const box = h('div', {}, retour('Notifications'));
  const { data, error } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) return box.append(h('p', { className: 'erreur' }, error.message)), box;
  if (!data.length) box.append(h('p', { className: 'vide' }, 'Rien de nouveau pour le moment.'));
  data.forEach(n => box.append(h('div', { className: 'card' + (n.read ? '' : ' epingle'), style: 'cursor:pointer', onclick: () => {
    if (SECTIONS[n.tab]) { tab = 'plus'; sous = n.tab; } else { tab = n.tab || 'accueil'; sous = null; conv = null; }
    afficher(); } }, h('div', { className: 'auteur' }, n.title), h('div', {}, n.body || ''), h('div', { className: 'meta' }, quand(n.created_at)))));
  if (data.some(n => !n.read)) sb.from('notifications').update({ read: true }).eq('user_id', session.user.id).eq('read', false);
  return box;
}

async function signaler(type, id) {
  const raison = prompt('Pourquoi signalez-vous ce contenu ? (facultatif)');
  if (raison === null) return;
  const { error } = await sb.from('reports').insert({ target_type: type, target_id: id, reason: raison.trim() || null });
  alert(error ? (error.code === '23505' ? 'Vous avez déjà signalé ce contenu.' : error.message) : 'Merci. Le signalement a été transmis à l’administration.');
}

async function vueSignalements() {
  const box = h('div', {}, retour('Signalements'));
  const { data, error } = await sb.from('reports').select('*').eq('status', 'ouvert').order('created_at', { ascending: false }).limit(50);
  if (error) return box.append(h('p', { className: 'erreur' }, error.message)), box;
  if (!data.length) box.append(h('p', { className: 'vide' }, 'Aucun signalement en attente.'));
  for (const r of data) {
    let apercu = 'Contenu introuvable ou déjà supprimé', auteur = null, suppr = null;
    if (r.target_type === 'post') {
      const { data: p } = await sb.from('posts').select('content,author_id,media_url,profiles!posts_author_id_fkey(full_name)').eq('id', r.target_id).maybeSingle();
      if (p) { apercu = `${p.profiles?.full_name || 'Membre'} : ${p.content}`; auteur = p.author_id; suppr = async () => { if (p.media_url) await sb.storage.from('post-media').remove([p.media_url]); await sb.from('posts').delete().eq('id', r.target_id); }; }
    } else if (r.target_type === 'comment') {
      const { data: c } = await sb.from('comments').select('content,author_id,profiles!comments_author_id_fkey(full_name)').eq('id', r.target_id).maybeSingle();
      if (c) { apercu = `${c.profiles?.full_name || 'Membre'} : ${c.content}`; auteur = c.author_id; suppr = () => sb.from('comments').delete().eq('id', r.target_id); }
    } else {
      const { data: u } = await sb.from('profiles').select('full_name').eq('id', r.target_id).maybeSingle();
      if (u) { apercu = `Compte : ${u.full_name || 'Sans nom'}`; auteur = r.target_id; }
    }
    const fin = async fn => { await fn(); await sb.from('reports').update({ status: 'traite' }).eq('id', r.id); afficher(); };
    box.append(h('article', { className: 'card' },
      h('div', { className: 'meta' }, `${lab([['post', 'Publication'], ['comment', 'Commentaire'], ['user', 'Utilisateur']], r.target_type)} · ${quand(r.created_at)}`),
      h('p', { style: 'white-space:pre-wrap' }, apercu.slice(0, 400)),
      r.reason ? h('p', { className: 'meta' }, 'Motif : ' + r.reason) : null,
      h('div', { className: 'actions', style: 'flex-wrap:wrap' },
        suppr ? h('button', { onclick: () => confirm('Supprimer ce contenu ?') && fin(suppr) }, 'Supprimer le contenu') : null,
        auteur && auteur !== session.user.id ? h('button', { onclick: () => confirm('Suspendre ce compte ?') && fin(() => sb.from('profiles').update({ status: 'suspendu' }).eq('id', auteur)) }, 'Suspendre l’auteur') : null,
        h('button', { onclick: () => fin(async () => {}) }, 'Classer sans suite'))));
  }
  return box;
}

async function vueAssemblees() {
  const box = h('div', {}, retour('Nos assemblées'));
  if (can('assemblees')) box.append(formulaire('Nouvelle assemblée', 'churches', [
    { k: 'name', label: 'Nom de l’assemblée', requis: 1 }, { k: 'city', label: 'Ville' }, { k: 'country', label: 'Pays' },
    { k: 'address', label: 'Adresse' }, { k: 'leader_name', label: 'Responsable' }, { k: 'service_times', label: 'Horaires des cultes' },
    { k: 'description', label: 'Description', type: 'textarea' }]));
  const [{ data, error }, { data: ps }] = await Promise.all([sb.from('churches').select('*').order('name'), sb.from('profiles').select('church_id').not('church_id', 'is', null)]);
  if (error) return box.append(h('p', { className: 'erreur' }, error.message)), box;
  if (!data.length) box.append(h('p', { className: 'vide' }, 'Les assemblées seront ajoutées par l’administration.'));
  const n = {}; (ps || []).forEach(p => n[p.church_id] = (n[p.church_id] || 0) + 1);
  data.forEach(c => {
    const mienne = profile.church_id === c.id;
    box.append(h('article', { className: 'card' + (mienne ? ' epingle' : '') },
      h('div', { className: 'ligne' }, h('div', {}, h('div', { className: 'auteur' }, c.name),
        h('div', { className: 'meta' }, [c.city, c.country].filter(Boolean).join(', '))), supprimer('churches', c.id)),
      c.address ? h('p', {}, h('a', { href: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.address + ' ' + (c.city || '')), target: '_blank', rel: 'noopener' }, '📍 ' + c.address)) : null,
      c.leader_name ? h('p', { className: 'meta' }, 'Responsable : ' + c.leader_name) : null,
      c.service_times ? h('p', {}, '🕒 ' + c.service_times) : null,
      c.description ? h('p', {}, c.description) : null,
      h('div', { className: 'ligne' }, h('span', { className: 'meta' }, `${n[c.id] || 0} membre(s)`),
        mienne ? h('span', { className: 'auteur' }, 'Mon assemblée') : h('button', { className: 'btn', onclick: async () => {
          const { error: e } = await sb.from('profiles').update({ church_id: c.id }).eq('id', session.user.id);
          if (e) alert(e.message); else { profile.church_id = c.id; afficher(); } } }, 'C’est mon assemblée'))));
  });
  return box;
}

async function vueRecherche() {
  const box = h('div', {}, retour('Recherche'));
  const champ = h('input', { type: 'search', placeholder: 'Membre, publication, enseignement, vidéo…' }), zone = h('div');
  let t; champ.oninput = () => { clearTimeout(t); t = setTimeout(chercher, 400); };
  async function chercher() {
    const q = champ.value.replace(/[%,()*\\]/g, ' ').trim(); zone.replaceChildren();
    if (q.length < 2) return;
    const m = `%${q}%`;
    const r = await Promise.all([
      sb.from('profiles').select('id,full_name,avatar_url').ilike('full_name', m).limit(8),
      sb.from('posts').select('id,content').ilike('content', m).limit(8),
      sb.from('announcements').select('id,title').or(`title.ilike.${m},body.ilike.${m}`).limit(8),
      sb.from('videos').select('id,title').or(`title.ilike.${m},speaker.ilike.${m},description.ilike.${m}`).limit(8),
      sb.from('teachings').select('id,title').or(`title.ilike.${m},description.ilike.${m},body.ilike.${m}`).limit(8),
      sb.from('events').select('id,title').or(`title.ilike.${m},description.ilike.${m},location.ilike.${m}`).limit(8),
      sb.from('churches').select('id,name').or(`name.ilike.${m},city.ilike.${m}`).limit(8)]);
    const groupes = [['Membres', r[0].data, u => u.full_name || 'Sans nom', 'membre'], ['Publications', r[1].data, p => p.content.slice(0, 90), 'accueil'],
      ['Annonces', r[2].data, x => x.title, 'annonces'], ['Vidéos', r[3].data, x => x.title, 'videos'], ['Enseignements', r[4].data, x => x.title, 'enseignements'],
      ['Agenda', r[5].data, x => x.title, 'agenda'], ['Assemblées', r[6].data, x => x.name, 'assemblees']];
    let total = 0;
    groupes.forEach(([titre, lignes, txt, cible]) => {
      if (!lignes?.length) return; total += lignes.length;
      zone.append(h('h3', { style: 'margin:1rem 0 .4rem' }, titre));
      lignes.forEach(x => zone.append(h('div', { className: 'card', style: 'cursor:pointer;padding:.7rem 1rem', onclick: async () => {
        if (cible === 'membre') {
          if (x.id === session.user.id) return;
          const c = await sb.rpc('start_conversation', { autre: x.id }); if (c.error) return alert(c.error.message);
          conv = { conversation_id: c.data, autre_id: x.id, autre_nom: x.full_name, autre_avatar: x.avatar_url }; tab = 'messages'; sous = null;
        } else if (SECTIONS[cible]) { tab = 'plus'; sous = cible; } else { tab = cible; sous = null; }
        afficher(); } }, txt(x) + (cible === 'membre' ? '  ·  Écrire' : ''))));
    });
    if (!total) zone.append(h('p', { className: 'vide' }, 'Aucun résultat.'));
  }
  box.append(champ, zone); return box;
}

// ---------- Partage / invitation ----------
async function partager(titre, texte) {
  const url = location.origin + location.pathname;
  if (navigator.share) { try { await navigator.share({ title: titre, text: texte, url }); } catch (_) {} }
  else { try { await navigator.clipboard.writeText(texte + ' ' + url); alert('Lien copié. Collez-le dans la discussion de votre choix.'); } catch (_) { prompt('Copiez ce lien :', url); } }
}
async function vueInviter() {
  const box = h('div', {}, retour('Inviter à installer l’application'));
  const url = location.origin + location.pathname;
  const texte = 'Rejoins MNA Connect, le réseau de la Nouvelle Alliance ! Ouvre ce lien et installe l’application sur ton téléphone :';
  const lien = (nom, href) => h('a', { className: 'btn', href, target: '_blank', rel: 'noopener' }, nom);
  box.append(h('div', { className: 'card' },
    h('p', {}, 'Appuyez sur le bouton : votre téléphone propose WhatsApp, Telegram, Facebook, TikTok et vos autres applications. Choisissez-en une, puis la personne. Elle n’a qu’à ouvrir le lien et installer l’application.'),
    h('button', { className: 'btn primaire', style: 'width:100%', onclick: () => partager('MNA Connect', texte) }, '📤 Envoyer l’invitation')),
    h('div', { className: 'card' }, h('p', { className: 'meta' }, 'Si le bouton ne propose rien, utilisez directement :'),
      h('div', { className: 'actions', style: 'flex-wrap:wrap' },
        lien('WhatsApp', 'https://wa.me/?text=' + encodeURIComponent(texte + ' ' + url)),
        lien('Telegram', 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(texte)),
        lien('Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url)),
        h('button', { className: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(url); alert('Lien copié.'); } catch (_) { prompt('Copiez ce lien :', url); } } }, 'Copier le lien'))));
  return box;
}

// ---------- Méditation du jour ----------
async function vueMeditations() {
  const box = h('div', {}, retour('Méditation du jour'));
  if (can('meditations')) box.append(formulaire('Nouvelle méditation', 'meditations', [
    { k: 'title', label: 'Titre', requis: 1 }, { k: 'verse', label: 'Verset ou référence biblique' },
    { k: 'for_date', label: 'Date de publication', type: 'date' }, { k: 'body', label: 'Méditation', type: 'textarea', requis: 1 }]));
  const aujourdhui = new Date().toLocaleDateString('en-CA');
  const { data, error } = await sb.from('meditations').select('*').lte('for_date', aujourdhui).order('for_date', { ascending: false }).order('created_at', { ascending: false }).limit(60);
  if (error) return box.append(h('p', { className: 'erreur' }, error.message)), box;
  if (!data.length) box.append(h('p', { className: 'vide' }, 'La méditation du jour sera publiée ici par la direction.'));
  data.forEach(m => box.append(h('article', { className: 'card' + (m.for_date === aujourdhui ? ' epingle' : '') },
    h('div', { className: 'ligne' }, h('div', { className: 'meta' }, (m.for_date === aujourdhui ? 'Aujourd’hui · ' : '') + new Date(m.for_date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })), supprimer('meditations', m.id)),
    h('h3', { style: 'margin:.3rem 0' }, m.title), m.verse ? h('p', { className: 'meta', style: 'font-style:italic' }, m.verse) : null,
    h('p', { style: 'white-space:pre-wrap' }, m.body),
    h('div', { className: 'actions' }, h('button', { onclick: () => partager('Méditation du jour', m.title + ' — ' + (m.verse || '')) }, '↗️ Partager')))));
  return box;
}

// ---------- Publications enregistrées ----------
async function vueEnregistres() {
  const box = h('div', {}, retour('Publications enregistrées'));
  const { data, error } = await sb.from('saved_posts').select('post_id,posts(id,content,created_at,media_url,profiles!posts_author_id_fkey(full_name,avatar_url))').order('created_at', { ascending: false });
  if (error) return box.append(h('p', { className: 'erreur' }, error.message)), box;
  const liste = (data || []).filter(x => x.posts);
  if (!liste.length) box.append(h('p', { className: 'vide' }, 'Rien d’enregistré. Appuyez sur 📑 sous une publication pour la retrouver ici.'));
  const chemins = liste.map(x => x.posts.media_url).filter(Boolean), urls = {};
  if (chemins.length) { const { data: sg } = await sb.storage.from('post-media').createSignedUrls(chemins, 3600); (sg || []).forEach(x => { if (x.signedUrl) urls[x.path] = x.signedUrl; }); }
  liste.forEach(({ posts: p }) => box.append(h('article', { className: 'card' },
    h('div', { className: 'ligne' }, h('div', { className: 'qui' }, av(p.profiles?.avatar_url, p.profiles?.full_name, 36), h('div', {}, h('div', { className: 'auteur' }, p.profiles?.full_name || 'Membre'), h('div', { className: 'meta' }, quand(p.created_at)))),
      h('button', { className: 'btn lien', onclick: async () => { await sb.from('saved_posts').delete().eq('post_id', p.id).eq('user_id', session.user.id); afficher(); } }, 'Retirer')),
    p.content ? h('p', { style: 'white-space:pre-wrap' }, p.content) : null,
    urls[p.media_url] ? h('img', { src: urls[p.media_url], className: 'photo', alt: '', loading: 'lazy', onclick: () => window.open(urls[p.media_url], '_blank') }) : null)));
  return box;
}

// ---------- Recadrage de la photo de profil ----------
function rogner(file) {
  return new Promise(async resolve => {
    let bmp; try { bmp = await createImageBitmap(file); } catch (_) { alert('Image non lisible. Essayez une photo JPEG ou PNG.'); return resolve(null); }
    const T = 300;
    let s = Math.max(T / bmp.width, T / bmp.height); const min = s; let ox = (T - bmp.width * s) / 2, oy = (T - bmp.height * s) / 2;
    const cv = h('canvas', { width: T, height: T, className: 'rogne-cv' }), ctx = cv.getContext('2d');
    const curseur = h('input', { type: 'range', min: 1, max: 4, step: .01, value: 1 });
    const dessiner = () => { ox = Math.min(0, Math.max(T - bmp.width * s, ox)); oy = Math.min(0, Math.max(T - bmp.height * s, oy)); ctx.clearRect(0, 0, T, T); ctx.drawImage(bmp, ox, oy, bmp.width * s, bmp.height * s); };
    const zoom = ns => { ns = Math.min(min * 4, Math.max(min, ns)); const c = T / 2; ox = c - (c - ox) * ns / s; oy = c - (c - oy) * ns / s; s = ns; curseur.value = s / min; dessiner(); };
    curseur.oninput = () => zoom(min * Number(curseur.value));
    const pts = new Map(); let d0 = 0;
    cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); } };
    cv.onpointermove = e => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (d0) zoom(s * d / d0); d0 = d; }
      else { ox += e.clientX - prev[0]; oy += e.clientY - prev[1]; dessiner(); }
    };
    cv.onpointerup = cv.onpointercancel = e => { pts.delete(e.pointerId); d0 = 0; };
    cv.onwheel = e => { e.preventDefault(); zoom(s * (e.deltaY < 0 ? 1.08 : .93)); };
    const fin = v => { modale.remove(); resolve(v); };
    const ok = h('button', { className: 'btn primaire' }, 'Valider');
    ok.onclick = () => { const o = document.createElement('canvas'); o.width = o.height = 360; o.getContext('2d').drawImage(cv, 0, 0, T, T, 0, 0, 360, 360); o.toBlob(b => fin(b), 'image/jpeg', .9); };
    const modale = h('div', { className: 'modale' }, h('div', { className: 'rogne' }, h('h3', {}, 'Cadrez votre photo'),
      h('p', { className: 'meta' }, 'Déplacez l’image avec le doigt. Zoomez avec deux doigts ou avec le curseur. La partie dans le cercle sera visible.'),
      h('div', { className: 'rogne-zone' }, cv, h('div', { className: 'rogne-masque' })), curseur,
      h('div', { className: 'actions', style: 'justify-content:flex-end' }, h('button', { className: 'btn', onclick: () => fin(null) }, 'Annuler'), ok)));
    document.body.append(modale); dessiner();
  });
}

// ---------- Notifications : préférences ----------
const KINDS_NOTIF = [['annonce', 'Annonces'], ['evenement', 'Événements'], ['enseignement', 'Enseignements'], ['meditation', 'Méditation du jour'], ['video', 'Vidéos et directs'], ['commentaire', 'Commentaires sur mes publications'], ['reaction', 'Réactions à mes publications'], ['mention', 'Quand on m’identifie'], ['priere', 'Mur de prière (prières et commentaires)']];
async function prefsNotif() {
  const { data } = await sb.from('notif_prefs').select('muted').eq('user_id', session.user.id).maybeSingle();
  const muted = new Set(data?.muted || []);
  const bloc = h('div', { className: 'com' }, h('h3', {}, 'Mes notifications'), h('p', { className: 'meta' }, 'Cochez ce que vous voulez recevoir.'));
  KINDS_NOTIF.forEach(([k, l]) => {
    const c = h('input', { type: 'checkbox', checked: !muted.has(k) });
    c.onchange = async () => { c.checked ? muted.delete(k) : muted.add(k); await sb.from('notif_prefs').upsert({ user_id: session.user.id, muted: [...muted] }); };
    bloc.append(h('label', { className: 'check', style: 'margin:.35rem 0' }, c, l));
  });
  return bloc;
}

// ---------- Accueil : Ma journée, direct, mur de prière, communauté, événements ----------
const ouvrir = (sec, extra = {}) => { tab = 'plus'; sous = sec; conv = null; Object.assign(window.__nav = window.__nav || {}, extra); afficher(); };
const jourLocal = d => new Date(d).toLocaleDateString('en-CA');
function serieEnCours(dates) {
  const s = new Set(dates.map(jourLocal)); let n = 0; const d = new Date();
  if (!s.has(jourLocal(d))) d.setDate(d.getDate() - 1);
  while (s.has(jourLocal(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function prochaineSession(sessions, faites, parSerie) {
  // première session non terminée de chaque parcours commencé ; disponible si la précédente a été terminée un jour antérieur
  const auj = jourLocal(new Date()), res = [];
  parSerie.forEach(([sid, titre, jours]) => {
    const liste = sessions.filter(x => x.series_id === sid).sort((a, b) => a.day_number - b.day_number);
    const suiv = liste.find(x => !faites.has(x.id)); if (!suiv) return;
    const prec = liste[liste.indexOf(suiv) - 1];
    const dispo = !prec || jourLocal(faites.get(prec.id)) < auj || admin();
    res.push({ sid, titre, jours, suiv, fait: liste.indexOf(suiv), dispo });
  });
  return res;
}
async function accueilHaut() {
  const haut = h('div'), me = session.user.id, jour = jourLocal(new Date());
  const prenom = (profile.full_name || '').trim().split(' ')[0] || 'cher membre';
  haut.append(h('h2', { style: 'margin:.2rem 0 .8rem' }, `Bonjour, ${prenom} 👋`));
  sb.from('user_activity').upsert({ user_id: me, day: jour }, { onConflict: 'user_id,day', ignoreDuplicates: true });
  const [med, ms, mfaits, live, evts, cpt, mur] = await Promise.all([
    sb.from('meditations').select('id,title,verse,body,for_date').lte('for_date', jour).order('for_date', { ascending: false }).limit(1),
    sb.from('member_series').select('series_id,series(title,days,active)'),
    sb.from('member_sessions').select('session_id,completed_at').order('completed_at', { ascending: false }).limit(400),
    sb.from('videos').select('id,title,youtube_id').eq('is_live', true).limit(1),
    sb.from('events').select('id,title,starts_at,location').is('church_id', null).gte('starts_at', new Date().toISOString()).order('starts_at').limit(3),
    sb.rpc('compteurs_communaute'),
    sb.from('prayer_requests').select('id,content,kind,profiles!prayer_requests_author_id_fkey(full_name)').eq('visibility', 'public').order('created_at', { ascending: false }).limit(2)]);
  const faites = new Map((mfaits.data || []).map(x => [x.session_id, x.completed_at]));
  const parSerie = (ms.data || []).filter(x => x.series?.active).map(x => [x.series_id, x.series.title, x.series.days]);
  const ids = parSerie.map(x => x[0]);
  const { data: sessions } = ids.length ? await sb.from('sessions').select('id,series_id,day_number,title').in('series_id', ids) : { data: [] };
  const aVenir = prochaineSession(sessions || [], faites, parSerie);
  const serie = serieEnCours([...faites.values()]), faitAuj = [...faites.values()].some(d => jourLocal(d) === jour);

  // MA JOURNÉE
  const m = med.data?.[0], carte = h('div', { className: 'card journee' }, h('h3', {}, '🌅 Ma journée'));
  carte.append(m ? h('div', { className: 'bloc' }, h('div', { className: 'meta' }, '📖 Pensée du jour'), h('div', { className: 'auteur' }, m.title), m.verse ? h('div', { className: 'meta', style: 'font-style:italic' }, m.verse) : null,
      h('p', {}, m.body.length > 140 ? m.body.slice(0, 140) + '…' : m.body), h('button', { className: 'btn', onclick: () => ouvrir('meditations') }, 'Lire'))
    : h('div', { className: 'bloc meta' }, '📖 La pensée du jour sera publiée par la direction.'));
  const s1 = aVenir[0];
  carte.append(h('div', { className: 'bloc' }, h('div', { className: 'meta' }, '🧠 5 minutes avec Christ'),
    s1 ? h('div', {}, h('div', { className: 'auteur' }, `${s1.titre} · jour ${s1.suiv.day_number}/${s1.jours}`), h('div', { className: 'meta' }, s1.suiv.title),
        s1.dispo ? h('button', { className: 'btn primaire', onclick: () => { sessionOuverte = s1.suiv.id; serieOuverte = null; ouvrir('parcours'); } }, 'Commencer la session')
          : h('p', { className: 'meta' }, '✅ Session du jour terminée. La suivante sera disponible demain.'))
      : ids.length ? h('p', {}, '🎉 Vous avez terminé vos parcours. Bravo !') : h('p', {}, 'Choisissez un parcours de quelques jours pour prendre un rendez-vous quotidien avec Christ.'),
    !s1 ? h('button', { className: 'btn', onclick: () => { serieOuverte = null; sessionOuverte = null; ouvrir('parcours'); } }, ids.length ? 'Voir les parcours' : 'Choisir un parcours') : null));
  carte.append(h('div', { className: 'bloc' }, h('div', { className: 'auteur' }, `Votre série actuelle : ${serie} jour${serie > 1 ? 's' : ''} ${serie ? '🔥' : ''}`), serie && !faitAuj ? h('div', { className: 'meta' }, 'Terminez une session aujourd’hui pour la prolonger.') : null));
  haut.append(carte);

  // DIRECT
  const lv = live.data?.[0];
  if (lv) haut.append(h('div', { className: 'card epingle' }, h('div', { className: 'ligne' }, h('span', { className: 'direct' }, '🔴 EN DIRECT'), h('button', { className: 'btn primaire', onclick: () => ouvrir('videos') }, 'Rejoindre')), h('div', { className: 'auteur', style: 'margin-top:.4rem' }, lv.title)));

  // MUR DE PRIÈRE
  const mu = mur.data || [];
  if (mu.length) haut.append(h('div', { className: 'card' }, h('div', { className: 'ligne' }, h('h3', {}, '🙏 Mur de prière'), h('button', { className: 'btn lien', onclick: () => ouvrir('priere') }, 'Voir tout')),
    ...mu.map(r => h('div', { className: 'com' }, h('div', { className: 'meta' }, (r.kind === 'temoignage' ? '🎉 ' : '🙏 ') + (r.profiles?.full_name || 'Membre')), h('div', {}, r.content.length > 110 ? r.content.slice(0, 110) + '…' : r.content)))));

  // COMMUNAUTÉ
  const c = Object.fromEntries((cpt.data || []).map(x => [x.cle, Number(x.n)]));
  if (c.membres) haut.append(h('div', { className: 'card' }, h('h3', {}, '🌍 Ce qui se passe dans la communauté'), h('div', { className: 'kpis' },
    ...[[Math.max(enLigne.size, 1), 'en ligne maintenant'], [c.actifs_aujourdhui, 'actifs aujourd’hui'], [c.prieres, 'prières faites'], [c.demandes, 'demandes de prière (30 j)'], [c.temoignages, 'témoignages (30 j)'], [c.sessions_aujourdhui, 'sessions terminées aujourd’hui'], [c.membres, 'membres'], [c.assemblees, 'assemblées']]
      .map(([n, l]) => h('div', { className: 'kpi' }, h('b', {}, String(n ?? 0)), h('span', {}, l))))));

  // PROCHAINS ÉVÉNEMENTS
  if (evts.data?.length) haut.append(h('div', { className: 'card' }, h('div', { className: 'ligne' }, h('h3', {}, '📅 Prochains événements'), h('button', { className: 'btn lien', onclick: () => ouvrir('agenda') }, 'Agenda')),
    ...evts.data.map(e => h('div', { className: 'com' }, h('div', { className: 'auteur' }, e.title), h('div', { className: 'meta' }, new Date(e.starts_at).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + (e.location ? ' · ' + e.location : ''))))));
  haut.append(h('h3', { style: 'margin:.6rem 0' }, '📰 Fil d’actualités'));
  return haut;
}

// ---------- Parcours « 5 minutes avec Christ » ----------
async function vueParcours() {
  if (sessionOuverte) return vueSession();
  if (serieOuverte) return vueSerie();
  const box = h('div', {}, retour('Mes parcours'));
  if (can('parcours')) box.append(formulaire('Nouveau parcours (7, 14, 30, 40 jours…)', 'series', [
    { k: 'title', label: 'Titre du parcours', requis: 1 }, { k: 'description', label: 'Description', type: 'textarea' }, { k: 'days', label: 'Nombre de jours', type: 'number', requis: 1 }]));
  const [{ data: ser }, { data: ms }, { data: sess }, { data: fa }] = await Promise.all([
    sb.from('series').select('*').order('created_at', { ascending: false }), sb.from('member_series').select('series_id'),
    sb.from('sessions').select('id,series_id'), sb.from('member_sessions').select('session_id,completed_at')]);
  const faites = new Map((fa || []).map(x => [x.session_id, x.completed_at])), commence = new Set((ms || []).map(x => x.series_id));
  const serie = serieEnCours([...faites.values()]);
  box.append(h('div', { className: 'card' }, h('div', { className: 'auteur' }, `Votre série actuelle : ${serie} jour${serie > 1 ? 's' : ''} ${serie ? '🔥' : ''}`),
    h('div', { className: 'meta' }, `${faites.size} session${faites.size > 1 ? 's' : ''} terminée${faites.size > 1 ? 's' : ''} · une session par jour`)));
  if (!ser?.length) box.append(h('p', { className: 'vide' }, 'Les parcours seront publiés par la direction.'));
  (ser || []).forEach(sr => {
    const mes = (sess || []).filter(x => x.series_id === sr.id), k = mes.filter(x => faites.has(x.id)).length;
    box.append(h('article', { className: 'card' + (sr.active ? '' : ' inactif') }, h('div', { className: 'ligne' }, h('div', {}, h('div', { className: 'auteur' }, sr.title), h('div', { className: 'meta' }, `${sr.days} jours · ${mes.length} session(s) publiée(s)${sr.active ? '' : ' · désactivé'}`)), supprimer('series', sr.id)),
      sr.description ? h('p', {}, sr.description) : null,
      mes.length ? h('div', { className: 'meta' }, `Progression : ${Math.round(100 * k / mes.length)} % (${k}/${mes.length})`) : null,
      h('div', { className: 'actions' }, h('button', { className: 'btn primaire', onclick: async () => { if (!commence.has(sr.id)) await sb.from('member_series').insert({ series_id: sr.id }); serieOuverte = sr; afficher(); } }, commence.has(sr.id) ? 'Continuer' : 'Commencer'),
        can('parcours') ? h('button', { className: 'btn', onclick: async () => { await sb.from('series').update({ active: !sr.active }).eq('id', sr.id); afficher(); } }, sr.active ? 'Désactiver' : 'Activer') : null)));
  });
  return box;
}
async function vueSerie() {
  const sr = serieOuverte, box = h('div', {}, h('div', { className: 'qui', style: 'margin-bottom:.8rem' }, h('button', { className: 'btn lien', onclick: () => { serieOuverte = null; afficher(); } }, '‹ Parcours'), h('h2', {}, sr.title)));
  if (can('parcours')) box.append(formulaire('Ajouter une session (un jour du parcours)', 'sessions', [
    { k: 'day_number', label: 'Numéro du jour (1, 2, 3…)', type: 'number', requis: 1 }, { k: 'title', label: 'Titre', requis: 1 }, { k: 'verse', label: 'Passage biblique (référence ou texte)' },
    { k: 'media_kind', label: 'Contenu', type: 'select', options: [['aucun', 'Aucun média'], ['video', 'Vidéo YouTube'], ['audio', 'Audio (lien direct)']] }, { k: 'media_url', label: 'Lien de la vidéo ou de l’audio', type: 'url' },
    { k: 'idea', label: 'Idée principale', type: 'textarea' }, { k: 'question', label: 'Question de réflexion', type: 'textarea' }, { k: 'prayer', label: 'Prière', type: 'textarea' }, { k: 'challenge', label: 'Défi du jour (facultatif)' }], { series_id: sr.id }));
  const [{ data: ss }, { data: fa }] = await Promise.all([sb.from('sessions').select('id,day_number,title').eq('series_id', sr.id).order('day_number'), sb.from('member_sessions').select('session_id,completed_at')]);
  const faites = new Map((fa || []).map(x => [x.session_id, x.completed_at])), auj = jourLocal(new Date());
  if (!ss?.length) box.append(h('p', { className: 'vide' }, 'Les sessions de ce parcours arrivent bientôt.'));
  (ss || []).forEach((x, i) => {
    const prec = ss[i - 1], fait = faites.has(x.id), dispo = admin() || can('parcours') || fait || !prec || (faites.has(prec.id) && jourLocal(faites.get(prec.id)) < auj);
    box.append(h('div', { className: 'card ligne' + (dispo ? '' : ' inactif'), style: dispo ? 'cursor:pointer' : '', onclick: () => { if (dispo) { sessionOuverte = x.id; afficher(); } } },
      h('div', {}, h('div', { className: 'auteur' }, `Jour ${x.day_number} · ${x.title}`), h('div', { className: 'meta' }, fait ? '✅ Terminée' : dispo ? 'Disponible' : '🔒 Disponible après la session précédente (un jour à la fois)')), supprimer('sessions', x.id)));
  });
  return box;
}
async function vueSession() {
  const back = () => { sessionOuverte = null; afficher(); };
  const box = h('div', {}, h('button', { className: 'btn lien', onclick: back }, '‹ Retour'));
  const [{ data: x }, { data: fait }] = await Promise.all([sb.from('sessions').select('*').eq('id', sessionOuverte).maybeSingle(), sb.from('member_sessions').select('completed_at,challenge_done').eq('session_id', sessionOuverte).maybeSingle()]);
  if (!x) return box.append(h('p', { className: 'vide' }, 'Session introuvable.')), box;
  const bloc = (t, c) => c ? h('div', { className: 'card' }, h('div', { className: 'meta' }, t), h('p', { style: 'white-space:pre-wrap;margin:.3rem 0' }, c)) : null;
  box.append(h('h2', { style: 'margin:.6rem 0' }, `Jour ${x.day_number} · ${x.title}`), bloc('📖 Passage biblique', x.verse));
  if (x.media_kind === 'video' && ytId(x.media_url)) box.append(h('div', { className: 'card' }, h('div', { className: 'meta' }, '🎥 Courte vidéo'), vignette(ytId(x.media_url))));
  else if (x.media_kind === 'audio' && x.media_url) box.append(h('div', { className: 'card' }, h('div', { className: 'meta' }, '🎧 À écouter'), h('audio', { controls: true, preload: 'none', src: x.media_url, style: 'width:100%' })));
  box.append(bloc('🧠 Idée principale', x.idea), bloc('❓ Question de réflexion', x.question), bloc('🙏 Prière', x.prayer));
  const defi = x.challenge ? h('input', { type: 'checkbox', checked: !!fait?.challenge_done, disabled: !!fait }) : null;
  if (x.challenge) box.append(h('div', { className: 'card' }, h('div', { className: 'meta' }, '🎯 Défi du jour'), h('p', {}, x.challenge), h('label', { className: 'check' }, defi, 'J’ai accompli ce défi')));
  const fin = h('button', { className: 'btn primaire', style: 'width:100%' }, fait ? '✅ Session terminée' : 'Session terminée ✓');
  fin.disabled = !!fait;
  fin.onclick = async () => {
    fin.disabled = true;
    const { error } = await sb.from('member_sessions').insert({ session_id: x.id, challenge_done: !!defi?.checked });
    if (error) { alert(error.message); fin.disabled = false; return; }
    await sb.from('member_series').upsert({ series_id: x.series_id }, { onConflict: 'user_id,series_id', ignoreDuplicates: true });
    const { data: fa } = await sb.from('member_sessions').select('completed_at'); const n = serieEnCours((fa || []).map(d => d.completed_at));
    toast('Session terminée ✓', `Votre série actuelle : ${n} jour${n > 1 ? 's' : ''} 🔥`); back();
  };
  box.append(fin);
  return box;
}

// ---------- Mon assemblée ----------
async function vueMonAssemblee() {
  const box = h('div', {}, retour('Mon assemblée'));
  if (!profile.church_id) return box.append(h('div', { className: 'card' }, h('p', {}, 'Choisissez votre assemblée pour accéder à son espace.'),
    h('button', { className: 'btn primaire', onclick: () => { sous = 'assemblees'; afficher(); } }, 'Choisir mon assemblée'))), box;
  const cid = profile.church_id;
  const [{ data: c }, { data: an }, { data: ev }, { data: mb }, { data: rs }] = await Promise.all([
    sb.from('churches').select('*').eq('id', cid).single(),
    sb.from('announcements').select('*').eq('church_id', cid).order('created_at', { ascending: false }).limit(10),
    sb.from('events').select('*').eq('church_id', cid).gte('starts_at', new Date(Date.now() - 864e5).toISOString()).order('starts_at').limit(10),
    sb.from('profiles').select('id,full_name,avatar_url').eq('church_id', cid).eq('status', 'actif').limit(40),
    sb.from('church_admins').select('user_id').eq('church_id', cid)]);
  const gere = can('annonces') || can('agenda') || (rs || []).some(r => r.user_id === session.user.id);
  box.append(h('div', { className: 'card' }, h('h3', {}, c?.name || 'Mon assemblée'), h('div', { className: 'meta' }, [c?.city, c?.country].filter(Boolean).join(', ')),
    c?.address ? h('p', {}, h('a', { href: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.address + ' ' + (c.city || '')), target: '_blank', rel: 'noopener' }, '📍 ' + c.address)) : null,
    c?.service_times ? h('p', {}, '🕒 ' + c.service_times) : null, c?.leader_name ? h('p', { className: 'meta' }, 'Responsable : ' + c.leader_name) : null, c?.description ? h('p', {}, c.description) : null));
  if (gere) {
    box.append(formulaire('Publier une annonce locale', 'announcements', [{ k: 'title', label: 'Titre', requis: 1 }, { k: 'body', label: 'Message', type: 'textarea' }, { k: 'category', label: 'Type', type: 'select', options: CAT_ANN }], { church_id: cid }));
    box.append(formulaire('Ajouter au programme', 'events', [{ k: 'title', label: 'Titre', requis: 1 }, { k: 'category', label: 'Type', type: 'select', options: CAT_EVT }, { k: 'starts_at', label: 'Date et heure', type: 'datetime-local', requis: 1 }, { k: 'location', label: 'Lieu' }, { k: 'description', label: 'Description', type: 'textarea' }], { church_id: cid }));
  }
  box.append(h('div', { className: 'card' }, h('h3', {}, '📢 Annonces locales'), ...(an?.length ? an.map(a => h('div', { className: 'com' }, h('div', { className: 'auteur' }, a.title), h('div', { className: 'meta' }, quand(a.created_at)), a.body ? h('p', {}, a.body) : null, gere ? supprimer2('announcements', a.id) : null)) : [h('p', { className: 'meta' }, 'Aucune annonce locale.')])));
  box.append(h('div', { className: 'card' }, h('h3', {}, '📅 Programme'), ...(ev?.length ? ev.map(e => h('div', { className: 'com' }, h('div', { className: 'auteur' }, e.title), h('div', { className: 'meta' }, new Date(e.starts_at).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + (e.location ? ' · ' + e.location : '')), gere ? supprimer2('events', e.id) : null)) : [h('p', { className: 'meta' }, 'Aucun événement prévu.')])));
  box.append(h('div', { className: 'card' }, h('h3', {}, `👥 Membres (${mb?.length || 0})`), h('div', { className: 'qui', style: 'flex-wrap:wrap' }, ...(mb || []).map(u => h('span', { title: u.full_name }, av(u.avatar_url, u.full_name, 40))))));
  return box;
}
const supprimer2 = (table, id) => h('button', { className: 'btn lien', onclick: async () => { if (confirm('Supprimer ?')) { await sb.from(table).delete().eq('id', id); afficher(); } } }, 'Supprimer');
async function carteRespAssemblees() {
  const [{ data: eg }, { data: us }, { data: ca }] = await Promise.all([sb.from('churches').select('id,name').order('name'), sb.from('profiles').select('id,full_name').eq('status', 'actif').order('full_name').limit(300), sb.from('church_admins').select('church_id,user_id')]);
  const carte = h('div', { className: 'card' }, h('h3', {}, 'Responsables d’assemblée'), h('p', { className: 'meta' }, 'Un responsable local peut publier annonces et programme pour son assemblée uniquement.'));
  const nom = id => (us || []).find(u => u.id === id)?.full_name || 'Membre';
  const sa = h('select', {}, ...(eg || []).map(c => h('option', { value: c.id }, c.name))), sm = h('select', {}, ...(us || []).map(u => h('option', { value: u.id }, u.full_name || 'Sans nom')));
  carte.append(sa, sm, h('button', { className: 'btn primaire', onclick: async () => { const { error } = await sb.from('church_admins').insert({ church_id: sa.value, user_id: sm.value }); if (error) alert(error.message); else afficher(); } }, 'Nommer responsable'));
  (ca || []).forEach(r => carte.append(h('div', { className: 'ligne com' }, h('span', {}, `${nom(r.user_id)} · ${(eg || []).find(c => c.id === r.church_id)?.name || ''}`),
    h('button', { className: 'btn lien', onclick: async () => { await sb.from('church_admins').delete().eq('church_id', r.church_id).eq('user_id', r.user_id); afficher(); } }, 'Retirer'))));
  return carte;
}

async function vueAdmin() {
  const box = h('div', {}, retour('Administration'));
  const compte = t => sb.from(t).select('id', { count: 'exact', head: true }).then(r => r.count ?? 0);
  const [nu, np, nc, ng, ...nx] = await Promise.all(['profiles', 'posts', 'comments', 'groups', 'announcements', 'videos', 'teachings', 'events'].map(compte));
  box.append(h('div', { className: 'card' }, h('h3', {}, 'Statistiques'),
    h('p', {}, `${nu} membres · ${np} publications · ${nc} commentaires · ${ng} communautés · ${nx.reduce((a, b) => a + b, 0)} contenus (annonces, vidéos, enseignements, événements)`)));
  const nom = h('input', { placeholder: 'Nom de la communauté' });
  const desc = h('textarea', { rows: 2, placeholder: 'Description' });
  const pol = h('select', {}, h('option', { value: 'ouvert' }, 'Ouverte à tous'),
    h('option', { value: 'sur_demande' }, 'Sur demande'), h('option', { value: 'ferme' }, 'Sur invitation'));
  const msg = h('p', { className: 'erreur' });
  const cree = h('button', { className: 'btn primaire' }, 'Créer la communauté');
  cree.onclick = async () => {
    msg.textContent = '';
    if (!nom.value.trim()) return;
    const { data, error } = await sb.from('groups').insert({ name: nom.value.trim(), description: desc.value.trim(), join_policy: pol.value, created_by: session.user.id }).select().single();
    if (error) { msg.textContent = error.message; return; }
    await sb.from('group_members').insert({ group_id: data.id, user_id: session.user.id, member_role: 'moderateur', status: 'actif' });
    afficher();
  };
  box.append(h('div', { className: 'card' }, h('h3', {}, 'Nouvelle communauté'), nom, desc, pol, msg, cree));

  const { data: gs } = await sb.from('groups').select('id,name').order('name');
  const lg = h('div', { className: 'card' }, h('h3', {}, 'Communautés'));
  if (!gs?.length) lg.append(h('p', { className: 'meta' }, 'Aucune communauté créée.'));
  (gs || []).forEach(g => lg.append(h('div', { className: 'ligne' }, h('span', {}, g.name),
    h('button', { className: 'btn lien', onclick: async () => {
      if (confirm(`Supprimer « ${g.name} » et toutes ses publications ?`)) { await sb.from('groups').delete().eq('id', g.id); afficher(); }
    } }, 'Supprimer'))));
  box.append(lg);
  if (can('assemblees')) box.append(await carteRespAssemblees());

  if (admin() || can('moderer')) {
    const { data: us } = await sb.from('profiles').select('id,full_name,role,status').order('created_at');
    const { data: pr } = admin() ? await sb.from('admin_permissions').select('user_id,permission') : { data: [] };
    const droits = {}; (pr || []).forEach(x => { (droits[x.user_id] = droits[x.user_id] || new Set()).add(x.permission); });
    const lm = h('div', { className: 'card' }, h('h3', {}, `Membres (${us?.length || 0})`));
    if (admin()) lm.append(h('p', { className: 'meta' }, 'Touchez « Droits » pour nommer un administrateur délégué et choisir précisément ce qu’il peut faire. Vous accordez des droits parmi ceux que vous possédez.'));
    (us || []).forEach(u => {
      const soi = u.id === session.user.id, principal = u.role === 'admin', zone = h('div');
      const susp = soi || principal || !can('moderer') ? null : h('button', { className: 'btn lien', onclick: async () => {
        const { error } = await sb.from('profiles').update({ status: u.status === 'actif' ? 'suspendu' : 'actif' }).eq('id', u.id); if (error) alert(error.message); else afficher(); } }, u.status === 'actif' ? 'Suspendre' : 'Réactiver');
      const bDroits = admin() && !soi && !principal ? h('button', { className: 'btn', onclick: () => {
        if (zone.childElementCount) return zone.replaceChildren();
        const cases = PERMS.map(([k, l]) => { const c = h('input', { type: 'checkbox', checked: !!droits[u.id]?.has(k) }); return [k, c, h('label', { className: 'check' }, c, l)]; });
        const enr = h('button', { className: 'btn primaire' }, 'Enregistrer les droits');
        enr.onclick = async () => {
          const choisis = cases.filter(([, c]) => c.checked).map(([k]) => k);
          await sb.from('admin_permissions').delete().eq('user_id', u.id);
          if (choisis.length) { const r = await sb.from('admin_permissions').insert(choisis.map(permission => ({ user_id: u.id, permission }))); if (r.error) return alert(r.error.message); }
          const r2 = await sb.from('profiles').update({ role: choisis.length ? 'responsable' : 'membre' }).eq('id', u.id);
          if (r2.error) return alert(r2.error.message); afficher();
        };
        zone.append(h('div', { className: 'card' }, ...cases.map(x => x[2]), enr));
      } }, 'Droits') : null;
      const etiquette = principal ? 'Administrateur principal' : u.role === 'responsable' ? `Administrateur délégué (${droits[u.id]?.size ?? '…'} droit${(droits[u.id]?.size || 0) > 1 ? 's' : ''})` : 'Membre';
      lm.append(h('div', { className: 'com' }, h('div', { className: 'auteur' }, (u.full_name || 'Sans nom') + (u.status === 'suspendu' ? ' (suspendu)' : '')),
        h('div', { className: 'ligne' }, h('span', { className: 'meta' }, etiquette), h('span', {}, bDroits, susp)), zone));
    });
    box.append(lm);
  }
  return box;
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
// ---------- Son, bannières et accusés de livraison ----------
let canalGlobal = null, audioCtx = null, invitation = null; const noms = new Map();
const debloquerAudio = () => { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume?.(); } catch {} };
['click', 'pointerup', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, debloquerAudio, { passive: true }));
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); invitation = e; if (!session) afficher(); });
function bip() {
  navigator.vibrate?.([90, 40, 90]);
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  const jouer = () => [[880, 0], [1175, .14]].forEach(([f, t]) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain(), d = audioCtx.currentTime + t;
    o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(.0001, d); g.gain.exponentialRampToValueAtTime(.35, d + .02); g.gain.exponentialRampToValueAtTime(.0001, d + .24); o.start(d); o.stop(d + .26);
  });
  if (audioCtx.state === 'running') jouer(); else audioCtx.resume().then(jouer).catch(() => {});
}
function toast(titre, texte, action) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const t = h('div', { className: 'toast', onclick: () => { t.remove(); action?.(); } }, h('b', {}, titre), h('div', { className: 'coupe' }, texte));
  document.body.append(t); setTimeout(() => t.remove(), 5000);
}
const nomDe = async id => { if (!noms.has(id)) { const { data } = await sb.from('profiles').select('full_name').eq('id', id).maybeSingle(); noms.set(id, data?.full_name || 'Nouveau message'); } return noms.get(id); };
async function ouvrirConv(cid) {
  const { data } = await sb.rpc('mes_conversations'); const c = (data || []).find(x => x.conversation_id === cid);
  if (c) { conv = c; tab = 'messages'; sous = null; ecranContact = false; afficher(); }
}
function ouvrirCible(c) {
  if (!c || !session) return;
  if (c.conv) ouvrirConv(c.conv);
  else if (SECTIONS[c.tab]) { tab = 'plus'; sous = c.tab; conv = null; afficher(); }
  else { tab = c.tab || 'accueil'; conv = null; sous = null; ecranContact = false; afficher(); }
}
function demarrerEcoute() {
  if (canalGlobal || !session) return;
  const me = session.user.id;
  sb.rpc('marquer_livre');
  canalGlobal = sb.channel('ecoute-' + me)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async p => {
      const m = p.new; if (m.sender_id === me) return;
      sb.rpc('marquer_livre', { cid: m.conversation_id });
      if (conv?.conversation_id === m.conversation_id && tab === 'messages') return;
      majBadges(); if (tab === 'messages' && !conv) afficher();
      const { data: cm } = await sb.from('conversation_members').select('muted').eq('conversation_id', m.conversation_id).eq('user_id', me).maybeSingle();
      if (cm?.muted || document.hidden) return;
      bip(); toast(await nomDe(m.sender_id), resume(m), () => ouvrirConv(m.conversation_id));
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` }, p => {
      if (p.new.kind === 'message') return;
      majBadges(); if (!document.hidden) { bip(); toast(p.new.title, p.new.body || ''); }
    })
    .subscribe(st => { if (st === 'SUBSCRIBED') synchro(); });
  if (!window.__synchro) {
    window.__synchro = true;
    document.addEventListener('visibilitychange', () => { if (!document.hidden) synchro(); });
    window.addEventListener('online', synchro);
    setInterval(() => { if (!document.hidden) synchro(); }, 20000);
  }
}
let derniereSynchro = 0;
function synchro() {
  if (!session || Date.now() - derniereSynchro < 3000) return; derniereSynchro = Date.now();
  sb.rpc('marquer_livre'); majBadges();
  if (tab === 'messages' && !conv && !ecranContact) afficher();
}

// ---------- Notifications push (application fermée) ----------
const VAPID_PUBLIC = 'BPK5qK_h0xjUWtMBHi5ZzlUO6PiDMxo0yPayOvZjNVyr9sBDeqjx4mBRLliXiu4X-0vLlIcN7S3L4P72evPHXKQ';
const cleB64 = v => Uint8Array.from(atob(v.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - v.length % 4) % 4)), c => c.charCodeAt(0));
async function enregistrerAppareil() {
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleB64(VAPID_PUBLIC) });
  const j = sub.toJSON();
  const { error } = await sb.rpc('enregistrer_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
  if (error) throw error;
}
async function activerPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
    throw new Error('Notifications non prises en charge ici. Sur iPhone, installez d’abord l’application sur l’écran d’accueil.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications refusées. Autorisez-les dans les réglages du navigateur.');
  await enregistrerAppareil();
}
// À chaque connexion, l'appareil est rattaché au compte actuel (sans demande)
function majPushAuto() { if ('Notification' in window && 'PushManager' in window && Notification.permission === 'granted') enregistrerAppareil().catch(() => {}); }
const memoriserUid = uid => { if ('caches' in window) caches.open('mna-meta').then(c => c.put('uid', new Response(uid))).catch(() => {}); };
async function deconnexion() {
  try {
    const reg = await navigator.serviceWorker?.ready, sub = await reg?.pushManager?.getSubscription();
    if (sub) await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  } catch (_) {}
  memoriserUid(''); await sb.auth.signOut();
}

// ---------- Infos du contact (style WhatsApp) ----------
async function vueContact() {
  const cid = conv.conversation_id, autre = conv.autre_id, me = session.user.id;
  const retour2 = () => { ecranContact = false; afficher(); };
  const [{ data: p }, { data: tel }, { data: cmM }, { data: bl }] = await Promise.all([
    sb.from('profiles').select('full_name,avatar_url,bio,church_id,show_bio,last_seen_at,show_online').eq('id', autre).single(),
    sb.rpc('telephone_de', { uid: autre }),
    sb.from('conversation_members').select('muted,cleared_at').eq('conversation_id', cid).eq('user_id', me).single(),
    sb.from('blocks').select('blocked_id').eq('blocker_id', me).eq('blocked_id', autre).maybeSingle()]);
  const { data: eg } = p?.church_id ? await sb.from('churches').select('name,city').eq('id', p.church_id).single() : { data: null };
  const nom = p?.full_name || conv.autre_nom || 'Membre';
  const vu = p?.show_online === false ? null : p?.last_seen_at;
  const apres = q => cmM?.cleared_at ? q.gt('created_at', cmM.cleared_at) : q;
  const ligne = (icone, texte, onclick, extra) => h('button', { className: 'action-ligne' + (extra ? ' ' + extra : ''), onclick }, h('span', {}, icone), h('span', { style: 'flex:1;text-align:left' }, texte));
  const zoneRech = h('div'), zoneMed = h('div');

  const champRech = h('input', { type: 'search', placeholder: 'Rechercher un mot dans cette discussion' }), resRech = h('div');
  let t; champRech.oninput = () => { clearTimeout(t); t = setTimeout(async () => {
    const q = champRech.value.replace(/[%,()*\\]/g, ' ').trim(); resRech.replaceChildren(); if (q.length < 2) return;
    const { data } = await apres(sb.from('messages').select('content,created_at,sender_id').eq('conversation_id', cid).eq('kind', 'texte').is('deleted_at', null).ilike('content', `%${q}%`)).order('created_at', { ascending: false }).limit(30);
    if (!data?.length) return resRech.append(h('p', { className: 'meta' }, 'Aucun résultat.'));
    data.forEach(m => resRech.append(h('div', { className: 'com' }, h('div', { className: 'meta' }, (m.sender_id === me ? 'Vous' : nom) + ' · ' + quand(m.created_at)), h('div', {}, m.content))));
  }, 400); };
  const ouvrirRech = ligne('🔍', 'Rechercher dans la discussion', () => { if (zoneRech.childElementCount) return zoneRech.replaceChildren(); zoneRech.append(h('div', { className: 'card' }, champRech, resRech)); champRech.focus(); });

  const ouvrirMed = ligne('🖼️', 'Médias et documents', async () => {
    if (zoneMed.childElementCount) return zoneMed.replaceChildren();
    const { data } = await apres(sb.from('messages').select('id,kind,media_path,media_name,created_at').eq('conversation_id', cid).in('kind', ['image', 'video', 'fichier']).is('deleted_at', null)).order('created_at', { ascending: false }).limit(60);
    const grille = h('div', { className: 'grille-med' });
    if (!data?.length) grille.append(h('p', { className: 'meta' }, 'Aucun média partagé.'));
    (data || []).forEach(m => urlSignee('chat-media', m.media_path).then(u => { if (!u) return;
      grille.append(m.kind === 'image' ? h('img', { src: u, alt: '', loading: 'lazy', onclick: () => window.open(u, '_blank') })
        : h('a', { href: u, target: '_blank', rel: 'noopener', className: 'tuile' }, (m.kind === 'video' ? '🎥 ' : '📎 ') + (m.media_name || 'Fichier'))); }));
    zoneMed.append(h('div', { className: 'card' }, grille));
  });

  const sourdine = h('input', { type: 'checkbox', checked: !!cmM?.muted });
  sourdine.onchange = async () => { await sb.from('conversation_members').update({ muted: sourdine.checked }).eq('conversation_id', cid).eq('user_id', me); };

  const exporter = ligne('📤', 'Exporter la discussion', async () => {
    const { data } = await apres(sb.from('messages').select('*').eq('conversation_id', cid)).order('created_at').limit(3000);
    const txt = (data || []).map(m => `[${new Date(m.created_at).toLocaleString('fr-FR')}] ${m.sender_id === me ? (profile.full_name || 'Moi') : nom} : ${m.deleted_at ? '(message supprimé)' : resume(m)}`).join('\n');
    const a = h('a', { href: URL.createObjectURL(new Blob([txt], { type: 'text/plain' })), download: `Discussion avec ${nom}.txt` }); document.body.append(a); a.click(); a.remove();
  });
  const vider = ligne('🧹', 'Vider la discussion (pour moi)', async () => {
    if (!confirm('Vider cette discussion ? Les messages disparaîtront seulement de votre côté.')) return;
    await sb.rpc('vider_discussion', { cid }); retour2();
  });
  const bloquer = ligne('🚫', bl ? `Débloquer ${nom}` : `Bloquer ${nom}`, async () => {
    if (!bl && !confirm(`Bloquer ${nom} ? Cette personne ne pourra plus vous écrire.`)) return;
    if (bl) await sb.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', autre);
    else await sb.from('blocks').insert({ blocked_id: autre });
    afficher();
  }, 'danger');
  const signal = ligne('🚩', `Signaler ${nom}`, () => signaler('user', autre), 'danger');

  const infos = [p?.show_bio !== false && p?.bio ? h('p', {}, p.bio) : null,
    eg ? h('p', { className: 'meta' }, '⛪ ' + eg.name + (eg.city ? ' · ' + eg.city : '')) : null,
    tel ? h('p', {}, '📞 ' + tel) : null].filter(Boolean);

  return h('div', { className: 'contact' },
    h('div', { className: 'chat-tete' }, h('button', { className: 'retour', onclick: retour2 }, '‹'), h('div', { style: 'font-weight:600' }, 'Infos du contact')),
    h('div', { className: 'contact-corps' },
      h('div', { className: 'contact-haut' }, av(p?.avatar_url, nom, 120), h('h2', {}, nom),
        h('div', { className: 'meta' }, enLigne.has(autre) ? 'en ligne' : vu ? 'vu ' + jourHeure(vu) : '')),
      infos.length ? h('div', { className: 'card' }, ...infos) : null,
      h('div', { className: 'card actions-liste' }, ouvrirRech, zoneRech, ouvrirMed, zoneMed,
        h('label', { className: 'action-ligne' }, h('span', {}, '🔕'), h('span', { style: 'flex:1' }, 'Mettre en sourdine'), sourdine),
        exporter, vider),
      h('div', { className: 'card actions-liste' }, bloquer, signal)));
}

if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (e.data?.type === 'ouvrir') ouvrirCible(e.data); });

charger().then(() => {
  const q = new URLSearchParams(location.search).get('ouvrir');
  if (q) { try { ouvrirCible(JSON.parse(q)); } catch {} history.replaceState(null, '', location.pathname); }
});
