const nav = document.querySelector('.nav');

function relLum(r, g, b) {
  const f = c => (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const L_LIGHT = relLum(236, 230, 214), L_MUTED = relLum(107, 93, 85); // #ece6d6, --muted
// Dark bar: WCAG luminance under ~0.45, and only when the light ink actually reads better.
const navIsDark = (r, g, b) => {
  const L = relLum(r, g, b);
  return L < 0.45 && contrast(L_LIGHT, L) > contrast(L_MUTED, L);
};
console.assert(
  navIsDark(0x3c, 0x47, 0x37) && navIsDark(0xbe, 0x64, 0x44) && navIsDark(0xd2, 0x72, 0x52)
  && !navIsDark(0xf2, 0xdf, 0xc1) && !navIsDark(0xce, 0xa8, 0x7c),
  'nav contrast');

// Scroll-spy: highlight the menu item for the section under the reader.
// ponytail: "under the reader" = last section whose top has passed 40% of the viewport;
// nothing is highlighted at the top of the page (the hero has no menu item).
const spied = [...(nav ? nav.querySelectorAll('a[href^="#"]') : [])]
  .map(a => ({ a, el: document.querySelector(a.hash) }))
  .filter(x => x.el);

function spy() {
  const line = innerHeight * 0.4;
  let current = null;
  for (const x of spied) if (x.el.getBoundingClientRect().top <= line) current = x;
  for (const x of spied) {
    if (x === current) x.a.setAttribute('aria-current', 'true');
    else x.a.removeAttribute('aria-current');
  }
}

if (nav) {
  addEventListener('scroll', spy, { passive: true });
  addEventListener('resize', spy, { passive: true });
  spy();

  // ponytail: one point, centre, 1px under the bar. Walk parents for the first solid
  // backgroundColor — offsetParent would skip unpositioned bands. A card or photo
  // keeps its own fill, so use the section behind it. Misses background-image / shadow-only fills.
  let navSample = '';
  const paintNav = () => {
    let el = document.elementFromPoint(innerWidth / 2, nav.getBoundingClientRect().bottom + 1);
    if (!el || el.closest('section.welcome')) return;
    if (el.closest('.nav')) { nav.classList.remove('nav-on-dark'); navSample = ''; return; }
    const band = el.closest('section');
    if (band && el !== band && (band.matches('.events') || el.closest('img, picture, figure, .event-card'))) el = band;
    while (el && el !== document.documentElement) {
      const raw = getComputedStyle(el).backgroundColor;
      const m = raw && raw.match(/[\d.]+/g);
      if (m && m.length >= 3 && (m.length === 3 || +m[3] > 0.99)) {
        const dark = navIsDark(+m[0], +m[1], +m[2]);
        const key = raw + dark;
        if (key !== navSample) {
          navSample = key;
          nav.style.setProperty('--nav-bg', raw);
          nav.classList.toggle('nav-on-dark', dark);
        }
        return;
      }
      el = el.parentElement;
    }
  };
  let navFrame = 0;
  const scheduleNav = () => {
    if (navFrame) return;
    navFrame = requestAnimationFrame(() => { navFrame = 0; paintNav(); });
  };

  // Phone menu: hamburger opens a full-screen list; any link, Escape or the X closes it.
  const toggle = nav.querySelector('.nav-toggle');
  const setMenu = open => {
    nav.classList.toggle('open', open);
    if (open) nav.classList.remove('nav-hidden');
    toggle.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
    paintNav();
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  nav.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  addEventListener('scroll', scheduleNav, { passive: true });
  addEventListener('resize', scheduleNav, { passive: true });
  addEventListener('load', paintNav);
  paintNav();

  // Slide the bar off while scrolling down; bring it back on the way up.
  // Stay visible at the top, and while the phone menu is open (a transform
  // would also pull the fixed menu off screen).
  let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    const dy = y - lastY;
    if (nav.classList.contains('open') || y < 8) nav.classList.remove('nav-hidden');
    else if (dy > 8) nav.classList.add('nav-hidden');
    else if (dy < -8) nav.classList.remove('nav-hidden');
    else return;
    lastY = y;
  }, { passive: true });
}

// Forms (rsvp.html): post to a Google Form endpoint without leaving the page.
document.querySelectorAll('.rsvp-form').forEach(rsvp => {
  const extra = rsvp.querySelector('.if-attending');
  // decliners don't need the event/guest/dietary questions
  if (extra) rsvp.addEventListener('change', e => {
    if (e.target.type !== 'radio') return;
    const declined = e.target.value === 'Regretfully declines';
    extra.hidden = declined;
    extra.querySelectorAll('input, textarea').forEach(el => { el.disabled = declined; });
  });

  rsvp.addEventListener('submit', async e => {
    e.preventDefault();
    rsvp.classList.add('show-errors');
    const error = rsvp.querySelector('.form-error');
    if (!rsvp.checkValidity()) {
      error.hidden = false;
      rsvp.querySelector(':invalid').focus();
      return;
    }
    error.hidden = true;
    const button = rsvp.querySelector('button');
    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      // ponytail: Google Forms answers with an opaque no-cors response, so a resolved fetch counts as sent.
      await fetch(rsvp.action, { method: 'POST', mode: 'no-cors', body: new FormData(rsvp) });
      rsvp.hidden = true;
      const thanks = document.querySelector('.rsvp-thanks');
      thanks.hidden = false;
      thanks.scrollIntoView({ block: 'center' });
    } catch {
      rsvp.querySelector('.form-fallback').hidden = false;
      button.disabled = false;
      button.textContent = 'Send reply';
    }
  });
});

// Close the note with a short drop, then dialog.close(). Reduced motion skips the animation.
document.querySelectorAll('form.note-close').forEach(form => {
  form.addEventListener('submit', e => {
    const dialog = form.closest('dialog');
    if (!dialog?.open || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    e.preventDefault();
    if (dialog.classList.contains('closing')) return;
    dialog.classList.add('closing');
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      dialog.close();
      dialog.classList.remove('closing');
    };
    const onEnd = ev => {
      if (ev.target !== dialog || !ev.animationName.startsWith('note-drop')) return;
      dialog.removeEventListener('animationend', onEnd);
      finish();
    };
    dialog.addEventListener('animationend', onEnd);
    setTimeout(finish, 700); // animation is .6s; this covers a missed animationend
  });
});

// Personal pages. A guest is identified either by a ?g=CODE link (mail merge) or by typing their
// name on the Welcome gate, which matches against guests/index.json ({code, household, names}).
// ponytail: no verification — the name is the key, as on most wedding sites. Remembered in localStorage.
const EVENT_PILLS = { welcome: 'Welcome Dinner', ceremony: 'Baraat & Ceremony', reception: 'Cocktails & Dinner', afterparty: 'After Party' };

function personalize(g, code) {
  const set = (sel, text) => document.querySelectorAll(sel).forEach(el => { el.textContent = text; });
  document.title = `${g.household} · ${document.title}`;
  set('.g-household', g.household);

  const note = document.querySelector('dialog.note');
  if (note && g.memory) { // no memory written yet: no note, no "Your note" link
    if (g.photo) {
      const fig = note.querySelector('.note-photo');
      fig.hidden = false;
      fig.querySelector('img').src = `images/guests/${g.photo}`;
    }
    note.querySelector('.note-memory').replaceChildren(
      ...g.memory.split(/\n\s*\n|\n/).filter(Boolean).map(t => Object.assign(document.createElement('p'), { textContent: t })));
    const aside = note.querySelector('.note-aside');
    if (g.note) { aside.hidden = false; aside.textContent = g.note; }
    const link = document.querySelector('.nav-note');
    link.hidden = false;
    link.addEventListener('click', e => { e.preventDefault(); note.showModal(); });
    // open once per household per browser; "Your note" in the nav reopens it
    if (sessionStorage.getItem('noteShown') !== code) {
      sessionStorage.setItem('noteShown', code);
      const pause = matchMedia('(max-width: 760px)').matches ? 3600 : 2600;
      setTimeout(() => note.showModal(), pause); // after the gate has faded and the hero has settled; longer on a phone
    }
  }

  const events = document.querySelector('.events');
  if (events) {
    // Everyone is invited to every event; don't hide cards from a partial guest list.
    const line = events.querySelector('.events-invite');
    if (line) line.hidden = true;
  }

  const rsvp = document.querySelector('.rsvp-form');
  if (rsvp) {
    const fill = (id, v) => { const el = document.getElementById(id); if (el && !el.value) el.value = v; };
    fill('rsvp-name', g.household);
    const n = document.getElementById('rsvp-count');
    if (n && g.guests.length) n.value = Math.min(g.guests.length, +n.max || 10);
    fill('rsvp-guests', g.guests.join('\n'));
    const hidden = rsvp.querySelector('input[data-code]');
    if (hidden) hidden.value = code;
    rsvp.querySelectorAll('.pills label').forEach(l => {
      const v = l.querySelector('input').value, key = Object.keys(EVENT_PILLS).find(k => EVENT_PILLS[k] === v);
      if (key) l.hidden = !g.events.includes(key);
    });
    const thanks = document.querySelector('.rsvp-thanks .eyebrow');
    if (thanks) thanks.textContent = `Thank you, ${g.household}`;
  }
}

// --- Welcome gate: match a typed name to a household ---
const norm = s => s.normalize('NFD').replace(/[^a-z\s]/gi, '').toLowerCase().trim().replace(/\s+/g, ' ');
const first = s => s.split(' ')[0];
// one-letter typo tolerance (substitution, missing/extra letter or swapped pair) or a 3+ letter prefix
const near = (a, b) => {
  if (a.length >= 3 && b.startsWith(a)) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++; // first differing position
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i)
    || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
};

// Returns the matching people as [{name, household}] — exact full name, then first name, then close first names.
function matchName(input, index) {
  const q = norm(input);
  if (!q) return [];
  const people = index.flatMap(h => h.names.filter(name => !name.includes('+')) // "Arjun +1" is a placeholder, not a person
    .map(name => ({ name, n: norm(name), household: h })));
  // a lone first name ("Sonali") must still ask which one, even if someone is listed as just "Sonali"
  const exact = q.includes(' ') ? people.filter(p => p.n === q) : [];
  if (exact.length) return exact;
  const byFirst = people.filter(p => first(p.n) === first(q)); // "Matt" or "Matt Lee" -> every Matt
  return byFirst.length ? byFirst : people.filter(p => near(first(q), first(p.n)));
}

function gate(onResolved) {
  const w = document.querySelector('.welcome');
  if (!w) return;
  const form = w.querySelector('.welcome-form'), pick = w.querySelector('.welcome-pick'),
        confirm = w.querySelector('.welcome-confirm'), miss = w.querySelector('.welcome-miss');
  const show = el => { for (const x of [form, pick, confirm, miss]) x.hidden = x !== el; };
  let index = null, chosen = null;

  const choose = h => {
    chosen = h;
    if (h.names.length < 2) return onResolved(h.code);
    const n = h.names.map(first);
    confirm.querySelector('.welcome-q').textContent =
      `${n.slice(0, -1).join(', ')} & ${n.at(-1)}, is that you?`;
    show(confirm);
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    index ??= await (await fetch('guests/index.json', { cache: 'no-cache' })).json(); // list changes as the sheet is rebuilt
    const hits = matchName(form.querySelector('input').value, index);
    const households = [...new Set(hits.map(p => p.household))];
    if (!hits.length) { show(miss); form.hidden = false; return; }
    if (households.length === 1) return choose(households[0]);
    pick.querySelector('.welcome-q').textContent = `Are you ${hits.slice(0, -1).map(p => p.name).join(', ')} or ${hits.at(-1).name}?`;
    pick.querySelector('.welcome-options').replaceChildren(...hits.map(p => {
      const b = Object.assign(document.createElement('button'), { type: 'button', textContent: p.name });
      b.addEventListener('click', () => choose(p.household));
      return b;
    }));
    show(pick);
  });
  w.querySelector('.welcome-yes').addEventListener('click', () => onResolved(chosen.code));
  for (const el of [w.querySelector('.welcome-no'), w.querySelector('.welcome-back a')]) el.addEventListener('click', e => { e.preventDefault(); show(form); form.querySelector('input').focus(); });
  form.querySelector('input').addEventListener('input', () => { miss.hidden = true; });
}

(async () => {
  const params = new URLSearchParams(location.search);
  if (params.has('g') && !params.get('g')) { // "?g=" (the "Not you?" link) = forget this guest and show the name gate
    localStorage.removeItem('g');
    document.documentElement.classList.add('gate');
    document.getElementById('welcome-name')?.focus();
  }
  const code = params.get('g') || localStorage.getItem('g');

  async function load(c) {
    const res = await fetch(`guests/${encodeURIComponent(c)}.json`, { cache: 'no-cache' });
    if (!res.ok) throw 0;
    localStorage.setItem('g', c);
    history.replaceState(null, '', `${location.pathname}?g=${c}${location.hash}`);
    document.documentElement.classList.remove('gate');
    personalize(await res.json(), c);
  }

  if (code) {
    try { await load(code); return; }
    catch { localStorage.removeItem('g'); if (document.querySelector('.welcome')) document.documentElement.classList.add('gate'); }
  }
  gate(c => load(c).catch(() => { document.querySelector('.welcome-miss').hidden = false; }));
})();
