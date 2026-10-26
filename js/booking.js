// Réservation de DÉMONSTRATION.
// Rien n'est envoyé (aucune requête réseau) ni enregistré (aucun cookie, aucun stockage) : tout est effacé à la fermeture.
// Utilise $, $$, t, lang, FR, reduce définis dans main.js.

Object.assign(FR, {
  bkContinue: 'Continuer',
  bkConfirm: 'Confirmer (démo)',
  bkBack: 'Retour',
  bkFinish: 'Fermer',
  bkErrDate: 'Choisissez une date dans le calendrier.',
  bkErrSlot: 'Choisissez une heure.',
  bkNoSlot: 'Plus aucun créneau pour ce service aujourd’hui : choisissez un autre service ou une autre date.',
  bkErrName: 'Indiquez votre nom (2 lettres au moins).',
  bkErrPhone: 'Indiquez un numéro de téléphone valide, par exemple 06 12 34 56 78.',
  bkErrEmail: 'Indiquez une adresse e-mail valide, par exemple nom@exemple.fr.',
  bkGuest1: '1 personne',
  bkGuestN: '{n} personnes',
  bkRecapWhen: 'Votre table',
  bkRecapWho: 'Vos coordonnées',
  bkEdit: 'Modifier',
  bkLDate: 'Date',
  bkLService: 'Service',
  bkLTime: 'Heure',
  bkLGuests: 'Personnes',
  bkLName: 'Nom',
  bkLPhone: 'Téléphone',
  bkLEmail: 'E-mail',
  bkLWishes: 'Demande',
  bkNone: 'Aucune',
  bkDoneText: '{name}, table pour {guests}, le {date} à {time}.'
});
// contrôle : chaque texte de la réservation a sa traduction anglaise
Object.keys(FR).filter(k => k.startsWith('bk')).forEach(k => k in I18N_EN || console.warn('Traduction anglaise manquante :', k));

const bk = $('.booking');
const form = $('.bk', bk);
const grid = $('#bk-cal');
const slotsBox = $('#bk-slots');
const guests = $('#bk-guests');
const backBtn = $('[data-bk-back]', bk);
const nextBtn = $('[data-bk-next]', bk);
const DAY = 864e5;
const HORIZON = 60; // réservable jusqu'à 60 jours à l'avance
const SLOTS = { // créneaux d'exemple, à confirmer avec le restaurant
  midi: ['12:00', '12:30', '13:00', '13:30', '14:00'],
  soir: ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30']
};
const state = { step: 1, date: null, view: 0, focus: null };

// Dates en UTC « pures » (minuit) : pas de décalage d'heure d'été ; « aujourd'hui » = date de la Corse
const parisNow = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
    .formatToParts(new Date()).map(x => [x.type, +x.value]));
  return { today: Date.UTC(p.year, p.month - 1, p.day), now: p.hour * 60 + p.minute };
};
const monthOf = ms => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
const addMonths = (ms, n) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1); };
const loc = () => (lang === 'en' ? 'en-GB' : 'fr-FR');
const fmtDate = (ms, o) => new Intl.DateTimeFormat(loc(), { timeZone: 'UTC', ...o }).format(ms);
const longDate = ms => fmtDate(ms, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = hm => {
  const [h, m] = hm.split(':').map(Number);
  if (lang === 'en') return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hour12: true }).format(Date.UTC(2000, 0, 1, h, m));
  return m ? `${h} h ${m}` : `${h} h`;
};
const guestsText = n => (n === 1 ? t('bkGuest1') : t('bkGuestN').replace('{n}', n));
const cap = s => s[0].toUpperCase() + s.slice(1);
const fill = (tpl, o) => tpl.replace(/\{(\w+)\}/g, (_, k) => o[k]);

// ---------- Calendrier (flèches : jour suivant / précédent, haut et bas : semaine) ----------
const renderCal = () => {
  const { today } = parisNow();
  const max = today + HORIZON * DAY;
  $('#bk-month').textContent = fmtDate(state.view, { month: 'long', year: 'numeric' });
  $('[data-cal="-1"]', bk).disabled = state.view <= monthOf(today);
  $('[data-cal="1"]', bk).disabled = addMonths(state.view, 1) > max;
  const end = addMonths(state.view, 1);
  const inView = ms => ms >= state.view && ms < end && ms >= today && ms <= max;
  const target = [state.focus, state.date].find(ms => ms && inView(ms)) ?? Math.max(state.view, today);
  grid.textContent = '';
  for (let i = 0; i < 7; i++) { // 1er janvier 2024 = un lundi
    const wd = document.createElement('span');
    wd.className = 'cal-wd';
    wd.setAttribute('aria-hidden', 'true');
    wd.textContent = fmtDate(Date.UTC(2024, 0, 1 + i), { weekday: 'narrow' });
    grid.append(wd);
  }
  const pad = (new Date(state.view).getUTCDay() + 6) % 7;
  for (let i = 0; i < pad; i++) grid.append(document.createElement('span'));
  for (let ms = state.view; ms < end; ms += DAY) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cal-day';
    b.dataset.ms = ms;
    b.textContent = new Date(ms).getUTCDate();
    b.setAttribute('aria-label', fmtDate(ms, { weekday: 'long', day: 'numeric', month: 'long' }));
    b.setAttribute('aria-pressed', ms === state.date);
    b.disabled = ms < today || ms > max;
    b.tabIndex = ms === target ? 0 : -1;
    if (ms === today) b.setAttribute('aria-current', 'date');
    grid.append(b);
  }
};
const focusDay = ms => $(`[data-ms="${ms}"]`, grid)?.focus();
const pickDate = ms => {
  state.date = state.focus = ms;
  renderCal();
  focusDay(ms);
  setErr('bk-err-date');
  renderSlots();
  // petit écran : les créneaux sont sous le calendrier, on les amène à l'écran
  if (matchMedia('(max-width: 719px)').matches) $('.bk-side', bk).scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
};
grid.addEventListener('click', e => {
  const b = e.target.closest('.cal-day');
  if (b && !b.disabled) pickDate(+b.dataset.ms);
});
grid.addEventListener('keydown', e => {
  const b = e.target.closest('.cal-day');
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
  if (!b || !step) return;
  e.preventDefault();
  const { today } = parisNow();
  const ms = +b.dataset.ms + step * DAY;
  if (ms < today || ms > today + HORIZON * DAY) return;
  state.focus = ms;
  state.view = monthOf(ms);
  renderCal();
  focusDay(ms);
});
$$('.cal-nav', bk).forEach(nav => nav.addEventListener('click', () => {
  state.view = addMonths(state.view, +nav.dataset.cal);
  state.focus = null;
  renderCal();
  if (!reduce) grid.animate([{ opacity: 0, translate: `${nav.dataset.cal * 24}px 0` }, { opacity: 1, translate: '0 0' }], { duration: 320, easing: 'ease-out' });
  if (nav.disabled) $('.cal-nav:not(:disabled)', bk)?.focus(); // le bouton cliqué vient de se désactiver
}));

// ---------- Créneaux (les heures déjà passées aujourd'hui sont grisées, avec 30 min de marge) ----------
const renderSlots = () => {
  const { today, now } = parisNow();
  const kept = form.elements.slot?.value;
  slotsBox.textContent = '';
  let free = 0;
  SLOTS[form.elements.service.value].forEach(hm => {
    const [h, m] = hm.split(':').map(Number);
    const past = state.date === today && h * 60 + m < now + 30;
    const label = document.createElement('label');
    label.className = 'pill';
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'slot', value: hm, disabled: past, checked: hm === kept && !past });
    input.setAttribute('aria-describedby', 'bk-err-slot');
    const span = document.createElement('span');
    span.textContent = fmtTime(hm);
    label.append(input, span);
    slotsBox.append(label);
    if (!past) free++;
  });
  if (!free) setErr('bk-err-slot', 'bkNoSlot');
  else if ($('#bk-err-slot').dataset.key === 'bkNoSlot') setErr('bk-err-slot');
};
form.addEventListener('change', e => {
  if (e.target.name === 'service') renderSlots();
  if (e.target.name === 'slot') setErr('bk-err-slot');
});

// ---------- Nombre de personnes ----------
const setGuests = n => { guests.value = Math.min(12, Math.max(1, Math.round(n) || 1)); };
$$('[data-guests]', bk).forEach(b => b.addEventListener('click', () => setGuests(+guests.value + +b.dataset.guests)));
guests.addEventListener('change', () => setGuests(+guests.value));

// ---------- Validation (message sous le champ, relié par aria-describedby ; focus sur la première erreur) ----------
const setErr = (id, key) => {
  const p = $('#' + id);
  p.hidden = !key;
  p.dataset.key = key || '';
  p.textContent = key ? t(key) : '';
  const field = { 'bk-err-name': '#bk-name', 'bk-err-phone': '#bk-phone', 'bk-err-email': '#bk-email' }[id];
  if (field) key ? $(field).setAttribute('aria-invalid', 'true') : $(field).removeAttribute('aria-invalid');
};
const val = name => form.elements[name].value.trim();
const checks = {
  1: () => [
    ['bk-err-date', !state.date && 'bkErrDate', () => $('.cal-day[tabindex="0"]', grid)],
    ['bk-err-slot', !form.elements.slot?.value && ($('#bk-slots input:not(:disabled)') ? 'bkErrSlot' : 'bkNoSlot'), () => $('#bk-slots input:not(:disabled)') || $('[name="service"]:checked', bk)]
  ],
  2: () => [
    ['bk-err-name', !/\p{L}.*\p{L}/u.test(val('name')) && 'bkErrName', () => $('#bk-name')],
    ['bk-err-phone', !/^\+?\d{9,15}$/.test(val('phone').replace(/[\s.\-()]/g, '')) && 'bkErrPhone', () => $('#bk-phone')],
    ['bk-err-email', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email')) && 'bkErrEmail', () => $('#bk-email')]
  ]
};
const validate = step => {
  const list = checks[step]?.() || [];
  list.forEach(([id, key]) => setErr(id, key));
  const bad = list.find(([, key]) => key);
  if (bad) bad[2]()?.focus();
  return !bad;
};
// pendant la saisie : on ne revérifie que ce champ, sans déplacer le focus (l'erreur s'efface dès qu'il devient juste)
['name', 'phone', 'email'].forEach(n => form.elements[n].addEventListener('input', () => {
  const id = 'bk-err-' + n;
  if (!$('#' + id).hidden) setErr(id, checks[2]().find(c => c[0] === id)[1]);
}));

// ---------- Récapitulatif (textes saisis insérés en textContent, jamais en HTML) ----------
const wishes = () => {
  const list = $$('[name="wish"]:checked', bk).map(c => t(c.value));
  if (val('note')) list.push(val('note'));
  return list.join(' · ') || t('bkNone');
};
const renderRecap = () => {
  const box = $('#bk-recap');
  box.textContent = '';
  [
    ['bkRecapWhen', 1, [['bkLDate', cap(longDate(state.date))], ['bkLService', t(form.elements.service.value === 'midi' ? 'bkLunch' : 'bkDinner')], ['bkLTime', fmtTime(form.elements.slot.value)], ['bkLGuests', guestsText(+guests.value)]]],
    ['bkRecapWho', 2, [['bkLName', val('name')], ['bkLPhone', val('phone')], ['bkLEmail', val('email')], ['bkLWishes', wishes()]]]
  ].forEach(([title, step, rows]) => {
    const group = document.createElement('div');
    group.className = 'recap-group';
    const head = document.createElement('div');
    head.className = 'recap-head';
    const h = document.createElement('h4');
    h.textContent = t(title);
    const edit = Object.assign(document.createElement('button'), { type: 'button', className: 'recap-edit', textContent: t('bkEdit') });
    edit.setAttribute('aria-label', `${t('bkEdit')} : ${t(title)}`);
    edit.addEventListener('click', () => go(step));
    head.append(h, edit);
    const dl = document.createElement('dl');
    rows.forEach(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = t(k);
      const dd = document.createElement('dd');
      dd.textContent = v;
      dl.append(dt, dd);
    });
    group.append(head, dl);
    box.append(group);
  });
};
const renderDone = () => {
  $('#bk-done-text').textContent = fill(t('bkDoneText'), { name: val('name'), guests: guestsText(+guests.value), date: longDate(state.date), time: fmtTime(form.elements.slot.value) });
};

// ---------- Étapes ----------
const renderButtons = () => {
  backBtn.hidden = state.step === 1 || state.step === 4;
  backBtn.textContent = t('bkBack');
  nextBtn.textContent = t({ 1: 'bkContinue', 2: 'bkContinue', 3: 'bkConfirm', 4: 'bkFinish' }[state.step]);
  $$('.bk-steps li', bk).forEach((li, i) => {
    li.classList.toggle('done', i + 1 < state.step);
    if (i + 1 === state.step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
};
const go = step => {
  state.step = step;
  $$('.bk-step', bk).forEach(s => { s.hidden = +s.dataset.step !== step; });
  bk.classList.toggle('is-done', step === 4);
  if (step === 3) renderRecap();
  if (step === 4) renderDone();
  renderButtons();
  $('.bk-body', bk).scrollTop = 0;
  $(`#bk-h${step}`).focus();
};
form.addEventListener('submit', e => {
  e.preventDefault(); // aucun envoi : on passe seulement à l'étape suivante
  if (state.step === 4) return bk.close();
  if (validate(state.step)) go(state.step + 1);
});
backBtn.addEventListener('click', () => go(state.step - 1));
$('[data-bk-close]', bk).addEventListener('click', () => bk.close());

// ---------- Ouverture / fermeture ----------
const reset = () => {
  form.reset();
  $('#bk-recap').textContent = ''; // efface aussi les copies affichées des données saisies
  $('#bk-done-text').textContent = '';
  const { today } = parisNow();
  Object.assign(state, { date: null, focus: null, view: monthOf(today) });
  $$('.bk-err', bk).forEach(p => setErr(p.id));
  renderCal();
  renderSlots();
  go(1);
};
bk.addEventListener('close', reset); // les données saisies sont effacées dès la fermeture
$$('[data-book]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault(); // sans JavaScript, le lien reste un appel téléphonique
  if (nav.classList.contains('open')) setMenu(false);
  bk.showModal();
  $('#bk-h1').focus();
}));
document.addEventListener('langchange', () => {
  renderCal();
  renderSlots();
  renderButtons();
  if (state.step === 3) renderRecap();
  if (state.step === 4) renderDone();
  $$('.bk-err', bk).forEach(p => { if (p.dataset.key) p.textContent = t(p.dataset.key); });
});
reset();
