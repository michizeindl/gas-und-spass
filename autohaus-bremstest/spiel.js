// Bremstest: Aus dem Cockpit eine Landstraße entlangfahren. Plötzlich taucht eine Gefahr auf – sofort tippen = Vollbremsung.
// Danach zeigt das Spiel Reaktionszeit, Reaktionsweg, Bremsweg und Anhalteweg wie in der Fahrschule.
// Sechs Fahrten, immer schwieriger (Tempo, Regen, Nebel, Nacht). Wertung: durchschnittliche Reaktionszeit.
(function () {
  'use strict';
  const R_ = Rahmen, F = R_.farben;
  const SCHRIFT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const P = Math.PI;

  // ---------- Fahrten ----------
  // gefahr: reh | ball | auto (bremst vor einem) | stau (Stauende mit Warnblinker)
  const FAHRTEN = [
    { kmh: 30, wetter: 'tag', gefahr: 'ball' },
    { kmh: 50, wetter: 'tag', gefahr: 'reh' },
    { kmh: 50, wetter: 'regen', gefahr: 'auto' },
    { kmh: 70, wetter: 'tag', gefahr: 'stau' },
    { kmh: 70, wetter: 'nebel', gefahr: 'reh' },
    { kmh: 100, wetter: 'nacht', gefahr: 'stau' },
  ];
  const WETTER = { tag: 'trocken', regen: 'Regen', nebel: 'Nebel', nacht: 'Nacht' };
  const NASS = 1.5;          // Bremsweg bei Nässe 1,5-mal so lang
  const FAIR = 0.9;          // bei 0,9 s Reaktionszeit reicht der Platz gerade noch
  const AUTOFARBEN = ['#b9bdc0', '#2f63c6', '#f2f3f1', '#5f6366', '#e2622f', '#1d1f22'];   // Opel-Lackfarben

  // Fahrschul-Faustformel: Bremsweg bei Gefahrenbremsung = (km/h / 10)² / 2, bei Nässe länger
  const bremsweg = f => (f.kmh / 10) ** 2 / 2 * (f.wetter === 'regen' ? NASS : 1);

  // ---------- Zustand ----------
  let schilder = [];
  let nr, phase, phaseT, s, v, v0, a, tEreignis, gefahrT, reaktion, ziel, auto, ergebnisse, zuFrueh, zuFruehGesamt, wackeln, rehX, ballX, zahlen, blink;
  let B = 0, H = 0;

  function neu() {
    // #fahrt=N hinter der Adresse startet bei Fahrt N (zum Testen)
    const t = /fahrt=(\d)/.exec(location.hash);
    nr = t ? Math.min(FAHRTEN.length, Math.max(1, +t[1])) - 1 : 0; ergebnisse = []; zuFrueh = 0; zuFruehGesamt = 0;
    fahrtStarten();
  }
  function fahrtStarten() {
    const f = FAHRTEN[nr];
    v0 = f.kmh / 3.6; v = v0; s = 0;
    a = v0 * v0 / (2 * bremsweg(f));
    phase = 'fahren'; phaseT = 0;
    tEreignis = 2.6 + Math.random() * 3.4;             // Gefahr kommt nach 2,6 bis 6 Sekunden
    gefahrT = 0; reaktion = null; ziel = null; wackeln = 0; zahlen = null;
    rehX = 4.5; ballX = 3.2;
    // Schilder am rechten Rand: erst das Tempo, dann die Warnung vor der Gefahr (wie in der Fahrschule)
    const warnung = { reh: 'wildwechsel', ball: 'kinder', stau: 'stau' }[f.gefahr];
    // Abstände nach dem frühesten Ort der Gefahr: Warnschild bei 80 %, Tempo-Schild bei 40 % (mindestens 20 m)
    const fruehesteGefahr = v0 * (2.6 + FAIR) + bremsweg(f) + 1.5;
    schilder = [{ bild: SCHILD['tempo-' + f.kmh], pos: Math.max(20, fruehesteGefahr * 0.4) }];
    if (warnung) schilder.push({ bild: SCHILD[warnung], pos: fruehesteGefahr * 0.8 });
    // Werbeschild vom Autohaus links am Rand (4,5 m breit), weit vorne, damit es auch auf dem Handy lange ganz im Bild ist
    schilder.push({ bild: WERBUNG, pos: Math.max(70, fruehesteGefahr * 0.7), x: -7.6, hoehe: 3.2 });
    // vorausfahrendes Auto (nur bei „auto“): fährt im Abstand vor einem her
    auto = f.gefahr === 'auto' ? { pos: v0 * FAIR + 2, v: v0, bremst: false, farbe: AUTOFARBEN[nr % AUTOFARBEN.length] } : null;
  }

  // Abstand zur Gefahr in Metern (vor der eigenen Stoßstange)
  function abstand() {
    if (auto) return auto.pos - s;
    return ziel == null ? Infinity : ziel - s;
  }

  // ---------- Eingabe ----------
  function runter() {
    if (phase === 'fahren') {
      // vor der Gefahr getippt: gleiche Fahrt nochmal, jedes Mal +0,2 s auf die Reaktionszeit dieser Fahrt
      zuFrueh++; zuFruehGesamt++;
      phase = 'schreck'; phaseT = 0;
      R_.ton('hupe'); R_.vibrieren(80);
    } else if (phase === 'gefahr') {
      reaktion = gefahrT;
      phase = 'bremsen'; phaseT = 0;
      R_.ton('bremsen');
    } else if (phase === 'auswertung' && phaseT > 0.6) {
      weiter();
    }
  }
  addEventListener('keydown', e => { if (R_.zustand === 'spiel' && (e.key === ' ' || e.key === 'Enter')) runter(); });

  function weiter() {
    nr++;
    // Ein Unfall beendet das Spiel sofort (Nutzerwunsch: dann 0 Punkte)
    if (nr >= FAHRTEN.length || ergebnisse.some(e => e.unfall)) { schluss(); return; }
    zuFrueh = 0;
    fahrtStarten();
  }

  // Ø Reaktionszeit → Punkte (höchstens 1.000, wie in allen Spielen), dazwischen gleichmäßig verteilt.
  // Die Stufengrenzen 900/800/700/550 sind in allen Spielen gleich. Ein Unfall beendet das Spiel mit 0 Punkten.
  const ZU_FRUEH = 0.2;   // Strafzeit in Sekunden je zu frühem Tippen (Nutzerwunsch)
  const ZU_FRUEH_MAX = 3; // so oft im ganzen Spiel zu früh = Spielende mit 0 Punkten
  const PUNKTE = [[0.4, 1000], [0.5, 900], [0.6, 800], [0.75, 700], [0.9, 550], [1.5, 150]];
  function punkteAus(t) {
    if (t <= PUNKTE[0][0]) return PUNKTE[0][1];
    for (let i = 1; i < PUNKTE.length; i++) {
      const [t0, p0] = PUNKTE[i - 1], [t1, p1] = PUNKTE[i];
      if (t <= t1) return Math.round(p0 + (p1 - p0) * (t - t0) / (t1 - t0));
    }
    return PUNKTE[PUNKTE.length - 1][1];
  }

  function schluss() {
    phase = 'aus';
    const zeiten = ergebnisse.map(e => e.wertung), schnitt = zeiten.length ? zeiten.reduce((x, y) => x + y, 0) / zeiten.length : 0;
    const unfall = ergebnisse.some(e => e.unfall), fehlstart = zuFruehGesamt >= ZU_FRUEH_MAX;
    const t = Math.round(schnitt * 100) / 100, aus = unfall || fehlstart;
    R_.ton(aus ? 'fehler' : 'sieg');
    R_.ende(aus ? 0 : punkteAus(t), {
      ueberschrift: unfall ? 'Nicht unfallfrei' : fehlstart ? 'Zu oft zu früh' : t < 0.5 ? 'Blitzschnell' : t < 0.6 ? 'Hellwach' : t < 0.75 ? 'Gute Reflexe' : t < 0.9 ? 'Solide reagiert' : 'Gerade noch geschafft',
      zusatz: aus ? '' : 'Ø ' + sek(t),
      auswertung: {   // Reaktionszeit je Fahrt; nach einem Unfall sind die übrigen Fahrten grau
        zeilen: FAHRTEN.map((f, i) => {
          const e = ergebnisse.find(x => x.fahrt === i), name = `${f.kmh} km/h – ${WETTER[f.wetter]}`;
          if (!e && fehlstart && i === nr) return { name, anteil: 0, wert: 'Aus', schlecht: true };
          if (!e) return { name, anteil: null, wert: '–' };
          if (e.unfall) return { name, anteil: 0, wert: 'Unfall', schlecht: true };
          return { name, zusatz: e.zuFrueh ? '+' + String(Math.round(ZU_FRUEH * e.zuFrueh * 10) / 10).replace('.', ',') + ' s' : '', anteil: punkteAus(e.wertung) / 1000, wert: sek(e.wertung) };
        }),
      },
      verzoegerung: 200,
    });
  }

  // ---------- Ablauf ----------
  function schritt(dt) {
    const f = FAHRTEN[nr];
    phaseT += dt;
    blink = (performance.now() / 657) % 1 < 0.5;   // Takt wie die Blinker-Aufnahme
    wackeln = Math.max(0, wackeln - dt);

    if (phase === 'fahren') {
      s += v * dt;
      if (auto) auto.pos += auto.v * dt;
      if (phaseT >= tEreignis) gefahrBeginnt(f);
    } else if (phase === 'gefahr' || phase === 'bremsen') {
      if (phase === 'gefahr') gefahrT += dt;
      else v = Math.max(0, v - a * dt);
      s += v * dt;
      if (auto) { auto.v = Math.max(0, auto.v - a * dt); auto.pos += auto.v * dt; }
      if (f.gefahr === 'reh') rehX = Math.max(0, rehX - dt * 9);
      if (f.gefahr === 'ball') ballX -= dt * 4.5;
      if (abstand() <= 0.3) unfall(f);
      else if (phase === 'bremsen' && v === 0 && (!auto || auto.v === 0)) gestoppt(f);
      else if (phase === 'gefahr' && gefahrT > 6) unfall(f);
    } else if (phase === 'schreck' && phaseT > 1.6) {
      if (zuFruehGesamt >= ZU_FRUEH_MAX) schluss();
      else fahrtStarten();   // gleiche Fahrt noch einmal, neue Wartezeit
    }

    // Motor: dreht mit dem Tempo, beim Stand aus
    motor.stellen(phase === 'auswertung' || phase === 'aus' ? 0 : 0.4 + v / 28 * 0.6, 0.7 + v / 28 * 0.6);
    // Geräusche je nach Wetter, Warnblinker am Stauende
    const laeuft = phase !== 'aus';
    regen.stellen(laeuft && f.wetter === 'regen' ? 1 : 0);
    nacht.stellen(laeuft && f.wetter === 'nacht' ? 1 : 0);
    blinker.stellen(laeuft && f.gefahr === 'stau' && ziel != null ? 1 : 0);
    R_.anzeige(`Fahrt ${nr + 1}/${FAHRTEN.length} – ${f.kmh} km/h – ${WETTER[f.wetter]}`, ergebnisse.length ? 'Ø ' + sek(schnittZeit()) : '');
  }

  function gefahrBeginnt(f) {
    phase = 'gefahr'; gefahrT = 0;
    if (auto) { auto.bremst = true; return; }
    ziel = s + v0 * FAIR + bremsweg(f) + 1.5;
  }

  function gestoppt(f) {
    const platz = Math.max(0, abstand());
    zahlen = auswerten(f, false, platz);
    phase = 'auswertung'; phaseT = 0;
    R_.ton('gut');
  }

  function unfall(f) {
    if (reaktion == null) reaktion = gefahrT;     // nicht getippt: gilt die Zeit bis zum Aufprall
    v = 0; if (auto) auto.v = 0;
    wackeln = 0.5;
    zahlen = auswerten(f, true, 0);
    phase = 'auswertung'; phaseT = 0;
    R_.ton('crash'); R_.vibrieren([200, 80, 200]);
  }

  function auswerten(f, unfallJa, platz) {
    const e = {
      reaktion, unfall: unfallJa, platz,
      reaktionsweg: v0 * reaktion,
      bremsweg: bremsweg(f),
    };
    e.anhalteweg = e.reaktionsweg + e.bremsweg;
    e.fahrt = nr;
    e.zuFrueh = zuFrueh;
    e.wertung = reaktion + ZU_FRUEH * zuFrueh;   // zählt für Durchschnitt und Punkte
    ergebnisse.push(e);
    return e;
  }

  function schnittZeit() { return ergebnisse.reduce((x, e) => x + e.wertung, 0) / ergebnisse.length; }
  const sek = p => p.toFixed(2).replace('.', ',') + ' s';
  const meter = m => m.toFixed(1).replace('.', ',') + ' m';

  // ---------- Zeichnen ----------
  // Perspektive: Kamera 1,2 m über der Straße; y(z) = Horizont + P/z
  const AUGE = 1.2, NAH = 4.5;   // vorderster sichtbarer Punkt der Straße (Motorhaube verdeckt den Rest)
  let hz = 0, unten = 0, mitte = 0, PERS = 1;
  const yZ = z => hz + PERS / z;
  const mProM = z => PERS / (AUGE * z);   // Bildpunkte pro Meter in der Entfernung z
  const xZ = (x, z) => mitte + x * mProM(z);

  function zeichne(g, b, h) {
    B = b; H = h;
    const f = FAHRTEN[Math.min(nr, FAHRTEN.length - 1)];
    const ck = cockpitMasse();
    mitte = B / 2 + (wackeln > 0 ? Math.sin(wackeln * 60) * 8 * wackeln : 0);
    unten = ck.armaturen + 6;                          // Straße endet knapp unter dem Armaturenbrett
    hz = Math.max(60, ck.y + (unten - ck.y) * 0.3);    // Horizont im oberen Drittel der Windschutzscheibe
    PERS = (unten - hz) * NAH;

    rueckstrahler = [];
    himmel(g, f);
    strasse(g, f);
    gefahrZeichnen(g, f);
    wetterDarueber(g, f);
    cockpit(g, f, ck);
    texte(g, f);
  }

  // ---------- Bilder ----------
  const bild = datei => { const i = new Image(); i.src = 'bilder/' + datei; return i; };
  const fertig = i => i.complete && i.naturalWidth > 0;
  const LANDSCHAFT = bild('landschaft.webp');
  const LANDSCHAFT_HORIZONT = 415;    // Bildzeile der Augenhöhe im Panorama (2000 × 667)
  const BILD = { reh: bild('reh.webp'), ball: bild('ball.webp'), dreieck: bild('warndreieck.webp'), autoAn: bild('auto-hinten.webp'), autoAus: bild('auto-hinten-aus.webp') };

  // Graues Auto in eine Opel-Farbe umlackieren: nur helle, ungesättigte Flächen (Karosserie), Scheiben und Lichter bleiben
  const lackiert = {};
  function autoBild(farbe, an) {
    const quelle = an ? BILD.autoAn : BILD.autoAus;
    if (!fertig(quelle)) return null;
    const schluessel = farbe + an;
    if (lackiert[schluessel]) return lackiert[schluessel];
    const c = document.createElement('canvas');
    c.width = quelle.naturalWidth; c.height = quelle.naturalHeight;
    const k = c.getContext('2d');
    k.drawImage(quelle, 0, 0);
    const d = k.getImageData(0, 0, c.width, c.height), q = d.data;
    const z = [1, 3, 5].map(i => parseInt(farbe.slice(i, i + 2), 16));
    for (let j = 0; j < q.length; j += 4) {
      const r = q[j], gg = q[j + 1], b = q[j + 2];
      const hell = (r + gg + b) / 3, satt = Math.max(r, gg, b) - Math.min(r, gg, b);
      if (hell < 70 || satt > 40) continue;
      const t = Math.min(1, (hell - 70) / 40) * (1 - satt / 40);
      const faktor = hell / 150;
      for (let n = 0; n < 3; n++) q[j + n] += (Math.min(255, z[n] * faktor) - q[j + n]) * t;
    }
    k.putImageData(d, 0, 0);
    return (lackiert[schluessel] = c);
  }

  function himmel(g, f) {
    if (fertig(LANDSCHAFT)) {
      // Panorama so groß, dass es die Breite füllt und Augenhöhe auf dem Horizont liegt
      const iw = LANDSCHAFT.naturalWidth, ih = LANDSCHAFT.naturalHeight;
      const m = Math.max(B / iw, hz / LANDSCHAFT_HORIZONT, (H - hz) / (ih - LANDSCHAFT_HORIZONT));
      g.drawImage(LANDSCHAFT, (B - iw * m) / 2, hz - LANDSCHAFT_HORIZONT * m, iw * m, ih * m);
      const toenung = { regen: 'rgba(70,78,88,.6)', nebel: 'rgba(214,219,224,.7)', nacht: 'rgba(3,5,14,.9)' }[f.wetter];
      if (toenung) { g.fillStyle = toenung; g.fillRect(0, 0, B, H); }
      return;
    }
    const farben = {
      tag: ['#7fb6e8', '#d9ecf8'], regen: ['#7d8590', '#b8bec6'], nebel: ['#c9ced4', '#e4e7ea'], nacht: ['#05070f', '#141a2b'],
    }[f.wetter];
    const v = g.createLinearGradient(0, 0, 0, hz);
    v.addColorStop(0, farben[0]); v.addColorStop(1, farben[1]);
    g.fillStyle = v; g.fillRect(0, 0, B, hz + 1);
    // Wiese bis nach vorne
    const gras = { tag: ['#6a9a4a', '#3f7032'], regen: ['#566f47', '#334a2c'], nebel: ['#8fa088', '#5f7856'], nacht: ['#0c120c', '#1a2618'] }[f.wetter];
    const w = g.createLinearGradient(0, hz, 0, H);
    w.addColorStop(0, gras[0]); w.addColorStop(1, gras[1]);
    g.fillStyle = w; g.fillRect(0, hz, B, H - hz);
    // Waldrand am Horizont
    g.fillStyle = f.wetter === 'nacht' ? '#060a08' : f.wetter === 'nebel' ? '#a9b3ad' : '#2f5a32';
    g.beginPath(); g.moveTo(0, hz);
    for (let x = 0; x <= B; x += 18) g.lineTo(x, hz - 8 - Math.abs(Math.sin(x * 0.07 + 1.3)) * 14 - Math.abs(Math.sin(x * 0.023)) * 10);
    g.lineTo(B, hz); g.closePath(); g.fill();
  }

  // Gemalte Landstraße von oben (1024 × 1536, kachelbar): Randlinien bei Bildspalte 119 und 905, Mittellinie bei 511,5,
  // also 110,7 Bildpunkte pro Meter quer. Längs gestreckt auf 24 m pro Bild = zwei Strich-Abstände à 12 m.
  const STRASSE = bild('strasse.webp');
  const STRASSE_LINKS = -1.75 - 511.5 / 110.7, STRASSE_RECHTS = -1.75 + 512.5 / 110.7, STRASSE_LAENGE = 24;

  function strasseBild(g, f) {
    const iw = STRASSE.naturalWidth, ih = STRASSE.naturalHeight;
    // Zeile für Zeile: jede Bildschirmzeile zeigt die Straße in ihrer Entfernung z
    for (let y = Math.floor(hz) + 1; y < unten + 2; y++) {
      const z = PERS / (y + 0.5 - hz);
      if (z > 400) continue;
      const anteil = ((s + z) / STRASSE_LAENGE) % 1;
      const xl = xZ(STRASSE_LINKS, z), xr = xZ(STRASSE_RECHTS, z);
      g.drawImage(STRASSE, 0, (1 - anteil) * (ih - 1), iw, 1, xl, y, xr - xl, 1.2);
    }
    // In der Ferne verschwimmt der Asphalt (verhindert Flimmern der Striche)
    const zNah = 70, yNah = yZ(zNah);
    const dunst = g.createLinearGradient(0, hz, 0, yNah);
    dunst.addColorStop(0, 'rgba(118,120,122,.9)'); dunst.addColorStop(1, 'rgba(118,120,122,0)');
    g.fillStyle = dunst;
    g.beginPath();
    g.moveTo(xZ(-5.4, 400), yZ(400)); g.lineTo(xZ(1.9, 400), yZ(400));
    g.lineTo(xZ(1.9, zNah), yNah); g.lineTo(xZ(-5.4, zNah), yNah); g.closePath(); g.fill();
    // Wetter: nass dunkler mit Glanz, nachts fast schwarz
    const toenung = { regen: 'rgba(15,20,28,.38)', nacht: 'rgba(0,0,6,.55)' }[f.wetter];
    if (toenung) {
      g.fillStyle = toenung;
      g.beginPath();
      g.moveTo(xZ(STRASSE_LINKS, 400), yZ(400)); g.lineTo(xZ(STRASSE_RECHTS, 400), yZ(400));
      g.lineTo(xZ(STRASSE_RECHTS, NAH), yZ(NAH)); g.lineTo(xZ(STRASSE_LINKS, NAH), yZ(NAH)); g.closePath(); g.fill();
      if (f.wetter === 'regen') {
        const glanz = g.createLinearGradient(0, hz, 0, unten);
        glanz.addColorStop(0, 'rgba(220,230,240,.3)'); glanz.addColorStop(1, 'rgba(220,230,240,0)');
        g.fillStyle = glanz; g.fill();
      }
    }
  }

  function strasse(g, f) {
    const nass = f.wetter === 'regen', nacht = f.wetter === 'nacht';
    if (fertig(STRASSE)) {
      strasseBild(g, f);
      const lp = s % 25;
      for (let k = 16; k >= 0; k--) {
        const z = k * 25 - lp;
        if (z < NAH) continue;
        for (const x of [2.6, -6.1]) leitpfosten(g, xZ(x, z), yZ(z), mProM(z), nacht, x < 0);
      }
      for (const sch of [...schilder].sort((a, b) => b.pos - a.pos)) schild(g, sch, sch.pos - s);
      return;
    }
    // Fahrbahn: rechter Rand +2,1 m, Mittellinie −1,75 m, linker Rand −5,6 m (Kamera in der Mitte der rechten Spur)
    const zFern = 400;
    g.fillStyle = nacht ? '#15171b' : nass ? '#3a3e44' : '#55595f';
    g.beginPath();
    g.moveTo(xZ(-5.6, zFern), yZ(zFern)); g.lineTo(xZ(2.1, zFern), yZ(zFern));
    g.lineTo(xZ(2.1, NAH), yZ(NAH)); g.lineTo(xZ(-5.6, NAH), yZ(NAH)); g.closePath(); g.fill();
    if (nass) {   // nasser Glanz
      const glanz = g.createLinearGradient(0, hz, 0, unten);
      glanz.addColorStop(0, 'rgba(220,230,240,.35)'); glanz.addColorStop(1, 'rgba(220,230,240,0)');
      g.fillStyle = glanz; g.fill();
    }
    const linie = nacht ? 'rgba(235,235,225,.55)' : '#eeeeea';
    // Randlinien durchgehend
    g.strokeStyle = linie;
    for (const x of [-5.3, 1.8]) {
      g.lineWidth = 1; g.beginPath();
      for (let z = NAH; z < zFern; z *= 1.08) {
        const w = Math.max(1, 0.12 * mProM(z));
        g.fillStyle = linie; g.fillRect(xZ(x, z) - w / 2, yZ(z * 1.08), w, yZ(z) - yZ(z * 1.08) + 0.5);
      }
    }
    // Mittellinie gestrichelt, wandert mit der Fahrt
    g.fillStyle = linie;
    const versatz = s % 12;
    for (let k = 0; k < 40; k++) {
      const z1 = k * 12 - versatz, z2 = z1 + 4;
      if (z2 < NAH) continue;
      const a1 = Math.max(NAH, z1);
      const y1 = yZ(a1), y2 = yZ(z2), w1 = 0.12 * mProM(a1), w2 = 0.12 * mProM(z2);
      g.beginPath();
      g.moveTo(xZ(-1.75, a1) - w1 / 2, y1); g.lineTo(xZ(-1.75, a1) + w1 / 2, y1);
      g.lineTo(xZ(-1.75, z2) + w2 / 2, y2); g.lineTo(xZ(-1.75, z2) - w2 / 2, y2); g.closePath(); g.fill();
    }
    // Leitpfosten alle 25 m, von hinten nach vorne
    const lp = s % 25;
    for (let k = 16; k >= 0; k--) {
      const z = k * 25 - lp;
      if (z < NAH) continue;
      for (const x of [2.6, -6.1]) leitpfosten(g, xZ(x, z), yZ(z), mProM(z), nacht, x < 0);
    }
  }

  // Deutsche Leitpfosten (gemalt): rechts ein länglicher Rückstrahler, links zwei runde.
  // Lage der Rückstrahler im Bild (Anteil der Höhe von oben), damit sie nachts leuchten können
  const PFOSTEN = { rechts: bild('leitpfosten-rechts.webp'), links: bild('leitpfosten-links.webp') };
  const STRAHLER = { rechts: [[0.27, 0.07]], links: [[0.22, 0.035], [0.317, 0.035]] };
  let rueckstrahler = [];   // nachts gesammelt, nach dem Abdunkeln als Lichtpunkte gezeichnet

  // Verkehrsschilder (gemalt, auf Pfosten): 3 m hoch, Pfosten-Fuß in der Bildmitte, 3,4 m rechts der Kamera
  const SCHILD = {};
  for (const n of ['tempo-30', 'tempo-50', 'tempo-70', 'tempo-100', 'wildwechsel', 'kinder', 'stau']) SCHILD[n] = bild('schild-' + n + '.webp');
  const WERBUNG = bild('werbeschild.webp');   // leere Tafel (ChatGPT) mit Logo und „Ihr Opel-Partner – 2 km“
  function schild(g, sch, z) {
    if (z < NAH || z > 300 || !sch.bild || !fertig(sch.bild)) return;
    const m = mProM(z), h = (sch.hoehe || 3.0) * m, w = h * sch.bild.naturalWidth / sch.bild.naturalHeight;
    g.drawImage(sch.bild, xZ(sch.x || 3.4, z) - w / 2, yZ(z) - h, w, h);
  }

  function leitpfosten(g, x, y, m, nacht, links) {
    const seite = links ? 'links' : 'rechts', bildP = PFOSTEN[seite];
    if (fertig(bildP)) {
      const h = 1.0 * m, w = h * bildP.naturalWidth / bildP.naturalHeight;
      g.drawImage(bildP, x - w / 2, y - h, w, h);
      if (nacht && h > 6) for (const [yy, r] of STRAHLER[seite]) rueckstrahler.push([x, y - h + h * yy, Math.max(1.2, h * r * 1.6)]);
      return;
    }
    const h = 1.0 * m, w = Math.max(1.5, 0.12 * m);
    g.fillStyle = nacht ? '#3a3a3a' : '#f4f4f4';
    g.fillRect(x - w / 2, y - h, w, h);
    g.fillStyle = '#111';
    g.fillRect(x - w / 2, y - h * 0.8, w, h * 0.25);
    g.fillStyle = nacht ? '#ffd27a' : '#e8e8e8';   // Rückstrahler leuchtet nachts
    g.fillRect(x - w / 2, y - h * 0.75, w, h * 0.12);
  }

  // ---------- Gefahren (gemalte Bilder, gezeichneter Ersatz solange sie laden) ----------
  function gefahrZeichnen(g, f) {
    if (auto) return autoHinten(g, -0, auto.pos - s, auto.farbe, auto.bremst, false);
    if (ziel == null) return;
    const z = ziel - s;
    if (z < 1) return;
    if (f.gefahr === 'reh') reh(g, rehX, z);
    else if (f.gefahr === 'ball') ball(g, ballX, z);
    else if (f.gefahr === 'stau') {
      autoHinten(g, -3.5, z + 6, AUTOFARBEN[(nr + 2) % 6], true, true);
      autoHinten(g, 0, z, AUTOFARBEN[(nr + 3) % 6], true, true);
      warndreieck(g, 1.2, z - 25);
    }
  }

  function autoHinten(g, x, z, farbe, bremst, warn) {
    if (z < 1.5) z = 1.5;
    const m = mProM(z), w = 1.8 * m, h = 1.5 * m, cx = xZ(x, z), y = yZ(z);
    const bildAuto = autoBild(farbe, bremst);
    if (bildAuto) {
      const bh = w * bildAuto.height / bildAuto.width;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx, y - bh * 0.01, w * 0.55, bh * 0.05, 0, 0, P * 2); g.fill();
      g.drawImage(bildAuto, cx - w / 2, y - bh, w, bh);
      // Licht strahlt: Bremslichter rot, Warnblinker orange (Lichter bei 40 % Höhe, 17 % und 83 % Breite)
      g.save(); g.globalCompositeOperation = 'lighter';
      const glanz = (farbe2, r, mitDritter) => { for (const [lx, ly] of [[0.17, 0.4], [0.83, 0.4]].concat(mitDritter ? [[0.5, 0.08]] : [])) { const px = cx - w / 2 + w * lx, py = y - bh + bh * ly; const v = g.createRadialGradient(px, py, 0, px, py, r); v.addColorStop(0, farbe2); v.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = v; g.fillRect(px - r, py - r, r * 2, r * 2); } };
      if (bremst) { glanz('rgba(255,30,10,.95)', w * 0.3, true); glanz('rgba(255,120,90,.6)', w * 0.1, true); }
      if (warn && blink) glanz('rgba(255,160,20,.9)', w * 0.16);
      g.restore();
      return;
    }
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(cx - w * 0.52, y - h * 0.08, w * 1.04, h * 0.1);
    g.fillStyle = farbe;
    g.beginPath(); g.roundRect(cx - w / 2, y - h, w, h * 0.92, h * 0.12); g.fill();
    g.fillStyle = 'rgba(25,32,45,.9)';
    g.beginPath(); g.roundRect(cx - w * 0.38, y - h * 0.93, w * 0.76, h * 0.32, h * 0.06); g.fill();
    g.fillStyle = '#222'; g.fillRect(cx - w * 0.5, y - h * 0.16, w, h * 0.12);
    const an = bremst, lichtW = w * 0.2, lichtH = h * 0.1;
    g.fillStyle = an ? '#ff2a1a' : '#8a1a14';
    g.fillRect(cx - w * 0.47, y - h * 0.5, lichtW, lichtH); g.fillRect(cx + w * 0.27, y - h * 0.5, lichtW, lichtH);
    if (an) { g.fillStyle = 'rgba(255,40,20,.35)'; g.beginPath(); g.ellipse(cx, y - h * 0.45, w * 0.7, h * 0.25, 0, 0, P * 2); g.fill(); }
    if (warn && blink) {
      g.fillStyle = '#ffae1a';
      g.fillRect(cx - w * 0.47, y - h * 0.39, lichtW * 0.6, lichtH * 0.8); g.fillRect(cx + w * 0.35, y - h * 0.39, lichtW * 0.6, lichtH * 0.8);
    }
  }
  function reh(g, x, z) {
    const m = mProM(z), cx = xZ(x, z), y = yZ(z);
    if (fertig(BILD.reh)) {
      // springt von rechts nach links: Bild gespiegelt, 1,6 m lang, leichter Sprungbogen
      const w = 1.6 * m, h = w * BILD.reh.naturalHeight / BILD.reh.naturalWidth;
      const sprung = Math.abs(Math.sin(x * 1.4)) * 0.35 * m;
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(cx, y, w * 0.35, w * 0.05, 0, 0, P * 2); g.fill();
      g.save(); g.translate(cx, y - sprung); g.scale(-1, 1);
      g.drawImage(BILD.reh, -w / 2, -h, w, h);
      g.restore();
      return;
    }
    g.fillStyle = '#8a5a32';
    g.beginPath(); g.ellipse(cx, y - 0.85 * m, 0.7 * m, 0.28 * m, 0, 0, P * 2); g.fill();
    g.fillRect(cx - 0.55 * m, y - 0.8 * m, 0.08 * m, 0.8 * m); g.fillRect(cx + 0.45 * m, y - 0.8 * m, 0.08 * m, 0.8 * m);
    g.beginPath(); g.ellipse(cx - 0.75 * m, y - 1.25 * m, 0.16 * m, 0.22 * m, -0.4, 0, P * 2); g.fill();
    g.fillStyle = '#f2e6d0'; g.beginPath(); g.ellipse(cx + 0.68 * m, y - 0.9 * m, 0.1 * m, 0.12 * m, 0, 0, P * 2); g.fill();
  }
  function ball(g, x, z) {
    const m = mProM(z), r = 0.22 * m, cx = xZ(x, z), y = yZ(z) - r;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx, yZ(z), r, r * 0.25, 0, 0, P * 2); g.fill();
    if (fertig(BILD.ball)) {   // rollt nach links
      g.save(); g.translate(cx, y); g.rotate(-x / 0.22);
      g.drawImage(BILD.ball, -r, -r, r * 2, r * 2);
      g.restore();
      return;
    }
    g.fillStyle = '#e3241b'; g.beginPath(); g.arc(cx, y, r, 0, P * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(cx - r * 0.35, y - r * 0.35, r * 0.3, 0, P * 2); g.fill();
  }
  function warndreieck(g, x, z) {
    if (z < NAH) return;
    const m = mProM(z), cx = xZ(x, z), y = yZ(z), h = 0.5 * m;
    if (fertig(BILD.dreieck)) {
      const w = h * BILD.dreieck.naturalWidth / BILD.dreieck.naturalHeight;
      g.drawImage(BILD.dreieck, cx - w / 2, y - h, w, h);
      return;
    }
    g.strokeStyle = '#e3241b'; g.lineWidth = Math.max(1.5, 0.08 * m);
    g.beginPath(); g.moveTo(cx, y - h); g.lineTo(cx + h * 0.58, y); g.lineTo(cx - h * 0.58, y); g.closePath(); g.stroke();
  }

  // Regen, Nebel, Nacht über die Szene legen
  function wetterDarueber(g, f) {
    if (f.wetter === 'nebel') {
      // dichter Nebel in der Ferne, nach vorne klarer: Sichtweite etwa 40 m
      const v = g.createLinearGradient(0, hz - 40, 0, yZ(8));
      v.addColorStop(0, 'rgba(225,229,233,.97)'); v.addColorStop(0.55, 'rgba(225,229,233,.9)'); v.addColorStop(1, 'rgba(225,229,233,0)');
      g.fillStyle = v; g.fillRect(0, 0, B, yZ(8));
    } else if (f.wetter === 'nacht') {
      // Scheinwerferkegel: vorne hell, dahinter dunkel
      const d = g.createLinearGradient(0, hz, 0, unten);
      d.addColorStop(0, 'rgba(0,0,8,.92)'); d.addColorStop(0.35, 'rgba(0,0,8,.55)'); d.addColorStop(1, 'rgba(0,0,8,.05)');
      g.fillStyle = d; g.fillRect(0, hz - 30, B, unten - hz + 30);
      // Rückstrahler der Leitpfosten leuchten im Scheinwerferlicht
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [x, y, r] of rueckstrahler) {
        const v = g.createRadialGradient(x, y, 0, x, y, r * 2.2);
        v.addColorStop(0, 'rgba(255,240,215,.95)'); v.addColorStop(0.35, 'rgba(255,225,180,.45)'); v.addColorStop(1, 'rgba(255,210,150,0)');
        g.fillStyle = v; g.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
      }
      g.restore();
    } else if (f.wetter === 'regen') {
      g.strokeStyle = 'rgba(220,230,245,.45)'; g.lineWidth = 1;
      const t = performance.now() / 1000;
      g.beginPath();
      for (let i = 0; i < 90; i++) {
        const x = (i * 97.3 + t * 40) % B, y = (i * 53.7 + t * 900) % unten;
        g.moveTo(x, y); g.lineTo(x - 3, y + 14);
      }
      g.stroke();
    }
  }

  // ---------- Cockpit ----------
  const COCKPIT = new Image();
  COCKPIT.src = 'bilder/cockpit.webp';
  // Lage im Cockpit-Bild (Anteile von Breite/Höhe): Unterkante der Windschutzscheibe, Mitte des Tachos
  const SCHEIBE_UNTEN = 0.46, TACHO = [0.44, 0.6], LENKRAD = [0.426, 0.77];
  // Zeichen in der Lenkradmitte (z. B. das „Z“ aus dem Logo), in kunde.js als lenkradLogo
  // Bildschirm der Mittelkonsole im Cockpit-Bild (Anteile von Breite/Höhe: links, oben, rechts, unten)
  const BILDSCHIRM = bild('bildschirm.webp'), BILDSCHIRM_FLAECHE = [0.6495, 0.5175, 0.8725, 0.6535];
  const LENKRADLOGO = new Image();
  if (R_.kunde.lenkradLogo) LENKRADLOGO.src = R_.kunde.lenkradLogo;

  function cockpitMasse() {
    // Das Cockpit füllt die Breite (auf schmalen Handys etwas breiter, damit Lenkrad und Tacho groß genug sind) und sitzt unten
    const w = Math.max(B, H * 0.95), h = w * 2 / 3;
    return { x: (B - w) / 2, y: H - h, w, h, armaturen: H - h + h * SCHEIBE_UNTEN };
  }

  let dachStreifen = null;
  function cockpit(g, f, ck) {
    if (COCKPIT.complete && COCKPIT.naturalWidth) {
      g.drawImage(COCKPIT, ck.x, ck.y, ck.w, ck.h);
      // Hohe Handys: über dem Bild fehlt das Dach – die oberste Bildzeile (Dachhimmel) nach oben verlängern
      if (ck.y > 0) {
        if (!dachStreifen) {   // oberste Zeile stark verkleinert = weicher Verlauf ohne Streifen
          dachStreifen = document.createElement('canvas'); dachStreifen.width = 24; dachStreifen.height = 1;
          dachStreifen.getContext('2d').drawImage(COCKPIT, 0, 2, COCKPIT.naturalWidth, 1, 0, 0, 24, 1);
        }
        g.drawImage(dachStreifen, ck.x, 0, ck.w, ck.y + 1);
        const v = g.createLinearGradient(0, 0, 0, ck.y);
        v.addColorStop(0, 'rgba(0,0,0,.35)'); v.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = v; g.fillRect(0, 0, B, ck.y + 1);
      }
    } else {
      // Platzhalter: Armaturenbrett, A-Säulen, Lenkrad
      g.fillStyle = '#16181b';
      g.beginPath(); g.moveTo(0, ck.armaturen + 10); g.quadraticCurveTo(B / 2, ck.armaturen - 20, B, ck.armaturen + 10); g.lineTo(B, H); g.lineTo(0, H); g.closePath(); g.fill();
      g.fillStyle = '#1e2125';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(B * 0.08, 0); g.lineTo(B * 0.02, ck.armaturen); g.lineTo(0, ck.armaturen); g.fill();
      g.beginPath(); g.moveTo(B, 0); g.lineTo(B * 0.92, 0); g.lineTo(B * 0.98, ck.armaturen); g.lineTo(B, ck.armaturen); g.fill();
      g.strokeStyle = '#0b0c0e'; g.lineWidth = ck.w * 0.035;
      g.beginPath(); g.ellipse(ck.x + ck.w * LENKRAD[0], ck.y + ck.h * LENKRAD[1], ck.w * 0.17, ck.h * 0.25, 0, P * 1.05, P * 1.95); g.stroke();
      g.fillStyle = '#0b0c0e';
      g.beginPath(); g.ellipse(ck.x + ck.w * LENKRAD[0], ck.y + ck.h * LENKRAD[1], ck.w * 0.055, ck.h * 0.065, 0, 0, P * 2); g.fill();
    }
    // Foto vom Autohaus auf dem Bildschirm in der Mittelkonsole (füllt die Fläche, leicht gedimmt, mit Glas-Spiegelung)
    if (fertig(BILDSCHIRM) && fertig(COCKPIT)) {
      const [x0, y0, x1, y1] = BILDSCHIRM_FLAECHE;
      const x = ck.x + ck.w * x0, y = ck.y + ck.h * y0, w = ck.w * (x1 - x0), h = ck.h * (y1 - y0);
      const iw = BILDSCHIRM.naturalWidth, ih = BILDSCHIRM.naturalHeight, m = Math.max(w / iw, h / ih);
      const qw = w / m, qh = h / m;
      g.save();
      g.beginPath(); g.roundRect(x, y, w, h, ck.w * 0.004); g.clip();
      g.drawImage(BILDSCHIRM, (iw - qw) / 2, (ih - qh) / 2, qw, qh, x, y, w, h);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, y, w, h);
      const glanz = g.createLinearGradient(x, y, x + w * 0.6, y + h);
      glanz.addColorStop(0, 'rgba(255,255,255,.16)'); glanz.addColorStop(0.45, 'rgba(255,255,255,.03)'); glanz.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = glanz; g.fillRect(x, y, w, h);
      g.restore();
    }
    if (LENKRADLOGO.complete && LENKRADLOGO.naturalWidth) {
      const lw = ck.w * 0.06, lh = lw * LENKRADLOGO.naturalHeight / LENKRADLOGO.naturalWidth;
      g.drawImage(LENKRADLOGO, ck.x + ck.w * LENKRAD[0] - lw / 2, ck.y + ck.h * LENKRAD[1] - lh / 2, lw, lh);
    }
    // Scheibenwischer bei Regen
    if (f.wetter === 'regen') {
      const t = (performance.now() / 1300) % 1, w = Math.sin(t * P) * 1.25;
      g.strokeStyle = '#0d0e10'; g.lineWidth = Math.max(3, ck.w * 0.006); g.lineCap = 'round';
      for (const [px, l] of [[0.3, 0.42], [0.62, 0.38]]) {
        const x0 = ck.x + ck.w * px, y0 = ck.armaturen;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(P + 0.15 + w) * ck.w * l * -1, y0 - Math.sin(0.15 + w) * ck.w * l); g.stroke();
      }
    }
    // Digitaler Tacho
    const tx = ck.x + ck.w * TACHO[0], ty = ck.y + ck.h * TACHO[1], fs = Math.max(13, ck.w * 0.028);
    g.fillStyle = '#e8f1ff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${fs}px ${SCHRIFT}`;
    g.fillText(Math.round(v * 3.6), tx, ty);
    g.font = `600 ${fs * 0.45}px ${SCHRIFT}`;
    g.fillText('km/h', tx, ty + fs * 0.75);
  }

  // ---------- Texte über der Szene ----------
  function texte(g, f) {
    const fs = Math.max(18, Math.min(30, B * 0.055));
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const zeile = (txt, y, groesse, farbe) => {
      g.font = `900 ${groesse}px ${SCHRIFT}`;
      g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(txt, B / 2, y);
      g.fillStyle = farbe; g.fillText(txt, B / 2, y);
    };
    if (R_.zustand !== 'spiel') return;
    if (phase === 'fahren' && phaseT < 1.8) {
      zeile(`Fahrt ${nr + 1}: ${f.kmh} km/h – ${WETTER[f.wetter]}`, hz * 0.45 + 30, fs, '#fff');
      if (nr === 0) zeile('Tippe, sobald Gefahr droht!', hz * 0.45 + 30 + fs * 1.3, fs * 0.7, F.akzent);
    }
    if (phase === 'schreck') {
      zeile('Zu früh!', hz * 0.5 + 30, fs * 1.3, '#ffb347');
      zeile(zuFruehGesamt >= ZU_FRUEH_MAX ? zuFruehGesamt + '× zu früh – Schluss!' : '+' + String(ZU_FRUEH).replace('.', ',') + ' s', hz * 0.5 + 30 + fs * 1.5, fs * 0.8, '#ffb347');
    }
    if (phase === 'auswertung' && zahlen) karte(g, zahlen, fs);
  }

  // Auswertung wie in der Fahrschule
  function karte(g, e, fs) {
    const w = Math.min(B - 32, 360), zeilen = 5, zh = fs * 0.95, h = fs * 1.8 + zeilen * zh + fs * 1.6;
    const x = (B - w) / 2, y = Math.max(56, (cockpitMasse().armaturen - h) / 2);
    g.fillStyle = 'rgba(13,13,13,.9)';
    g.strokeStyle = F.haupt; g.lineWidth = 2;
    g.beginPath(); g.roundRect(x, y, w, h, 16); g.fill(); g.stroke();
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.font = `900 ${fs}px ${SCHRIFT}`;
    g.fillStyle = e.unfall ? '#ff6b6b' : '#7bd88f';
    g.fillText(e.unfall ? 'Unfall!' : 'Rechtzeitig!', B / 2, y + fs * 0.95);
    const posten = [
      ['Reaktionszeit', e.zuFrueh ? sek(e.reaktion) + ' + ' + sek(ZU_FRUEH * e.zuFrueh) : sek(e.reaktion)],
      ['Reaktionsweg', meter(e.reaktionsweg)],
      ['Bremsweg', meter(e.bremsweg)],
      ['Anhalteweg', meter(e.anhalteweg)],
      [e.unfall ? 'Platz' : 'Noch Platz', e.unfall ? '–' : meter(e.platz)],
    ];
    g.font = `600 ${fs * 0.62}px ${SCHRIFT}`;
    posten.forEach(([l, r], i) => {
      const yy = y + fs * 1.9 + i * zh;
      g.textAlign = 'left'; g.fillStyle = i === 3 ? F.akzent : '#d7d7d7'; g.fillText(l, x + 18, yy);
      g.textAlign = 'right'; g.fillStyle = i === 3 ? F.akzent : '#fff'; g.fillText(r, x + w - 18, yy);
    });
    g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.65)';
    g.font = `600 ${fs * 0.55}px ${SCHRIFT}`;
    g.fillText(nr < FAHRTEN.length - 1 && !e.unfall ? 'Tippen für die nächste Fahrt' : 'Tippen für das Ergebnis', B / 2, y + h - fs * 0.7);
  }

  const motor = R_.dauerton('motor'), regen = R_.dauerton('regen'), nacht = R_.dauerton('nacht'), blinker = R_.dauerton('blinker');

  R_.spiel({
    id: 'bremsen',   // neuer Name: Bestwerte zählen seit der Umstellung auf 1.000 Punkte neu
    wertung: 'hoch',
    format: p => p.toLocaleString('de-DE') + ' Punkte',
    hoechst: 1000,
    texte: {
      titel: 'Bremsen',
      untertitel: 'Wie sicher reagierst du?',
      anleitung: 'Probefahrt. Plötzlich taucht eine Gefahr auf. Tippe so schnell wie möglich, um zu bremsen. Zu früh gebremst: +0,2 s, beim dritten Mal ist Schluss. Sechs Fahrten: bei Regen, Nebel und Nacht. Ein Unfall – und aus.',
      ende: 'Gute Reflexe brauchen gute Bremsen.',
    },
    // Aufnahmen (Pixabay Content License)
    klaenge: {
      klick: { datei: 'klaenge/klick.wav', pegel: 0.35 },
      crash: { datei: 'klaenge/crash.mp3', proben: 58433, pegel: 0.55 },
      motor: { datei: 'klaenge/motor-fahrt.mp3', proben: 242550, pegel: 0.3 },
      bremsen: { datei: 'klaenge/bremsen.wav', pegel: 0.5 },
      hupe: { datei: 'klaenge/hupe.wav', pegel: 0.35 },
      gut: { datei: 'klaenge/gut.wav', pegel: 0.4 },
      regen: { datei: 'klaenge/regen.mp3', proben: 242550, pegel: 0.35 },
      nacht: { datei: 'klaenge/nacht.mp3', proben: 242550, pegel: 0.3 },
      blinker: { datei: 'klaenge/blinker.mp3', proben: 43473, pegel: 0.3 },
      musik: { datei: 'klaenge/musik.mp3', proben: 606375, pegel: 0.07 },   // leise Hintergrundmusik (Pixabay, Red Skies – Late Night Ride)
      sieg: { datei: 'klaenge/sieg.mp3', proben: 71663, pegel: 0.45 },
      bestwert: { datei: 'klaenge/bestwert.mp3', proben: 37485, pegel: 0.4 },
    },
    schleife: 'musik',
    neu, schritt, zeichne, runter, groesse(b, h) { B = b; H = h; },
  });
})();
