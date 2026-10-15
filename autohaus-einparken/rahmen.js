// Rahmen für alle Mini-Games: Spielfläche, Start- und Endbild, Logo, Kundenfarben, Ton, Vollbild, Bestwert.
// Die Kundendaten stehen in kunde/kunde.js (window.KUNDE). Jedes Spiel meldet sich mit Rahmen.spiel({...}) an.
// Diese Datei nur in gemeinsam/ bearbeiten – aktualisieren.py kopiert sie in alle Spiele.
(function () {
  'use strict';

  const K = window.KUNDE || {};
  const farben = Object.assign({ haupt: '#d32f2f', akzent: '#ffb300', dunkel: '#151922', hell: '#ffffff' }, K.farben);

  // ---------- Farben ----------
  function rgb(hex) {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // Text auf einer Farbe: schwarz oder weiß, je nachdem, was besser lesbar ist
  function textFarbe(hex) {
    const [r, g, b] = rgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111111' : '#ffffff';
  }
  // Farbe aufhellen (f > 0) oder abdunkeln (f < 0), f zwischen -1 und 1
  function toenen(hex, f) {
    const z = f > 0 ? 255 : 0, t = Math.abs(f);
    const [r, g, b] = rgb(hex).map(v => Math.round(v + (z - v) * t));
    return `rgb(${r},${g},${b})`;
  }
  function mitAlpha(hex, a) { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; }

  const wurzel = document.documentElement.style;
  wurzel.setProperty('--haupt', farben.haupt);
  wurzel.setProperty('--haupt-text', textFarbe(farben.haupt));
  wurzel.setProperty('--akzent', farben.akzent);
  wurzel.setProperty('--dunkel', farben.dunkel);
  wurzel.setProperty('--hell', farben.hell);

  // ---------- Logo ----------
  const logo = new Image();
  let logoBereit = false;
  logo.onload = () => { logoBereit = true; };
  logo.src = K.logo || 'kunde/logo.svg';

  // Zweites Logo für helle Flächen im Spiel (z. B. weiße Radnabe), falls der Kunde eins hat (logoAufHell)
  const logoHell = new Image();
  let logoHellBereit = false;
  if (K.logoAufHell) { logoHell.onload = () => { logoHellBereit = true; }; logoHell.src = K.logoAufHell; }

  // Logo in ein Kästchen einpassen (Seitenverhältnis bleibt); aufHell = Fläche ist hell
  function zeichneLogo(g, x, y, w, h, alpha, aufHell) {
    const bild = aufHell && logoHellBereit ? logoHell : logo;
    if (bild === logo && !logoBereit) return;
    if (!bild.naturalWidth) return;
    const f = Math.min(w / bild.naturalWidth, h / bild.naturalHeight);
    const lw = bild.naturalWidth * f, lh = bild.naturalHeight * f;
    g.save();
    if (alpha != null) g.globalAlpha *= alpha;
    g.drawImage(bild, x + (w - lw) / 2, y + (h - lh) / 2, lw, lh);
    g.restore();
  }

  // ---------- Klang ----------
  // Alle Töne werden im Browser erzeugt, es gibt keine Tondateien.
  let ac = null;
  let tonAn = lesen('ton') !== 'aus';
  function audio() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state !== 'running') ac.resume().catch(() => {});
    return ac;
  }
  // Browser geben Ton erst nach einem Tippen frei
  ['pointerup', 'touchend', 'click', 'keydown'].forEach(e =>
    addEventListener(e, () => { if (tonAn) audio(); }, { passive: true }));

  function piep(freq, dauer, art, pegel, bis, start) {
    const a = ac, t = a.currentTime + (start || 0);
    const o = a.createOscillator(), v = a.createGain();
    o.type = art || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (bis) o.frequency.exponentialRampToValueAtTime(bis, t + dauer);
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(pegel || 0.2, t + 0.01);
    v.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    o.connect(v).connect(a.destination);
    o.start(t); o.stop(t + dauer + 0.02);
  }
  let rauschPuffer = null;
  function rauschen(dauer, filter, freq, pegel, start) {
    const a = ac, t = a.currentTime + (start || 0);
    if (!rauschPuffer) {
      rauschPuffer = a.createBuffer(1, a.sampleRate, a.sampleRate);
      const d = rauschPuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const q = a.createBufferSource(); q.buffer = rauschPuffer;
    const f = a.createBiquadFilter(); f.type = filter; f.frequency.value = freq;
    const v = a.createGain();
    v.gain.setValueAtTime(pegel, t);
    v.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    q.connect(f).connect(v).connect(a.destination);
    q.start(t, Math.random() * 0.5); q.stop(t + dauer + 0.02);
  }
  const TOENE = {
    klick: () => piep(880, 0.06, 'sine', 0.15),
    dreh: () => { for (let i = 0; i < 4; i++) rauschen(0.03, 'highpass', 2500, 0.35, i * 0.045); piep(300, 0.12, 'square', 0.04, 600); },
    fehler: () => piep(170, 0.28, 'square', 0.1, 100),
    gut: () => { piep(660, 0.12, 'triangle', 0.2); piep(990, 0.2, 'triangle', 0.2, null, 0.1); },
    sieg: () => [523, 659, 784, 1047].forEach((f, i) => piep(f, i === 3 ? 0.45 : 0.15, 'triangle', 0.2, null, i * 0.12)),
    crash: () => { rauschen(0.5, 'lowpass', 900, 0.8); piep(90, 0.35, 'sawtooth', 0.12, 40); rauschen(0.25, 'highpass', 3000, 0.25, 0.05); },
    wisch: () => rauschen(0.09, 'bandpass', 1800 + Math.random() * 800, 0.12),
    los: () => { piep(440, 0.12, 'square', 0.08); piep(880, 0.25, 'square', 0.08, null, 0.15); },
    motor: () => piep(70, 0.5, 'sawtooth', 0.06, 140),
  };
  // ---------- Aufnahmen ----------
  // Spiele können eigene Tondateien mitbringen (Rahmen.klaenge). Eine Aufnahme ersetzt den erzeugten Ton
  // gleichen Namens; fehlt sie oder lädt sie nicht, bleibt der erzeugte Ton.
  const clips = {}, clipPegel = {};
  function klaenge(liste) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ac) ac = new AC();
    Object.entries(liste).forEach(([name, c]) => {
      clipPegel[name] = c.pegel != null ? c.pegel : 0.5;
      clips[name] = fetch(c.datei)
        .then(r => r.arrayBuffer())
        .then(b => new Promise((ok, nein) => ac.decodeAudioData(b, ok, nein)))
        .catch(() => null);
      clips[name].then(b => { clips[name + ':fertig'] = b; });
    });
  }
  function spieleClip(name) {
    const b = clips[name + ':fertig'];
    if (!b) return false;
    const q = ac.createBufferSource(), v = ac.createGain();
    q.buffer = b; v.gain.value = clipPegel[name];
    q.connect(v).connect(ac.destination);
    q.start();
    return true;
  }

  // Hintergrundgeräusch in Endlosschleife (startet mit dem Spiel, endet mit ihm)
  let schleifeName = null, schleifeLaeuft = null;
  async function schleifeStarten() {
    schleifeStoppen();
    if (!schleifeName || !tonAn || !clips[schleifeName]) return;
    const b = await clips[schleifeName];
    if (!b || zustand !== 'spiel' || schleifeLaeuft || !tonAn) return;
    const q = ac.createBufferSource(), v = ac.createGain();
    q.buffer = b; q.loop = true;
    v.gain.setValueAtTime(0.0001, ac.currentTime);
    v.gain.exponentialRampToValueAtTime(clipPegel[schleifeName], ac.currentTime + 0.8);
    q.connect(v).connect(ac.destination);
    q.start(0, Math.random() * b.duration);
    schleifeLaeuft = { q, v };
  }
  function schleifeStoppen() {
    if (!schleifeLaeuft) return;
    const { q, v } = schleifeLaeuft;
    schleifeLaeuft = null;
    try { v.gain.setTargetAtTime(0.0001, ac.currentTime, 0.25); q.stop(ac.currentTime + 1.5); } catch (e) { /* egal */ }
  }

  function ton(name) {
    if (!tonAn) return;
    const a = audio();
    if (!a) return;
    const spielen = () => { try { if (!spieleClip(name) && TOENE[name]) TOENE[name](); } catch (e) { /* Ton ist Nebensache */ } };
    if (a.state === 'running') return spielen();
    // Direkt nach dem ersten Tippen ist der Ton oft noch nicht freigegeben (z. B. Countdown beim Spielstart):
    // kurz auf die Freigabe warten, aber nicht nachholen, wenn es zu spät ist
    const seit = performance.now();
    a.resume().then(() => { if (a.state === 'running' && performance.now() - seit < 500) spielen(); }).catch(() => {});
  }

  // ---------- Speicher (Bestwert, Ton an/aus) ----------
  function lesen(k) { try { return localStorage.getItem('mg:' + k); } catch (e) { return null; } }
  function schreiben(k, v) { try { localStorage.setItem('mg:' + k, v); } catch (e) { /* privat / gesperrt */ } }

  // ---------- Seite aufbauen ----------
  const SYM = {
    tonAn: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
    tonAus: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
    voll: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    klein: '<svg viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
    heim: '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
  };
  // Zurück zur Startseite mit allen Spielen (nur wenn kunde.js eine startseite nennt)
  const heim = K.startseite ? String(K.startseite).replace(/"/g, '') : '';
  document.body.insertAdjacentHTML('beforeend', `
    <canvas id="feld"></canvas>
    <div id="anzeige">
      ${heim ? `<a id="heimKnopf" href="${heim}" aria-label="Zum Menü">${SYM.heim}</a>` : ''}
      <div class="links"></div><div class="rechts"></div>
      <button id="tonKnopf" type="button" aria-label="Ton an oder aus"></button>
      <button id="vollKnopf" type="button" aria-label="Vollbild"></button>
    </div>
    <div class="schirm" id="startSchirm"><div class="karte">
      <img class="logo" alt="">
      <h1 class="titel"></h1><p class="unter"></p><p class="anleitung"></p>
      <p class="bestwert"></p>
      <button class="knopf" id="losKnopf" type="button">Los geht's</button>
      ${heim ? `<a class="knopf zweit" href="${heim}">Zum Menü</a>` : ''}
      <p class="quellen"></p>
    </div></div>
    <div class="schirm" id="endSchirm" hidden><div class="karte">
      <img class="logo" alt="">
      <h1 class="ueberschrift"></h1><div class="wert"></div><p class="bestwert"></p><p class="text"></p>
      <a class="knopf" id="kundeKnopf" target="_blank" rel="noopener" hidden></a>
      <button class="knopf zweit" id="nochmalKnopf" type="button">Nochmal spielen</button>
      ${heim ? `<a class="knopf zweit" href="${heim}">Zum Menü</a>` : ''}
    </div></div>`);

  const $ = s => document.querySelector(s);
  const feld = $('#feld'), g = feld.getContext('2d');
  document.querySelectorAll('.karte .logo').forEach(i => { i.src = logo.src; i.alt = K.firma || ''; });

  const tonKnopf = $('#tonKnopf');
  function tonSymbol() { tonKnopf.innerHTML = tonAn ? SYM.tonAn : SYM.tonAus; }
  tonKnopf.addEventListener('click', () => {
    tonAn = !tonAn; schreiben('ton', tonAn ? 'an' : 'aus'); tonSymbol();
    if (tonAn) { audio(); ton('klick'); if (zustand === 'spiel') schleifeStarten(); } else schleifeStoppen();
  });
  tonSymbol();

  // Vollbild gibt es nicht überall (iPhone, eingebettet ohne allow="fullscreen")
  const vollKnopf = $('#vollKnopf');
  const vollGeht = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  if (!vollGeht) vollKnopf.hidden = true;
  function istVoll() { return document.fullscreenElement || document.webkitFullscreenElement; }
  function vollSymbol() { vollKnopf.innerHTML = istVoll() ? SYM.klein : SYM.voll; }
  vollKnopf.addEventListener('click', () => {
    const d = document, el = d.documentElement;
    if (istVoll()) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  });
  document.addEventListener('fullscreenchange', vollSymbol);
  document.addEventListener('webkitfullscreenchange', vollSymbol);
  vollSymbol();

  // ---------- Spiel ----------
  let S = null;                 // das angemeldete Spiel
  let zustand = 'start';        // start → spiel → ende
  let B = 0, H = 0, dpr = 1;
  let texte = {};

  function zahl(p) { return S.format ? S.format(p) : String(p); }
  function bestKey() { return 'best:' + S.id + ':' + (K.firma || ''); }
  function besser(a, b) { return b == null || (S.wertung === 'niedrig' ? a < b : a > b); }

  function startSchirm() {
    $('#startSchirm .titel').textContent = texte.titel || '';
    $('#startSchirm .unter').textContent = texte.untertitel || '';
    $('#startSchirm .anleitung').textContent = texte.anleitung || '';
    const b = lesen(bestKey());
    $('#startSchirm .bestwert').textContent = b != null ? 'Dein Bestwert: ' + zahl(+b) : '';
    $('#startSchirm .quellen').textContent = S.quellen || '';
    $('#startSchirm').hidden = false;
    $('#endSchirm').hidden = true;
  }

  function starten() {
    $('#startSchirm').hidden = true;
    $('#endSchirm').hidden = true;
    audio();
    zustand = 'spiel';
    anzeige('', '');
    S.neu && S.neu();
    schleifeStarten();
  }

  function ende(punkte, extra) {
    if (zustand !== 'spiel') return;
    zustand = 'ende';
    schleifeStoppen();
    extra = extra || {};
    const alt = lesen(bestKey());
    const neu = besser(punkte, alt == null ? null : +alt);
    if (neu) schreiben(bestKey(), punkte);
    $('#endSchirm .ueberschrift').textContent = extra.ueberschrift || texte.endeTitel || 'Geschafft!';
    $('#endSchirm .wert').textContent = zahl(punkte);
    const bw = $('#endSchirm .bestwert');
    bw.textContent = neu ? (alt == null ? 'Dein erster Bestwert!' : 'Neuer Bestwert!') : 'Dein Bestwert: ' + zahl(+alt);
    bw.classList.toggle('neu', neu);
    $('#endSchirm .text').textContent = extra.text || texte.ende || '';
    const kk = $('#kundeKnopf'), kn = K.knopf || {};
    kk.hidden = !kn.link;
    if (kn.link) { kk.href = kn.link; kk.textContent = kn.text || 'Mehr erfahren'; }
    setTimeout(() => {
      $('#endSchirm').hidden = false;
      if (neu && alt != null) ton('bestwert');
    }, extra.verzoegerung != null ? extra.verzoegerung : 900);
  }

  $('#losKnopf').addEventListener('click', starten);
  $('#nochmalKnopf').addEventListener('click', starten);

  function anzeige(links, rechts) {
    $('#anzeige .links').textContent = links;
    $('#anzeige .rechts').textContent = rechts;
  }

  // ---------- Größe ----------
  function groesse() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    B = innerWidth; H = innerHeight;
    feld.width = Math.round(B * dpr); feld.height = Math.round(H * dpr);
    S && S.groesse && S.groesse(B, H);
  }
  addEventListener('resize', groesse);

  // ---------- Eingabe ----------
  let finger = null;
  function punkt(e) { const r = feld.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  feld.addEventListener('pointerdown', e => {
    if (zustand !== 'spiel' || finger !== null) return;
    finger = e.pointerId;
    try { feld.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
    S.runter && S.runter(...punkt(e));
    e.preventDefault();
  });
  feld.addEventListener('pointermove', e => {
    if (e.pointerId !== finger || zustand !== 'spiel') return;
    S.bewegen && S.bewegen(...punkt(e));
  });
  function los(e) {
    if (e.pointerId !== finger) return;
    finger = null;
    if (zustand === 'spiel') S.hoch && S.hoch(...punkt(e));
  }
  feld.addEventListener('pointerup', los);
  feld.addEventListener('pointercancel', los);

  // ---------- Schleife ----------
  let zuletzt = performance.now();
  function bild(jetzt) {
    const dt = Math.min(0.05, (jetzt - zuletzt) / 1000);
    zuletzt = jetzt;
    if (zustand === 'spiel' && S.schritt) S.schritt(dt);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, B, H);
    S.zeichne(g, B, H, zustand, dt);
    requestAnimationFrame(bild);
  }

  // ---------- Schnittstelle für die Spiele ----------
  window.Rahmen = {
    kunde: K, farben, textFarbe, toenen, mitAlpha,
    zeichneLogo, get logoBereit() { return logoBereit; },
    ton, ende, anzeige,
    get zustand() { return zustand; },
    spiel(def) {
      S = def;
      if (def.klaenge) klaenge(def.klaenge);
      schleifeName = def.schleife || null;
      texte = Object.assign({}, def.texte, K.texte);
      document.title = (texte.titel || 'Spiel') + (K.firma ? ' – ' + K.firma : '');
      groesse();
      S.neu && S.neu();
      startSchirm();
      requestAnimationFrame(bild);
    },
  };
})();
