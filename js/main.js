const root = document.documentElement;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Écran d'arrivée : se retire de lui-même, ou au clic
const loader = $('.loader');
loader.addEventListener('animationend', e => e.target === loader && loader.remove());
loader.addEventListener('click', () => loader.remove());

// ---------- Langue FR / EN (le français est le texte de la page) ----------
const FR = {
  title: document.title,
  desc: $('meta[name="description"]').content,
  statusOpen: 'Ouvert en ce moment · jusqu’à\u00a02\u00a0h',
  statusClosed: 'Fermé · ouvre à 7 h',
  menuOpen: 'Ouvrir le menu',
  menuClose: 'Fermer le menu',
  mapTitle: 'Plan d’accès au Lamparo'
};
$$('[data-i18n]').forEach(el => FR[el.dataset.i18n] ??= el.innerHTML);
$$('[data-i18n-label]').forEach(el => FR[el.dataset.i18nLabel] ??= el.getAttribute('aria-label'));
$$('[data-i18n-alt]').forEach(el => FR[el.dataset.i18nAlt] ??= el.alt);
// contrôle : toute clé française doit avoir sa traduction
Object.keys(FR).forEach(k => k in I18N_EN || console.warn('Traduction anglaise manquante :', k));

let lang = 'fr';
const t = k => (lang === 'en' ? I18N_EN : FR)[k];
const langBtn = $('[data-lang-toggle]');

// Titres révélés mot par mot (les espaces insécables gardent « soir ? » ensemble)
const splitWords = el => {
  const words = el.textContent.trim().split(/ +/);
  el.textContent = '';
  words.forEach((w, i) => {
    const s = document.createElement('span');
    s.className = 'w';
    s.style.setProperty('--i', i);
    s.textContent = w;
    el.append(s, i < words.length - 1 ? ' ' : '');
  });
};
$$('.words').forEach(splitWords);

const setLang = l => {
  lang = l;
  root.lang = l;
  document.title = t('title');
  $('meta[name="description"]').content = t('desc');
  $$('[data-i18n]').forEach(el => {
    el.innerHTML = t(el.dataset.i18n);
    if (el.matches('.words')) splitWords(el);
  });
  $$('[data-i18n-label]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nLabel)));
  $$('[data-i18n-alt]').forEach(el => { el.alt = t(el.dataset.i18nAlt); });
  const other = l === 'en' ? 'fr' : 'en';
  langBtn.textContent = other.toUpperCase();
  langBtn.lang = other;
  langBtn.setAttribute('aria-label', other === 'en' ? 'English version' : 'Version française');
  burger.setAttribute('aria-label', t(nav.classList.contains('open') ? 'menuClose' : 'menuOpen'));
  const frame = $('#map iframe');
  if (frame) frame.title = t('mapTitle');
  updateStatus();
  renderFigures();
  moveInk();
  if (!reduce) $('main').animate([{ opacity: .35 }, { opacity: 1 }], { duration: 450, easing: 'ease-out' });
};
langBtn.addEventListener('click', () => setLang(lang === 'fr' ? 'en' : 'fr'));

// ---------- Thème clair / sombre (cercle qui s'ouvre depuis le bouton si le navigateur sait le faire) ----------
const themeBtn = $('[data-theme-toggle]');
const setTheme = th => {
  root.dataset.theme = th;
  themeBtn.setAttribute('aria-pressed', th === 'dark');
};
setTheme(root.dataset.theme);
themeBtn.addEventListener('click', () => {
  const next = () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  if (reduce || !document.startViewTransition) return next();
  const r = themeBtn.getBoundingClientRect();
  root.style.setProperty('--vx', r.left + r.width / 2 + 'px');
  root.style.setProperty('--vy', r.top + r.height / 2 + 'px');
  document.startViewTransition(next);
});

// ---------- En-tête, bouton retour en haut, parallaxe ----------
const header = $('.header');
const toTop = $('.to-top');
const layers = $$('[data-parallax]');
const parallax = () => {
  const vh = innerHeight;
  layers.forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / vh));
    el.style.setProperty('--py', (-p * r.height * (+el.dataset.parallax || .1)).toFixed(1) + 'px');
  });
};
let queued = false;
const onScroll = () => {
  header.classList.toggle('scrolled', scrollY > 40 || nav.classList.contains('open'));
  const max = root.scrollHeight - innerHeight;
  toTop.style.setProperty('--p', max > 0 ? (scrollY / max).toFixed(3) : 0);
  const far = scrollY > innerHeight * .8;
  toTop.classList.toggle('show', far);
  root.classList.toggle('far', far);
  if (!reduce) parallax();
  queued = false;
};
const requestScroll = () => { if (!queued) { queued = true; requestAnimationFrame(onScroll); } };
addEventListener('scroll', requestScroll, { passive: true });
addEventListener('resize', requestScroll);

// Menu téléphone
const burger = $('.burger');
const nav = $('#nav');
const setMenu = open => {
  nav.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', open);
  burger.setAttribute('aria-label', t(open ? 'menuClose' : 'menuOpen'));
  onScroll();
};
burger.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); burger.focus(); } });
onScroll();

// Lien du menu surligné selon la section à l'écran
const links = $$('.nav a');
const spy = new IntersectionObserver(entries => entries.forEach(e => {
  if (!e.isIntersecting) return;
  links.forEach(a => a.hash === '#' + e.target.id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'));
}), { rootMargin: '-50% 0px -50% 0px' });
$$('main > section').forEach(s => spy.observe(s));

// ---------- Ouvert / fermé, à l'heure de la Corse (7 h – 2 h tous les jours, à confirmer) ----------
const updateStatus = () => {
  const hour = +new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Paris' }).format(new Date());
  const open = hour >= 7 || hour < 2;
  $$('[data-status]').forEach(el => {
    el.textContent = t(open ? 'statusOpen' : 'statusClosed');
    el.classList.toggle('closed', !open);
  });
};
updateStatus();
setInterval(updateStatus, 60000);

// ---------- Chiffres clés qui défilent jusqu'à leur valeur ----------
const counters = $$('[data-count]');
const fmt = (el, v) => {
  const d = +el.dataset.decimals || 0;
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
    .format(v).replace(/ /g, ' '); // espace fine absente des polices
};
const renderFigures = () => counters.forEach(el => { if (!el.counting) el.textContent = fmt(el, +el.dataset.count); });
const countUp = el => {
  if (reduce) return;
  const end = +el.dataset.count, t0 = performance.now();
  el.counting = true;
  const step = now => {
    const k = Math.min((now - t0) / 1600, 1);
    el.textContent = fmt(el, end * (1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(step); else el.counting = false;
  };
  requestAnimationFrame(step);
};

// ---------- Onglets de la carte (flèches, Début et Fin au clavier) ----------
const tabs = $$('[role="tab"]');
const ink = $('.tab-ink');
const photo = $('.menu-photo');
const moveInk = () => {
  const tab = tabs.find(x => x.getAttribute('aria-selected') === 'true');
  ink.style.width = tab.offsetWidth + 'px';
  ink.style.height = tab.offsetHeight + 'px';
  ink.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`;
};
const showPhoto = src => {
  if (!src || photo.style.backgroundImage.includes(src)) return;
  const img = new Image();
  img.src = src;
  img.decode().then(() => {
    photo.style.backgroundImage = `url(${src})`;
    if (!reduce) photo.animate([{ opacity: .2, scale: 1.05 }, { opacity: 1, scale: 1 }], { duration: 700, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }).catch(() => {}); // photo pas encore livrée : on garde la précédente
};
const select = tab => {
  tabs.forEach(x => {
    const on = x === tab;
    x.setAttribute('aria-selected', on);
    x.tabIndex = on ? 0 : -1;
    const panel = document.getElementById(x.getAttribute('aria-controls'));
    panel.hidden = !on;
    if (on) showPhoto(panel.dataset.photo);
  });
  moveInk();
};
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => select(tab));
  tab.addEventListener('keydown', e => {
    const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (j === undefined) return;
    e.preventDefault();
    const next = tabs[(j + tabs.length) % tabs.length];
    select(next);
    next.focus();
  });
});
$$('.dishes').forEach(ul => $$('li', ul).forEach((li, i) => li.style.setProperty('--i', i)));
moveInk();
addEventListener('resize', moveInk);
document.fonts.ready.then(moveInk);

// ---------- Plan chargé seulement sur demande (aucun contenu tiers sans action du visiteur) ----------
$('[data-load-map]').addEventListener('click', () => {
  const map = $('#map');
  map.innerHTML = `<iframe title="${t('mapTitle')}" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=8.7318%2C41.9156%2C8.7438%2C41.9216&amp;layer=mapnik&amp;marker=41.9186%2C8.7378"></iframe>`;
  map.classList.add('loaded');
  $('iframe', map).focus();
});

// ---------- Galerie agrandie : flèches, clavier, glisser du doigt ----------
const lb = $('.lightbox');
const lbImg = $('img', lb);
const shots = $$('.gallery button');
let cur = 0;
const show = (i, dir = 0) => {
  cur = (i + shots.length) % shots.length;
  const thumb = $('img', shots[cur]);
  const full = shots[cur].dataset.full;
  lbImg.src = thumb.currentSrc || thumb.src; // la vignette tout de suite, la grande photo dès qu'elle est prête
  lbImg.alt = thumb.alt;
  const big = new Image();
  big.src = full;
  big.decode().then(() => { if (shots[cur].dataset.full === full) lbImg.src = full; }).catch(() => {});
  $('.lb-caption', lb).textContent = thumb.alt;
  $('.lb-count', lb).textContent = `${cur + 1} / ${shots.length}`;
  if (dir && !reduce) lbImg.animate([{ opacity: 0, translate: `${dir * 60}px 0` }, { opacity: 1, translate: '0 0' }], { duration: 380, easing: 'cubic-bezier(.2,.7,.2,1)' });
};
shots.forEach((b, i) => b.addEventListener('click', () => { show(i); lb.showModal(); }));
$('.lb-prev', lb).addEventListener('click', () => show(cur - 1, -1));
$('.lb-next', lb).addEventListener('click', () => show(cur + 1, 1));
$('.lb-close', lb).addEventListener('click', () => lb.close());
let swiped = false;
lb.addEventListener('click', e => { if (!e.target.closest('img, button') && !swiped) lb.close(); swiped = false; }); // clic hors photo et boutons, pas après un glissé
lb.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') show(cur - 1, -1);
  if (e.key === 'ArrowRight') show(cur + 1, 1);
});
let x0 = null;
lb.addEventListener('pointerdown', e => { x0 = e.clientX; });
lb.addEventListener('pointerup', e => {
  const dx = e.clientX - x0;
  swiped = x0 !== null && Math.abs(dx) > 50;
  if (swiped) show(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  x0 = null;
});

// ---------- Apparitions au défilement (décalées entre éléments voisins) ----------
$$('.reveal').forEach(el => {
  const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
  if (sibs.length > 1) el.style.setProperty('--d', sibs.indexOf(el) * 90 + 'ms');
});
const io = new IntersectionObserver(entries => entries.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('visible');
  $$('[data-count]', e.target).forEach(countUp);
  io.unobserve(e.target);
}), { threshold: 0.12 });
$$('.reveal, .words').forEach(el => io.observe(el));

// ---------- Curseur doré discret (souris uniquement, jamais sur écran tactile) ----------
if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const c = document.createElement('div');
  c.className = 'cursor';
  c.setAttribute('aria-hidden', 'true');
  document.body.append(c);
  let x = -100, y = -100, cx = x, cy = y, running = false;
  const loop = () => {
    cx += (x - cx) * .22;
    cy += (y - cy) * .22;
    c.style.transform = `translate(${cx}px, ${cy}px)`;
    running = Math.abs(x - cx) + Math.abs(y - cy) > .3; // s'arrête quand la souris ne bouge plus
    if (running) requestAnimationFrame(loop);
  };
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    c.classList.add('on');
    c.classList.toggle('hot', !!e.target.closest('a, button, [role="tab"]'));
    if (!running) { running = true; requestAnimationFrame(loop); }
  }, { passive: true });
  document.addEventListener('mouseleave', () => c.classList.remove('on'));
}
