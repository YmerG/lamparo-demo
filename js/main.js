document.documentElement.classList.add('js');

// En-tête opaque après le haut de page
const header = document.querySelector('.header');
const onScroll = () => header.classList.toggle('scrolled', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Menu téléphone
const burger = document.querySelector('.burger');
const nav = document.getElementById('nav');
const setMenu = open => {
  nav.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', open);
  burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  if (open) header.classList.add('scrolled'); else onScroll();
};
burger.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });

// Ouvert / fermé, à l'heure de la Corse (7 h – 2 h tous les jours, à confirmer)
const hour = +new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Paris' }).format(new Date());
const open = hour >= 7 || hour < 2;
document.querySelectorAll('[data-status]').forEach(el => {
  el.textContent = open ? 'Ouvert en ce moment · jusqu’à 2 h' : 'Fermé · ouvre à 7 h';
  el.classList.toggle('closed', !open);
});

// Onglets de la carte (flèches gauche/droite au clavier)
const tabs = [...document.querySelectorAll('[role="tab"]')];
const select = tab => {
  tabs.forEach(t => {
    const on = t === tab;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  });
};
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => select(tab));
  tab.addEventListener('keydown', e => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    const next = tabs[(i + d + tabs.length) % tabs.length];
    select(next);
    next.focus();
  });
});

// Plan chargé seulement sur demande (aucun contenu tiers sans action du visiteur)
document.querySelector('[data-load-map]').addEventListener('click', () => {
  const map = document.getElementById('map');
  map.innerHTML = '<iframe title="Plan d’accès au Lamparo" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=8.7318%2C41.9156%2C8.7438%2C41.9216&amp;layer=mapnik&amp;marker=41.9186%2C8.7378"></iframe>';
  map.classList.add('loaded');
});

// Apparition douce au défilement
const io = new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
}), { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));
