// Bremstest: Aus dem Cockpit eine Landstraße entlangfahren. Plötzlich taucht eine Gefahr auf – sofort tippen = Vollbremsung.
// Danach zeigt das Spiel Reaktionszeit, Reaktionsweg, Bremsweg und Anhalteweg wie in der Fahrschule.
// Sieben Fahrten, immer schwieriger (Tempo, Regen, Nebel, Nacht, tief stehende Sonne). Wertung: durchschnittliche Reaktionszeit.
(function () {
  'use strict';
  const R_ = Rahmen, F = R_.farben;
  const SCHRIFT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const P = Math.PI;

  // ---------- Fahrten ----------
  // gefahr: reh | hase | ball | auto (bremst vor einem) | stau (Stauende mit Warnblinker) | ladung (LKW vor einem verliert Holz)
  const FAHRTEN = [
    { kmh: 30, wetter: 'tag', gefahr: 'ball', umgebung: 'wohngebiet', geraeusch: 'kinder' },   // eigene Umgebung (Nutzer, 19.10.2026)
    { kmh: 50, wetter: 'tag', gefahr: 'hase', geraeusch: 'voegel' },   // Hase statt Reh (Nutzer, 18.10.2026), das Reh bleibt in Fahrt 5
    { kmh: 50, wetter: 'regen', gefahr: 'auto', umgebung: 'obstwiese' },
    { kmh: 70, wetter: 'tag', gefahr: 'stau', steigung: 8, kuppe: 12.5, geraeusch: 'voegel' },   // Nutzer 19.10.2026: bergauf, Stauende 12,5 m hinter der Kuppe
    { kmh: 70, wetter: 'nebel', gefahr: 'reh', umgebung: 'wald', geraeusch: 'wald' },
    { kmh: 100, wetter: 'nacht', gefahr: 'stau' },
    { kmh: 100, wetter: 'sonne', gefahr: 'ladung', steigung: -12, umgebung: 'tal', geraeusch: 'wald' },   // Fahrt 7 (Nutzer, 18.10.2026): 12 % Gefälle (19.10.2026), blendende Sonne, Sonnenblende, LKW verliert Ladung
  ];
  // geraeusch: Hintergrund draußen (voegel | wald | kinder), leise und gedämpft wie durch die geschlossene Scheibe (Nutzer, 19.10.2026)
  const WETTER = { tag: 'trocken', regen: 'Regen', nebel: 'Nebel', nacht: 'Nacht', sonne: 'Sonne' };
  const NASS = 1.5;          // Bremsweg bei Nässe 1,5-mal so lang
  const FAIR = 0.9;          // bei 0,9 s Reaktionszeit reicht der Platz gerade noch
  const AUTOFARBEN = ['#b9bdc0', '#2f63c6', '#f2f3f1', '#5f6366', '#e2622f', '#1d1f22'];   // Opel-Lackfarben

  // Fahrschul-Faustformel: Bremsweg bei Gefahrenbremsung = (km/h / 10)² / 2, bei Nässe länger.
  // Steigung (+) bzw. Gefälle (−) in Prozent: Verzögerung a = a0·cos θ + g·sin θ – bergauf hilft die Schwerkraft, bergab bremst sie dagegen
  const bremsweg = f => {
    const s0 = (f.kmh / 10) ** 2 / 2 * (f.wetter === 'regen' ? NASS : 1);
    if (!f.steigung) return s0;
    const ms = f.kmh / 3.6, a0 = ms * ms / (2 * s0), th = Math.atan(f.steigung / 100);
    return ms * ms / (2 * (a0 * Math.cos(th) + 9.81 * Math.sin(th)));
  };
  // Kuppe: so weit vor dem Stau, dass die Dächer (1,5 m) genau dann über den Kamm ragen, wenn die Gefahr beginnt
  const KUPPE_DACH = 1.5;
  const kuppenSicht = f => { const q = f.steigung / 100, d = f.kuppe; return AUGE / (2 * q - KUPPE_DACH / d) + d; };

  // ---------- Zustand ----------
  let schilder = [], baeume = [];
  let haseX = -6;
  let kuppe = null;   // Weltposition der Kuppe (nur Fahrt mit kuppe)
  let nr, phase, phaseT, s, v, v0, a, tEreignis, gefahrT, reaktion, ziel, auto, lkw, holzT, hoelzer = [], staub = [], splitter = [], ergebnisse, zuFrueh, zuFruehGesamt, wackeln, rehX, ballX, zahlen, blink;
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
    umgebungLaden(f); umgebungLaden(FAHRTEN[nr + 1]);   // diese und die nächste Umgebung im Hintergrund laden
    tEreignis = 2.6 + Math.random() * 3.4;             // Gefahr kommt nach 2,6 bis 6 Sekunden
    gefahrT = 0; reaktion = null; ziel = null; wackeln = 0; zahlen = null;
    rehX = 4.5; ballX = 3.2; haseX = -6;
    // Schilder am rechten Rand: erst das Tempo, dann die Warnung vor der Gefahr (wie in der Fahrschule)
    const warnung = { reh: 'wildwechsel', hase: 'wildwechsel', ball: 'kinder', stau: 'stau' }[f.gefahr];
    // Abstände nach dem frühesten Ort der Gefahr: Warnschild bei 80 %, Tempo-Schild bei 40 % (mindestens 20 m)
    const fruehesteGefahr = v0 * (2.6 + FAIR) + bremsweg(f) + 1.5;
    schilder = [{ bild: SCHILD['tempo-' + f.kmh], pos: Math.max(20, fruehesteGefahr * 0.4) }];
    if (warnung) schilder.push({ bild: SCHILD[warnung], pos: fruehesteGefahr * 0.8 });
    // Steigung bzw. Gefälle: Schild ganz vorne, noch vor dem Tempo-Schild (Fahrt 4: 8 %, Fahrt 7: 12 %)
    if (f.steigung) schilder.push({ bild: SCHILD[f.steigung > 0 ? 'steigung' : 'gefaelle'], pos: Math.max(14, fruehesteGefahr * 0.2) });
    // Werbeschild vom Autohaus links am Rand (4,5 m breit), weit vorne, damit es auch auf dem Handy lange ganz im Bild ist
    // Entfernung zum Autohaus wird jede Fahrt kürzer: Fahrt 1 noch 8 km, Fahrt 7 noch 2 km (Nutzer, 19.10.2026)
    schilder.push({ bild: WERBUNG, km: 8 - nr, pos: Math.max(70, fruehesteGefahr * 0.7), x: -7.6, hoehe: 3.2 });
    baeume = baeumePflanzen(f);   // erst nach allen Schildern, damit kein Baum an einem Schild steht
    // vorausfahrendes Auto (nur bei „auto“): fährt im Abstand vor einem her
    auto = f.gefahr === 'auto' ? { pos: v0 * FAIR + 2, v: v0, bremst: false, farbe: AUTOFARBEN[nr % AUTOFARBEN.length] } : null;
    // LKW mit offener Ladetür (nur bei „ladung“): fährt so weit vorne, dass das herunterfallende Holz fair liegt
    // (+8 m: die einzelnen Kanthölzer fallen hinter ihm herunter und rutschen bis vor die faire Stelle)
    lkw = f.gefahr === 'ladung' ? { pos: v0 * FAIR + bremsweg(f) + 8, v: v0 } : null;
    holzT = 0; hoelzer = []; staub = []; splitter = [];
    // Kuppe: der Stau steht von Anfang an fest (hinter dem Kamm verborgen) und taucht auf, wenn die Gefahr beginnt
    kuppe = null; stauSichtbar = false;
    if (f.kuppe) { ziel = v0 * tEreignis + kuppenSicht(f); kuppe = ziel - f.kuppe; }
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
  const PUNKTE = [[0.4, 1000], [0.5, 900], [0.6, 800], [0.75, 700], [0.9, 550], [1.5, 150], [2, 1]];   // ab Ø 2s nur noch 1 Punkt
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
    const punkte = aus ? 0 : punkteAus(t);   // Bewertung nach Punkten, gemeinsame Grenzen 900/800/700/550
    R_.ende(punkte, {
      ueberschrift: unfall ? 'Nicht unfallfrei' : fehlstart ? 'Zu oft zu früh' : punkte >= 900 ? 'Blitzschnell' : punkte >= 800 ? 'Hellwach' : punkte >= 700 ? 'Gute Reflexe' : punkte >= 550 ? 'Solide reagiert' : 'Gerade noch geschafft',
      zusatz: aus ? '' : 'Ø ' + sek(t),
      auswertung: {   // Reaktionszeit je Fahrt; nach einem Unfall sind die übrigen Fahrten grau
        zeilen: FAHRTEN.map((f, i) => {
          const e = ergebnisse.find(x => x.fahrt === i), name = `${f.kmh} km/h – ${WETTER[f.wetter]}`;
          if (!e && fehlstart && i === nr) return { name, anteil: 0, wert: 'Aus', schlecht: true };
          if (!e) return { name, anteil: null, wert: '–' };
          if (e.unfall) return { name, anteil: 0, wert: 'Unfall', schlecht: true };
          return { name, zusatz: e.zuFrueh ? '+' + String(Math.round(ZU_FRUEH * e.zuFrueh * 10) / 10).replace('.', ',') + 's' : '', anteil: punkteAus(e.wertung) / 1000, wert: sek(e.wertung) };
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
      if (lkw) lkw.pos += lkw.v * dt;
      if (phaseT >= tEreignis || stauSichtbar) gefahrBeginnt(f);   // Kuppe: Gefahr beginnt, sobald etwas vom Stau über den Kamm ragt
    } else if (phase === 'gefahr' || phase === 'bremsen') {
      if (phase === 'gefahr') gefahrT += dt;
      else v = Math.max(0, v - a * dt);
      s += v * dt;
      if (auto) { auto.v = Math.max(0, auto.v - a * dt); auto.pos += auto.v * dt; }
      if (lkw) { lkw.v += 3 * dt; lkw.pos += lkw.v * dt; holzT += dt; hoelzerBewegen(dt); }
      // Fahrt 7: Bremsquietschen über die ganze lange Bremsung bergab (Klang ist nur 1 s lang, ging im Poltern unter – Nutzer, 19.10.2026)
      if (lkw && phase === 'bremsen' && v > 4 && Math.floor((phaseT - dt) / 0.95) < Math.floor(phaseT / 0.95)) R_.ton('bremsen');   // der LKW fährt weiter, die Kanthölzer fallen, prallen auf und rutschen
      if (f.gefahr === 'reh') rehX = Math.max(0, rehX - dt * 9);
      if (f.gefahr === 'hase') haseX = Math.min(0, haseX + dt * 10);   // kommt von links
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
    for (const [name, d] of Object.entries(draussen)) d.stellen(laeuft && f.geraeusch === name ? 1 : 0);
    // Scheibenwischer: bei jedem Wischen (Anfang des Takts, wie im Bild) einmal das Geräusch
    const wt = (performance.now() / 1000) % WISCH.periode;
    if (laeuft && f.wetter === 'regen' && wt < wischVorher) R_.ton('wischer');
    wischVorher = wt;
    blinker.stellen(laeuft && f.gefahr === 'stau' && ziel != null && (kuppe == null || phase !== 'fahren') ? 1 : 0);
    R_.anzeige(`Fahrt ${nr + 1}/${FAHRTEN.length} – ${f.kmh} km/h – ${WETTER[f.wetter]}`, ergebnisse.length ? 'Ø ' + sek(schnittZeit()) : '');
  }

  function gefahrBeginnt(f) {
    phase = 'gefahr'; gefahrT = 0;
    if (f.gefahr === 'ball') R_.ton('ball');
    if (auto) { auto.bremst = true; return; }
    if (kuppe != null) return;   // Stau steht schon hinter der Kuppe
    ziel = s + v0 * FAIR + bremsweg(f) + 1.5;
    if (lkw) hoelzerLosfallen();   // vier Kanthölzer fallen nacheinander aus der offenen Ladetür
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
  const sek = p => p.toFixed(2).replace('.', ',') + 's';   // ohne Leerzeichen vor dem s (Nutzerwunsch)
  const meter = m => m.toFixed(1).replace('.', ',') + ' m';

  // ---------- Zeichnen ----------
  // Perspektive: Kamera 1,2 m über der Straße; y(z) = Horizont + P/z
  const AUGE = 1.2, NAH = 4.5;   // vorderster sichtbarer Punkt der Straße (Motorhaube verdeckt den Rest)
  let hz = 0, unten = 0, mitte = 0, PERS = 1;
  // Höhe der Fahrbahn in der Entfernung z gegenüber der eigenen Fahrbahnebene (Kuppe: hinter dem Kamm fällt sie ab)
  function kuppenAbstand() { return kuppe == null ? Infinity : kuppe - s; }
  function hoehe(z) {
    const zK = kuppenAbstand();
    if (!isFinite(zK) || zK < 2 || z <= zK) return 0;
    const q = FAHRTEN[nr].steigung / 100, k = Math.min(1, (zK - 2) / 8);   // kurz vor dem Kamm wird das Profil flach
    return -2 * q * k * (z - zK);
  }
  const yZ = z => hz + PERS / z * (1 - hoehe(z) / AUGE);
  let hzLand = 0, scheibeOben = 0;   // Horizont der Landschaft (bergauf tiefer, bergab höher als der Fluchtpunkt der Straße)
  // Dinge hinter der Kuppe nur oberhalb des Kamms zeichnen
  function hinterKuppe(g, z, zeichnen) {
    const zK = kuppenAbstand();
    if (!isFinite(zK) || zK < 2 || z <= zK) return zeichnen();
    g.save(); g.beginPath(); g.rect(0, 0, B, yZ(zK)); g.clip(); zeichnen(); g.restore();
  }
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
    scheibeOben = ck.y;
    hzLand = hz + (f.steigung || 0) / 100 * PERS / AUGE * 1.1;
    if (!(PERS > 1)) return;   // Fenster (noch) zu klein, z. B. beim Umschalten – sonst Fehler mit negativen Maßen

    rueckstrahler = []; verdecker = [];
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
  const BILD = { reh: bild('reh.webp'), ball: bild('ball.webp'), dreieck: bild('warndreieck.webp'), autoAn: bild('auto-hinten.webp'), autoAus: bild('auto-hinten-aus.webp'), hase: bild('hase.webp'),
    stauRot: bild('stau-rot.webp'), stauBlau: bild('stau-blau.webp'),
    // Fahrt 4: Transporter, Kombi, SUV, LKW (ChatGPT, Original Material/Bilder/stau-fahrzeuge-4.webp, gleicher Maßstab);
    // Fahrt 3: Wohnmobil statt Pkw (Original Material/Bilder/wohnmobil-hinten.webp, Rückleuchten aus – Bremslicht macht der Code)
    stauTransporter: bild('stau-transporter.webp'), stauKombi: bild('stau-kombi.webp'), stauSuv: bild('stau-suv.webp'), stauLkw: bild('stau-lkw.webp'),
    // Fahrt 6 (Nacht): Reisebus, Pick-up, Kleinwagen, Sattelzug als Nachtbild (Original Material/Bilder/stau-nacht-4.webp)
    nachtBus: bild('nacht-bus.webp'), nachtPickup: bild('nacht-pickup.webp'), nachtKleinwagen: bild('nacht-kleinwagen.webp'), nachtSattelzug: bild('nacht-sattelzug.webp'),
    wohnmobil: bild('wohnmobil.webp'), wohnmobilAn: bild('wohnmobil-an.webp'),   // zweites Bild: Bremslichter an (Original Material/Bilder/wohnmobil-hinten-bremslicht.webp)   // Fahrt 6: rotes Fließheck und blaue Limousine (ChatGPT, Original Material/Bilder/stau-autos-rot-blau.webp)
    lkw: bild('lkw-ladung.webp'), hoelzer: [1, 2, 3, 4].map(i => bild(`holz-${i}.webp`)) };   // LKW und Holz: ChatGPT (Originale in Material/Bilder)

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
    const land = landschaftJetzt(f);
    if (fertig(land.bild)) {
      // Panorama so groß, dass es die Breite füllt und Augenhöhe auf dem Horizont liegt
      const L = land.bild, iw = L.naturalWidth, ih = L.naturalHeight, hor = land.horizont;
      // nur so groß, dass es die sichtbare Scheibe füllt (oben Dachhimmel, unten Armaturenbrett) – sonst ist es unnötig stark vergrößert
      const m = Math.max(B / iw, (hzLand - Math.max(0, scheibeOben)) / hor, (unten - hzLand) / (ih - hor));
      g.drawImage(L, (B - iw * m) / 2, hzLand - hor * m, iw * m, ih * m);
      const toenung = land.toenung || { regen: 'rgba(70,78,88,.6)', nebel: 'rgba(214,219,224,.7)', nacht: 'rgba(3,5,14,.9)' }[f.wetter];
      if (toenung) { g.fillStyle = toenung; g.fillRect(0, 0, B, H); }
      return;
    }
    const farben = {
      tag: ['#7fb6e8', '#d9ecf8'], regen: ['#7d8590', '#b8bec6'], nebel: ['#c9ced4', '#e4e7ea'], nacht: ['#05070f', '#141a2b'],
      sonne: ['#9cc4e8', '#fff2d0'],   // fehlte – ohne geladenes Panorama stürzte Fahrt 7 sonst ab (schwarzer Bildschirm)
    }[f.wetter] || ['#7fb6e8', '#d9ecf8'];
    const v = g.createLinearGradient(0, 0, 0, hz);
    v.addColorStop(0, farben[0]); v.addColorStop(1, farben[1]);
    g.fillStyle = v; g.fillRect(0, 0, B, hz + 1);
    // Wiese bis nach vorne
    const gras = { tag: ['#6a9a4a', '#3f7032'], regen: ['#566f47', '#334a2c'], nebel: ['#8fa088', '#5f7856'], nacht: ['#0c120c', '#1a2618'] }[f.wetter] || ['#6a9a4a', '#3f7032'];
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
  // Eigene Umgebungen je Fahrt (Nutzer, 19.10.2026): Panorama + Straße. Geladen wird erst für die aktuelle und die nächste Fahrt;
  // solange ein Bild fehlt, bleibt es bei der Landstraße.
  // Wohngebiet: Panorama 1536 × 512, Augenhöhe Zeile 318 (Original Material/Bilder/panorama-wohngebiet.webp);
  // Straße 1024 × 1536 (Original Material/Bilder/strasse-wohngebiet.webp): Asphalt zwischen den Bordsteinen Spalte 122–905 = 6 m
  // (130,5 Bildpunkte pro Meter), Kamera in der Mitte der rechten Hälfte (Straßenmitte 1,5 m links), keine Leitpfosten.
  const UMGEBUNGEN = {
    wohngebiet: { landschaft: 'landschaft-wohngebiet.webp', horizont: 318, strasse: 'strasse-wohngebiet.webp',
      links: -1.5 - 513.5 / 130.5, rechts: -1.5 + 510.5 / 130.5, laenge: 1536 / 130.5, pfosten: false, gruen: 'rasen' },
    // Streuobstwiese mit Apfelbäumen bei Regen (ganzes Bild 1536 × 1024, Augenhöhe Zeile 700, Original Material/Bilder/panorama-obstwiese.webp);
    // das Bild ist schon trüb – deshalb nur leicht abgetönt; Straße bleibt die Landstraße
    obstwiese: { landschaft: 'landschaft-obstwiese.webp', horizont: 700, toenung: 'rgba(70,78,88,.22)' },
    // Waldrand mit Lichtung im Morgennebel (1536 × 1024, Augenhöhe Zeile 660, Original Material/Bilder/panorama-waldrand.webp);
    // schon neblig – deshalb schwächere Nebel-Abtönung; Waldstraße folgt
    // Waldstraße (Original Material/Bilder/strasse-wald.webp, zugeschnitten auf Zeile 100–1159 = genau zwei Strich-Abstände, kachelbar):
    // Mittellinie Spalte 511, rechte Randlinie 840 → Spur 3 m = 109,7 Bildpunkte pro Meter, Kamera in der Spurmitte (Spalte 675,5);
    // längs wie die Landstraße auf 24 m pro Bild gestreckt (zwei Strich-Abstände à 12 m)
    wald: { landschaft: 'landschaft-waldrand.webp', horizont: 660, toenung: 'rgba(214,219,224,.45)',
      nebel: [0.86, 0.8], strasse: 'strasse-wald.webp', links: -675.5 / 109.7, rechts: (1024 - 675.5) / 109.7, laenge: 24, pfosten: true },
    // Bergstraße mit Blick ins Tal bei tief stehender Sonne (1536 × 1024, Original Material/Bilder/panorama-bergstrasse.webp):
    // Augenhöhe an der Talsohle vor den Bergen (Zeile 430) – darunter liegt das Tal, in das die Straße bergab führt; Waldstraße
    tal: { landschaft: 'landschaft-tal.webp', horizont: 430,
      strasse: 'strasse-wald.webp', links: -675.5 / 109.7, rechts: (1024 - 675.5) / 109.7, laenge: 24, pfosten: true },
  };
  // Bäume am Straßenrand (ChatGPT, Original Material/Bilder/baeume-4.webp, freigestellt): Höhe in Metern.
  // Je Umgebung: welche Arten, Abstand von–bis (m) und seitlicher Abstand zum Fahrbahnrand (m). Nutzer, 19.10.2026
  const BAUM = {
    linde: { bild: bild('baum-linde.webp'), hoehe: 14 }, birke: { bild: bild('baum-birke.webp'), hoehe: 12 },
    fichte: { bild: bild('baum-fichte.webp'), hoehe: 17 }, apfel: { bild: bild('baum-apfel.webp'), hoehe: 6 },
  };
  // Bäume stehen auf dem Grünstreifen (rand = Abstand zum Rand des Straßenbilds in m); im Wohngebiet ohne Grünstreifen
  // ganz außen am Straßenbild – weiter draußen zeigt nur das Panorama die ferne Landschaft, dort würden sie schweben (Nutzer, 19.10.2026)
  const BAEUME = {
    landstrasse: { arten: ['linde', 'linde', 'birke'], abstand: [40, 90], rand: [1.2, 3.4] },
    wohngebiet: { arten: ['linde', 'apfel', 'apfel'], abstand: [30, 60], rand: [0.8, 2.6] },
    obstwiese: { arten: ['apfel'], abstand: [14, 26], rand: [1.2, 3.4] },
    wald: { arten: ['fichte', 'fichte', 'fichte', 'birke'], abstand: [8, 18], rand: [1.2, 3.4] },
    tal: { arten: ['fichte', 'fichte', 'birke'], abstand: [14, 30], rand: [1.2, 3.4] },
  };
  function baeumePflanzen(f) {
    const art = BAEUME[f.umgebung] || BAEUME.landstrasse, liste = [], st = strasseJetzt(f);
    for (const seite of [1, -1]) {
      for (let pos = 8 + Math.random() * art.abstand[0]; pos < 800; pos += art.abstand[0] + Math.random() * (art.abstand[1] - art.abstand[0])) {
        // kein Baum am Schild: auf derselben Seite Abstand halten (vor dem breiten Werbeschild 30 m frei, sonst verdeckt ein naher Baum die Tafel) – Nutzer, 19.10.2026
        if (schilder.some(sch => Math.sign(sch.x || 3.4) === seite && (sch.km ? pos > sch.pos - 30 && pos < sch.pos + 10 : Math.abs(sch.pos - pos) < 6))) continue;
        // rechts weiter weg von der Straße (Nutzer, 19.10.2026): +1,5 m
        const rand = art.rand[0] + Math.random() * (art.rand[1] - art.rand[0]) + (seite > 0 ? 1.5 : 0);
        liste.push({ pos, x: seite > 0 ? st.rechts + rand : st.links - rand, art: art.arten[Math.floor(Math.random() * art.arten.length)],
          groesse: 0.8 + Math.random() * 0.4, spiegel: Math.random() < 0.5 });
      }
    }
    return liste.sort((a, b) => b.pos - a.pos);   // von hinten nach vorne zeichnen
  }
  // Abgetönte Fassung eines Baums (wie das Panorama: Regen, Nebel, Nacht), einmal berechnet und gemerkt
  const getoent = {};
  function baumBild(b, toenung) {
    if (!toenung) return b.bild;
    const k = b.bild.src + toenung;
    if (getoent[k]) return getoent[k];
    const c = document.createElement('canvas'); c.width = b.bild.naturalWidth; c.height = b.bild.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(b.bild, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = toenung; g.fillRect(0, 0, c.width, c.height);
    return (getoent[k] = c);
  }
  function baeumeZeichnen(g, f) {
    const toenung = landToenung(f) || null;
    for (const b of baeume) {
      const z = b.pos - s, art = BAUM[b.art];
      if (z < 2 || z > 350 || !fertig(art.bild)) continue;
      const m = mProM(z), h = art.hoehe * b.groesse * m, w = h * art.bild.naturalWidth / art.bild.naturalHeight;
      if (w < 2) continue;
      const x = xZ(b.x, z), y = yZ(z);
      hinterKuppe(g, z, () => {
        g.save();
        if (f.wetter === 'nebel') g.globalAlpha = Math.max(0, Math.min(1, 1.25 - z / 50));   // im Nebel verschwinden ferne Bäume
        g.translate(x, y); if (b.spiegel) g.scale(-1, 1);
        g.drawImage(baumBild(art, toenung), -w / 2, -h, w, h);
        g.restore();
      });
    }
  }
  // Grünstreifen neben der Straße (ChatGPT, Original Material/Bilder/gruenstreifen.webp, nahtlos gemacht, außen weich
  // ausgeblendet, außen um eine gespiegelte Graskopie verbreitert): 6,3 m breit, die äußeren 30 % weich ausgeblendet,
  // links am Bild 0,5 m Schotter zur Straße hin. Links der Straße gespiegelt. Bäume und
  // Schilder stehen darauf statt in der Luft (Nutzer, 19.10.2026). Im Wohngebiet ein Rasenstreifen ohne Schotter
  // (rasenstreifen.webp, nur der Grasteil, 5,5 m) hinter dem Gehweg – sonst schwebten dort Bäume und Schilder.
  const STREIFEN = {
    gras: { bild: bild('gruenstreifen.webp'), breite: 6.27, laenge: 1179 / (800 / 6.27) },
    rasen: { bild: bild('rasenstreifen.webp'), breite: 5.53, laenge: 1336 / (800 / 5.53) },
  };
  const gruenFassung = {};
  function gruenBild(art, toenung, gespiegelt) {
    const k = art + toenung + gespiegelt, quelle = STREIFEN[art].bild;
    if (gruenFassung[k]) return gruenFassung[k];
    const c = document.createElement('canvas'); c.width = quelle.naturalWidth; c.height = quelle.naturalHeight;
    const g = c.getContext('2d');
    if (gespiegelt) { g.translate(c.width, 0); g.scale(-1, 1); }
    g.drawImage(quelle, 0, 0);
    if (toenung) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = toenung; g.fillRect(0, 0, c.width, c.height); }
    // Verkleinerte Stufen (je halb so groß) für die Ferne: dort fielen sonst viele Bildzeilen auf eine Bildschirmzeile
    // und das Gras flimmerte/zeigte Streifen (Nutzer, 19.10.2026: „hässliche Effekte auf dem Rasen“)
    const stufen = [c];
    while (stufen.length < 7) {
      const v = stufen[stufen.length - 1], n = document.createElement('canvas');
      n.width = Math.max(8, v.width >> 1); n.height = Math.max(8, v.height >> 1);
      const ng = n.getContext('2d'); ng.imageSmoothingQuality = 'high'; ng.drawImage(v, 0, 0, n.width, n.height);
      stufen.push(n);
    }
    return (gruenFassung[k] = stufen);
  }
  // Abtönung wie Panorama und Bäume (Regen, Nebel, Nacht)
  function landToenung(f) {
    if (f.wetter === 'sonne' || f.wetter === 'tag') return '';
    return landschaftJetzt(f).toenung || { regen: 'rgba(70,78,88,.6)', nebel: 'rgba(214,219,224,.7)', nacht: 'rgba(3,5,14,.9)' }[f.wetter];
  }
  const umgebungsBilder = {};
  function umgebungLaden(f) {
    const u = f && UMGEBUNGEN[f.umgebung];
    if (!u) return;
    for (const datei of [u.landschaft, u.strasse]) if (datei && !umgebungsBilder[datei]) umgebungsBilder[datei] = bild(datei);
  }
  function landschaftJetzt(f) {
    const u = UMGEBUNGEN[f.umgebung], b = u && umgebungsBilder[u.landschaft];
    return b && fertig(b) ? { bild: b, horizont: u.horizont, toenung: u.toenung } : { bild: LANDSCHAFT, horizont: LANDSCHAFT_HORIZONT };
  }
  function strasseJetzt(f) {
    const u = UMGEBUNGEN[f.umgebung], b = u && umgebungsBilder[u.strasse];
    return b && fertig(b) ? { bild: b, links: u.links, rechts: u.rechts, laenge: u.laenge, pfosten: u.pfosten, gruen: u.gruen || 'gras' }
      : { bild: STRASSE, links: STRASSE_LINKS, rechts: STRASSE_RECHTS, laenge: STRASSE_LAENGE, pfosten: true, gruen: 'gras' };
  }

  // Verkleinerte Stufen eines Bilds (je halb so groß) gegen Flimmern in der Ferne – für Straße und Seitenstreifen
  // (Nutzer, 19.10.2026: nach dem Rasen flimmerten Straße und Seitenstreifen)
  const stufenListe = new Map();
  function stufenVon(bildQ) {
    if (stufenListe.has(bildQ)) return stufenListe.get(bildQ);
    const stufen = [bildQ];
    let v = bildQ, vw = bildQ.naturalWidth, vh = bildQ.naturalHeight;
    while (stufen.length < 7) {
      const n = document.createElement('canvas');
      n.width = Math.max(8, vw >> 1); n.height = Math.max(8, vh >> 1);
      const ng = n.getContext('2d'); ng.imageSmoothingQuality = 'high'; ng.drawImage(v, 0, 0, n.width, n.height);
      stufen.push(n); v = n; vw = n.width; vh = n.height;
    }
    stufenListe.set(bildQ, stufen);
    return stufen;
  }
  const stufeFuer = (proZeile, proSpalte) => Math.max(0, Math.min(6, Math.floor(Math.log2(Math.max(1, proZeile, proSpalte)))));

  function strasseBild(g, f) {
    const st = strasseJetzt(f), iw = st.bild.naturalWidth, ih = st.bild.naturalHeight;
    const sf = STREIFEN[st.gruen], gruen = sf && fertig(sf.bild), tn = landToenung(f);
    const gR = gruen && gruenBild(st.gruen, tn, false), gL = gruen && gruenBild(st.gruen, tn, true), gw = gruen && sf.bild.naturalWidth, gh = gruen && sf.bild.naturalHeight;
    const zeile = (z, y, h) => {
      const anteil = ((s + z) / st.laenge) % 1;
      const xl = xZ(st.links, z), xr = xZ(st.rechts, z);
      if (gruen) {   // Grünstreifen zuerst, die Straße überdeckt die Kante
        const b = sf.breite * mProM(z), ue = 0.1 * mProM(z);
        // passende Stufe: wie viele Bildzeilen (längs) bzw. Bildspalten (quer) auf einen Bildschirmpunkt fallen
        const proZeile = z * z / PERS * gh / sf.laenge, proSpalte = gw / Math.max(1, b);
        const st2 = Math.max(0, Math.min(6, Math.floor(Math.log2(Math.max(1, proZeile, proSpalte)))));
        const r = gR[st2], l = gL[st2], gy = (1 - ((s + z) / sf.laenge) % 1) * (r.height - 1);
        g.drawImage(r, 0, gy, r.width, 1, xr - ue, y, b, h);
        g.drawImage(l, 0, gy, l.width, 1, xl + ue - b, y, b, h);
      }
      const sb = stufenVon(st.bild)[stufeFuer(z * z / PERS * ih / st.laenge, iw / Math.max(1, xr - xl))];
      const sbh = sb.naturalHeight || sb.height, sbw = sb.naturalWidth || sb.width;
      g.drawImage(sb, 0, (1 - anteil) * (sbh - 1), sbw, 1, xl, y, xr - xl, h);
    };
    const zK = kuppenAbstand();
    // Zeile für Zeile: jede Bildschirmzeile zeigt die Straße in ihrer Entfernung z (bei einer Kuppe nur bis zum Kamm)
    for (let y = Math.floor(hz) + 1; y < unten + 2; y++) {
      const z = PERS / (y + 0.5 - hz);
      if (z > 400 || (zK >= 2 && z > zK)) continue;
      zeile(z, y, 1.2);
    }
    if (isFinite(zK) && zK >= 2) {
      // hinter dem Kamm: von nah nach fern, nur was über die bereits gezeichnete Straße hinausragt
      let yMin = zK > NAH ? yZ(zK) : unten + 2;
      for (let z = Math.max(zK, NAH); z < 400; z += Math.max(0.25, z * 0.01)) {
        const y = yZ(z);
        if (y < yMin - 0.3) { zeile(z, y, yMin - y + 0.6); yMin = y; }
      }
      return;   // kein Dunst: die Ferne liegt hinter der Kuppe
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
      baeumeZeichnen(g, f);
      const lp = s % 25;
      for (let k = strasseJetzt(f).pfosten ? 16 : -1; k >= 0; k--) {   // im Wohngebiet keine Leitpfosten
        const z = k * 25 - lp;
        if (z < NAH) continue;
        hinterKuppe(g, z, () => { for (const x of [2.6, -6.1]) leitpfosten(g, xZ(x, z), yZ(z), mProM(z), nacht, x < 0); });
      }
      for (const sch of [...schilder].sort((a, b) => b.pos - a.pos)) hinterKuppe(g, sch.pos - s, () => schild(g, sch, sch.pos - s));
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
  let rueckstrahler = [], verdecker = [];   // verdecker: Rechtecke der Fahrzeuge – Dorflichter/Rückstrahler dahinter nicht zeichnen
  const verdeckt = (x, y) => verdecker.some(([x0, y0, x1, y1]) => x > x0 && x < x1 && y > y0 && y < y1);   // nachts gesammelt, nach dem Abdunkeln als Lichtpunkte gezeichnet

  // Verkehrsschilder (gemalt, auf Pfosten): 3 m hoch, Pfosten-Fuß in der Bildmitte, 3,4 m rechts der Kamera
  const SCHILD = {};
  for (const n of ['tempo-30', 'tempo-50', 'tempo-70', 'tempo-100', 'wildwechsel', 'kinder', 'stau', 'steigung', 'gefaelle']) SCHILD[n] = bild('schild-' + n + '.webp');
  const WERBUNG = bild('werbeschild.webp');   // leere Tafel (ChatGPT) mit Logo und „Ihr Opel-Partner – 2 km“
  // Werbeschild mit passender Entfernung: Textzeile (unter dem Logo, y 170–254 von 574) weiß übermalen und neu schreiben
  const werbeTafeln = {};
  function werbeBild(km) {
    if (werbeTafeln[km]) return werbeTafeln[km];
    if (!fertig(WERBUNG)) return null;
    const c = document.createElement('canvas'); c.width = WERBUNG.naturalWidth; c.height = WERBUNG.naturalHeight;
    const g = c.getContext('2d'), k = c.width / 802;
    g.drawImage(WERBUNG, 0, 0);
    g.fillStyle = '#fefefe'; g.fillRect(17 * k, 168 * k, 768 * k, 86 * k);
    g.fillStyle = '#1b1b1b'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${52 * k}px "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif`;
    g.fillText(`Ihr Opel-Partner – ${km} km`, 401 * k, 214 * k, 740 * k);
    return (werbeTafeln[km] = c);
  }
  function schild(g, sch, z) {
    if (z < NAH || z > 300 || !sch.bild || !fertig(sch.bild)) return;
    const b = sch.km ? werbeBild(sch.km) || sch.bild : sch.bild, bw = b.naturalWidth || b.width, bh = b.naturalHeight || b.height;
    const m = mProM(z), h = (sch.hoehe || 3.0) * m, w = h * bw / bh, x = xZ(sch.x || 3.4, z), y = yZ(z);
    // ohne Schatten am Fuß (Nutzer, 19.10.2026: sah hässlich aus)
    g.drawImage(b, x - w / 2, y - h, w, h);
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
  // Kuppe: Ragt irgendein Stau-Fahrzeug (auch ein hohes wie der LKW) schon über den Kamm, beginnt die Gefahr sofort –
  // sonst sah man es kurz und das Tippen galt als „Zu früh“ (Nutzer, 19.10.2026)
  let stauSichtbar = false;
  function gefahrZeichnen(g, f) {
    if (kuppe != null && ziel != null) {
      const n = verdecker.length;
      hinterKuppe(g, ziel - s, () => gefahrBilder(g, f));
      const kamm = yZ(kuppenAbstand());
      if (phase === 'fahren' && verdecker.slice(n).some(r => r[4] < kamm - 0.5)) stauSichtbar = true;
      return;
    }
    gefahrBilder(g, f);
  }
  function gefahrBilder(g, f) {
    if (auto && fertig(BILD.wohnmobil)) {
      const an = auto.bremst && fertig(BILD.wohnmobilAn);
      return stauAuto(g, an ? BILD.wohnmobilAn : BILD.wohnmobil, 0, Math.max(1.5, auto.pos - s), 2.35, STAU_LICHT.wohnmobil, auto.bremst, false);
    }
    if (auto) return autoHinten(g, -0, auto.pos - s, auto.farbe, auto.bremst, false);
    if (lkw) {   // erst das Holz (näher), dann der LKW dahinter – von hinten nach vorne zeichnen
      lkwHinten(g, lkw.pos - s);
      hoelzerZeichnen(g);
      return;
    }
    if (ziel == null) return;
    const z = ziel - s;
    if (z < 1) return;
    if (f.gefahr === 'reh') reh(g, rehX, z);
    else if (f.gefahr === 'hase') hase(g, haseX, z);
    else if (f.gefahr === 'ball') ball(g, ballX, z);
    else if (f.gefahr === 'stau' && f.wetter === 'nacht' && ['nachtBus', 'nachtPickup', 'nachtKleinwagen', 'nachtSattelzug'].every(n => fertig(BILD[n]))) {
      // Fahrt 6 (Nutzer, 19.10.2026): eigenes Stauende bei Nacht – Kleinwagen vorne, dahinter Reisebus; Gegenspur Pick-up und Sattelzug
      const reihe = [['nachtSattelzug', -3.6, 15], ['nachtBus', 0, 9], ['nachtPickup', -3.5, 4], ['nachtKleinwagen', 0, 0]];
      for (const [n, x, dz] of reihe) stauAuto(g, BILD[n], x, z + dz, STAU_BREITE[n], STAU_LICHT[n]);
      warndreieck(g, 1.2, z - 25);
    }
    else if (f.gefahr === 'stau' && f.wetter === 'nacht' && fertig(BILD.stauRot) && fertig(BILD.stauBlau)) {
      // Fahrt 6 (Nutzer, 18.10.2026): eigene Bilder statt der umlackierten Autos
      stauAuto(g, BILD.stauRot, -3.5, z + 6, 1.9, STAU_LICHT.rot);
      stauAuto(g, BILD.stauBlau, 0, z, 2.05, STAU_LICHT.blau);
      warndreieck(g, 1.2, z - 25);
    }
    else if (f.gefahr === 'stau' && ['stauTransporter', 'stauKombi', 'stauSuv', 'stauLkw', 'stauRot', 'stauBlau'].every(n => fertig(BILD[n]))) {
      // Fahrt 4 (Nutzer, 18.10.2026): dichter Stau in beiden Spuren, von hinten nach vorne gezeichnet
      const reihe = [
        ['stauLkw', 'lkw', 0, 16], ['stauRot', 'rot', -3.5, 19], ['stauBlau', 'blau', -3.5, 11.5], ['stauTransporter', 'transporter', 0, 8],
        ['stauSuv', 'suv', -3.6, 4.5], ['stauKombi', 'kombi', 0, 0],
      ];
      for (const [b, l, x, dz] of reihe.sort((p, q) => q[3] - p[3])) {
        const breite = STAU_BREITE[l] || (l === 'rot' ? 1.9 : 2.05);
        stauAuto(g, BILD[b], x, z + dz, breite, STAU_LICHT[l]);
      }
      warndreieck(g, 1.2, kuppe != null ? z - 6 : z - 25);
    }
    else if (f.gefahr === 'stau') {
      autoHinten(g, -3.5, z + 6, AUTOFARBEN[(nr + 2) % 6], true, true);
      autoHinten(g, 0, z, AUTOFARBEN[(nr + 3) % 6], true, true);
      warndreieck(g, 1.2, z - 25);
    }
  }

  // Lage der Rückleuchten (Anteile von Breite/Höhe, am Bild abgemessen) und der dritten Bremsleuchte oben
  const STAU_LICHT = { rot: { seiten: [[0.17, 0.38], [0.84, 0.38]], oben: [0.5, 0.16] }, blau: { seiten: [[0.138, 0.447], [0.866, 0.447]], oben: [0.5, 0.11] },
    transporter: { seiten: [[0.1, 0.554], [0.897, 0.553]], oben: [0.498, 0.021] }, kombi: { seiten: [[0.111, 0.456], [0.888, 0.457]], oben: [0.501, 0.11] },
    suv: { seiten: [[0.13, 0.43], [0.865, 0.43]], oben: [0.487, 0.085] }, lkw: { seiten: [[0.167, 0.762], [0.834, 0.763]], oben: [0.505, 0.017] },
    wohnmobil: { seiten: [[0.131, 0.757], [0.863, 0.758]], oben: [0.453, 0.099] },
    nachtBus: { seiten: [[0.097, 0.67], [0.907, 0.672]], oben: [0.505, 0.111] }, nachtPickup: { seiten: [[0.081, 0.442], [0.916, 0.44]], oben: [0.499, 0.031] },
    nachtKleinwagen: { seiten: [[0.131, 0.427], [0.875, 0.425]], oben: [0.507, 0.078] }, nachtSattelzug: { seiten: [[0.123, 0.805], [0.883, 0.805]], oben: [0.504, 0.024] } };
  // Breite mit Spiegeln in Metern (Fahrt-4-Bild: 0,006 m je Bildpunkt, damit die Größen untereinander stimmen)
  const STAU_BREITE = { transporter: 2.21, kombi: 2.09, suv: 2.14, lkw: 2.36, nachtBus: 2.78, nachtPickup: 2.13, nachtKleinwagen: 1.85, nachtSattelzug: 2.36 };
  // Stehendes Auto am Stauende als fertiges Bild: Bremslichter an, Warnblinker im Takt (breite in Metern, mit Spiegeln)
  // Kennzeichen „PA ZM 12“ (Nutzer, 19.10.2026: alle PA-ZM, je Fahrzeug eine andere zweistellige Zahl).
  // Lage am Bild abgemessen: Mitte x/y und Breite als Anteil der Bildbreite/-höhe (echtes Schild 520 × 110 mm)
  const KENNZEICHEN = {
    'wohnmobil.webp': [0.5, 0.80, 0.27], 'wohnmobil-an.webp': [0.5, 0.80, 0.27], 'stau-transporter.webp': [0.5, 0.86, 0.26],
    'stau-kombi.webp': [0.5, 0.56, 0.24], 'stau-suv.webp': [0.5, 0.57, 0.24], 'stau-lkw.webp': [0.5, 0.81, 0.2],
    'stau-blau.webp': [0.5, 0.66, 0.24], 'stau-rot.webp': [0.5, 0.63, 0.24], 'nacht-bus.webp': [0.5, 0.78, 0.2],
    'nacht-pickup.webp': [0.5, 0.70, 0.24], 'nacht-kleinwagen.webp': [0.5, 0.72, 0.25], 'nacht-sattelzug.webp': [0.5, 0.84, 0.2],
    'lkw-ladung.webp': [0.36, 0.765, 0.15], 'auto-hinten': [0.5, 0.64, 0.25],
  };
  const freieNummern = Array.from({ length: 90 }, (_, i) => i + 10).sort(() => Math.random() - 0.5), nummerVon = {};
  function kennzeichen(g, schluessel, links, oben, w, h) {
    const lage = KENNZEICHEN[schluessel];
    if (!lage) return;
    // gleiches Fahrzeug, gleiche Nummer: das Wohnmobil wechselt beim Bremsen das Bild (Bremslichter an) – Nutzer, 19.10.2026
    const wer = schluessel.replace('-an.webp', '.webp');
    const nr = nummerVon[wer] || (nummerVon[wer] = freieNummern.pop());
    const kw = w * lage[2], kh = kw * 110 / 520;
    if (kw < 7) return;   // in der Ferne nicht zu erkennen
    const x0 = links + w * lage[0] - kw / 2, y0 = oben + h * lage[1] - kh / 2;
    g.save();
    g.fillStyle = '#202020'; g.beginPath(); g.roundRect(x0, y0, kw, kh, kh * 0.14); g.fill();
    g.fillStyle = '#f4f4ef'; g.beginPath(); g.roundRect(x0 + kh * 0.06, y0 + kh * 0.06, kw - kh * 0.12, kh * 0.88, kh * 0.1); g.fill();
    g.fillStyle = '#0039a6'; g.fillRect(x0 + kh * 0.06, y0 + kh * 0.06, kw * 0.075, kh * 0.88);   // EU-Streifen
    if (kw > 40) {
      g.fillStyle = '#fff'; g.font = `700 ${kh * 0.28}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('D', x0 + kh * 0.06 + kw * 0.0375, y0 + kh * 0.72);
    }
    // Schrift: PA, zwei Plaketten, ZM 12
    g.fillStyle = '#111'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.font = `700 ${kh * 0.7}px "Arial Narrow", Arial, sans-serif`;
    const t1 = 'PA', t2 = 'ZM ' + nr, b1 = g.measureText(t1).width, b2 = g.measureText(t2).width, lp = kh * 0.42;
    const frei = kw * 0.9 - kh * 0.12, ges = b1 + lp + b2, k = Math.min(1, frei * 0.92 / ges);
    let x = x0 + kw * 0.09 + (frei - ges * k) / 2, ym = y0 + kh * 0.53;
    g.save(); g.translate(x, ym); g.scale(k, 1); g.fillText(t1, 0, 0); g.restore();
    x += (b1 + lp * 0.5) * k;
    g.fillStyle = '#5a7a3a'; g.beginPath(); g.arc(x, ym - kh * 0.17, kh * 0.13, 0, P * 2); g.fill();   // Plaketten
    g.fillStyle = '#b8862b'; g.beginPath(); g.arc(x, ym + kh * 0.17, kh * 0.13, 0, P * 2); g.fill();
    x += lp * 0.5 * k;
    g.fillStyle = '#111'; g.save(); g.translate(x, ym); g.scale(k, 1); g.fillText(t2, 0, 0); g.restore();
    g.restore();
  }
  const dateiName = b => (b.src || '').split('/').pop();

  function stauAuto(g, bildA, x, z, breite, licht, bremst = true, warn = true) {
    if (z < 1.5) z = 1.5;
    const m = mProM(z), w = breite * m, bh = w * bildA.naturalHeight / bildA.naturalWidth, cx = xZ(x, z), y = yZ(z);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx, y - bh * 0.01, w * 0.5, bh * 0.05, 0, 0, P * 2); g.fill();
    g.drawImage(bildA, cx - w / 2, y - bh, w, bh);
    verdecker.push([cx - w * 0.45, y - bh * 0.95, cx + w * 0.45, y, y - bh * 0.97]);   // [.., Oberkante fürs Auftauchen hinter der Kuppe]   // Fahrzeug verdeckt Lichter dahinter
    kennzeichen(g, dateiName(bildA), cx - w / 2, y - bh, w, bh);
    g.save(); g.globalCompositeOperation = 'lighter';
    const glanz = (farbe2, r, punkte) => { for (const [lx, ly] of punkte) { const px = cx - w / 2 + w * lx, py = y - bh + bh * ly; const v = g.createRadialGradient(px, py, 0, px, py, r); v.addColorStop(0, farbe2); v.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = v; g.fillRect(px - r, py - r, r * 2, r * 2); } };
    if (bremst) glanz('rgba(255,30,10,.9)', w * 0.28, licht.seiten.concat([licht.oben]));
    if (warn && blink) glanz('rgba(255,160,20,.9)', w * 0.16, licht.seiten);
    g.restore();
  }

  function autoHinten(g, x, z, farbe, bremst, warn) {
    if (z < 1.5) z = 1.5;
    const m = mProM(z), w = 1.8 * m, h = 1.5 * m, cx = xZ(x, z), y = yZ(z);
    const bildAuto = autoBild(farbe, bremst);
    if (bildAuto) {
      const bh = w * bildAuto.height / bildAuto.width;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx, y - bh * 0.01, w * 0.55, bh * 0.05, 0, 0, P * 2); g.fill();
      g.drawImage(bildAuto, cx - w / 2, y - bh, w, bh);
      kennzeichen(g, 'auto-hinten', cx - w / 2, y - bh, w, bh);
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
  // LKW von hinten mit offener Ladetür: Kasten 2,2 m breit (im Bild 700 von 968 Bildpunkten, Mitte bei 354), Räder bei 96,5 % der Höhe
  function lkwHinten(g, z) {
    if (z < 1.5 || !fertig(BILD.lkw)) return;
    const m = mProM(z), w = 3.04 * m, h = w * BILD.lkw.naturalHeight / BILD.lkw.naturalWidth;
    const x = xZ(0, z) - w * (354 / 968), y = yZ(z) - h * 0.965;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(xZ(0, z), yZ(z), 1.3 * m, 0.12 * m, 0, 0, P * 2); g.fill();
    g.drawImage(BILD.lkw, x, y, w, h);
    kennzeichen(g, 'lkw-ladung.webp', x, y, w, h);
  }
  // Kanthölzer (Nutzer, 19.10.2026; ChatGPT, Original Material/Bilder/kanthoelzer-4.webp, freigestellt holz-1…4, 1,7–2,5 m lang):
  // fallen nacheinander aus der Ladetür (0,16 s Abstand), drehen sich im Fall, prallen auf (Poltern, Staub), hüpfen kurz
  // und rutschen dann bergab 1,4–2,4 m auf einen zu. Ihre Endlage beginnt genau bei ziel (fairer Anhalteweg) – vorher
  // sind sie immer weiter weg, der Aufprall wird weiter über ziel gerechnet.
  const HOLZ_LAENGE = [1.67, 1.92, 2.21, 2.49], HOLZ_FALL = 0.42, HOLZ_HUEPF = 0.22, HOLZ_RUTSCH = 0.95;
  function hoelzerLosfallen() {
    const reihe = [0, 1, 2, 3].sort(() => Math.random() - 0.5), ende = [0, 1.3, 2.7, 4.2];   // gut verteilt, nicht übereinander
    hoelzer = reihe.map((bildNr, i) => {
      const rutsch = 1.4 + Math.random() * 1.0, F = ziel + ende[i];
      return { bildNr, laenge: HOLZ_LAENGE[bildNr], x: -1.3 + Math.random() * 2.6, los: i * 0.16, F, L: F + rutsch, start: null,
        z: null, hoch: 1.15, winkel: (Math.random() - 0.5) * 0.6, dreh: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 4),
        endWinkel: (Math.random() - 0.5) * 0.24, gelandet: false };
    });
  }
  const easeOut = u => 1 - (1 - u) * (1 - u);
  function staubWolke(x, z, menge) {
    for (let k = 0; k < menge; k++) staub.push({ x: x + (Math.random() - 0.5) * 1.6, z: z + (Math.random() - 0.5) * 0.8, t: 0, dauer: 0.9 + Math.random() * 0.6, gross: 0.6 + Math.random() * 0.8 });
  }
  function hoelzerBewegen(dt) {
    for (const h of hoelzer) {
      const tt = holzT - h.los;
      if (tt < 0) continue;
      if (h.start == null) { h.start = lkw.pos - 0.3; h.landWinkel = h.winkel; }
      if (tt < HOLZ_FALL) {   // Fall von der Ladekante (1,15 m) mit Drehung
        const u = tt / HOLZ_FALL;
        h.z = h.start + (h.L - h.start) * u; h.hoch = 1.15 * (1 - u * u); h.winkel = h.landWinkel + h.dreh * tt;
      } else {
        if (!h.gelandet) {
          h.gelandet = true; h.aufWinkel = h.winkel;
          R_.ton(['holz', 'holz-2', 'holz-3'][Math.floor(Math.random() * 3)]);
          if (h === hoelzer[0] || h === hoelzer[2]) R_.ton('rutschen');   // Schrammen über den Asphalt (nicht bei jedem, sonst zu laut)
          staubWolke(h.x, h.L, 4);
          // Holzsplitter fliegen weg (Nutzer, 19.10.2026): kleine helle Späne, fallen mit Schwerkraft und bleiben kurz liegen
          for (let k = 0; k < 8; k++) splitter.push({ x: h.x + (Math.random() - 0.5) * h.laenge * 0.8, z: h.L, y: 0.1,
            vx: (Math.random() - 0.5) * 6, vz: (Math.random() - 0.5) * 4, vy: 1.5 + Math.random() * 2.5,
            w: Math.random() * P, dw: (Math.random() - 0.5) * 30, l: 0.12 + Math.random() * 0.22, t: 0, liegt: 0 });
        }
        const tb = tt - HOLZ_FALL;
        h.hoch = tb < HOLZ_HUEPF ? 0.2 * Math.sin(tb / HOLZ_HUEPF * P) : 0;   // kurzer Hüpfer
        const u = Math.min(1, tb / HOLZ_RUTSCH);
        h.z = h.L - (h.L - h.F) * easeOut(u);                               // rutscht bergab auf einen zu
        h.winkel = h.aufWinkel + (h.endWinkel - h.aufWinkel) * easeOut(Math.min(1, tb / 0.3));
        if (u < 1 && Math.random() < dt * 6) staubWolke(h.x, h.z, 1);       // etwas Staub beim Rutschen
      }
    }
    for (const p of staub) p.t += dt;
    staub = staub.filter(p => p.t < p.dauer);
    for (const p of splitter) {
      p.t += dt;
      if (p.y > 0 || p.vy > 0) { p.vy -= 9.81 * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt; p.w += p.dw * dt; }
      if (p.y <= 0 && p.vy <= 0) { p.y = 0; p.vy = 0; p.liegt += dt; }
    }
    splitter = splitter.filter(p => p.liegt < 2.5);
  }
  function hoelzerZeichnen(g, ohneStaub) {
    const sichtbar = hoelzer.filter(h => h.z != null && h.z - s > 1.2).sort((a, b) => b.z - a.z);
    for (const h of sichtbar) {
      const bildH = BILD.hoelzer[h.bildNr];
      if (!fertig(bildH)) continue;
      const z = h.z - s, m = mProM(z), w = h.laenge * m, hh = w * bildH.naturalHeight / bildH.naturalWidth;
      g.save();
      g.translate(xZ(h.x, z), yZ(z) - h.hoch * m - hh * 0.4);
      g.rotate(h.winkel);
      g.drawImage(bildH, -w / 2, -hh / 2, w, hh);
      g.restore();
    }
    for (const p of splitter) {   // Späne: kurze helle Striche, liegend langsam ausgeblendet
      const z = p.z - s;
      if (z < 1.2) continue;
      const m = mProM(z), x = xZ(p.x, z), y = yZ(z) - p.y * m, l = p.l * m / 2;
      if (l < 0.6) continue;
      g.save(); g.globalAlpha *= Math.max(0, 1 - Math.max(0, p.liegt - 1.5));
      g.strokeStyle = '#e3c394'; g.lineWidth = Math.max(1, 0.035 * m); g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - Math.cos(p.w) * l, y - Math.sin(p.w) * l * 0.6); g.lineTo(x + Math.cos(p.w) * l, y + Math.sin(p.w) * l * 0.6); g.stroke();
      g.restore();
    }
    if (ohneStaub) return;
    for (const p of staub) {   // Staubwolken: wachsen und verblassen, hell im Gegenlicht
      const z = p.z - s;
      if (z < 1.2) continue;
      const m = mProM(z), u = p.t / p.dauer, r = (0.3 + p.gross * u) * m, x = xZ(p.x, z), y = yZ(z) - (0.2 + 0.6 * u) * m;
      const v = g.createRadialGradient(x, y, 0, x, y, r);
      v.addColorStop(0, `rgba(232,214,180,${0.45 * (1 - u)})`); v.addColorStop(1, 'rgba(232,214,180,0)');
      g.fillStyle = v; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  // Feldhase (ChatGPT, aus Material/Bilder/lkw-hase-holz.webp): 0,9 m (im Spiel etwas größer als echt), hoppelt von links
  // in kurzen, schnellen Sprüngen auf die Fahrbahn (Nutzerwunsch); das Bild schaut schon nach rechts, also nicht spiegeln
  function hase(g, x, z) {
    if (!fertig(BILD.hase)) return reh(g, x, z);
    const m = mProM(z), cx = xZ(x, z), y = yZ(z);
    const w = 0.9 * m, h = w * BILD.hase.naturalHeight / BILD.hase.naturalWidth;
    const sprung = Math.abs(Math.sin(x * 3)) * 0.3 * m;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(cx, y, w * 0.35, w * 0.05, 0, 0, P * 2); g.fill();
    g.drawImage(BILD.hase, cx - w / 2, y - sprung - h, w, h);
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

  // Lichter zweier Dörfer bei Nacht: [Anteil der Bildbreite, Bildpunkte unter dem Horizont, Größe 0–1]
  const DORFLICHTER = [[0.12, 3, 0.4], [0.14, 4, 0.2], [0.155, 2.5, 0.6], [0.17, 4.5, 0.1], [0.19, 3.5, 0.3], [0.205, 5, 0.2], [0.22, 3, 0.5],
    [0.235, 4, 0.1], [0.08, 5, 0.2], [0.27, 4, 0.3],
    [0.68, 4, 0.3], [0.7, 2.5, 0.5], [0.715, 5, 0.1], [0.73, 3.5, 0.4], [0.75, 4.5, 0.2], [0.765, 3, 0.6], [0.78, 5, 0.1], [0.8, 4, 0.3],
    [0.83, 3, 0.2], [0.9, 4.5, 0.4], [0.93, 3.5, 0.1]];
  // Regen, Nebel, Nacht über die Szene legen
  function wetterDarueber(g, f) {
    if (f.wetter === 'nebel') {
      // dichter Nebel in der Ferne, nach vorne klarer: Sichtweite etwa 40 m
      const v = g.createLinearGradient(0, hz - 40, 0, yZ(8));
      const nb = (UMGEBUNGEN[f.umgebung] || {}).nebel || [0.97, 0.9];   // Umgebung kann den Nebel etwas lichten, damit man sie noch erahnt
      v.addColorStop(0, `rgba(225,229,233,${nb[0]})`); v.addColorStop(0.55, `rgba(225,229,233,${nb[1]})`); v.addColorStop(1, 'rgba(225,229,233,0)');
      g.fillStyle = v; g.fillRect(0, 0, B, yZ(8));
    } else if (f.wetter === 'nacht') {
      // Scheinwerferkegel: vorne hell, dahinter dunkel
      // oben weich einblenden (vorher harte Kante 30 px über dem Horizont, fiel bei Baumkronen auf)
      const d = g.createLinearGradient(0, hz - 60, 0, unten), k = 60 / (unten - hz + 60);
      d.addColorStop(0, 'rgba(0,0,8,0)'); d.addColorStop(k, 'rgba(0,0,8,.92)'); d.addColorStop(k + (1 - k) * 0.35, 'rgba(0,0,8,.55)'); d.addColorStop(1, 'rgba(0,0,8,.05)');
      g.fillStyle = d; g.fillRect(0, hz - 60, B, unten - hz + 60);
      // Rückstrahler der Leitpfosten leuchten im Scheinwerferlicht
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [x, y, r] of rueckstrahler) {
        if (verdeckt(x, y)) continue;
        const v = g.createRadialGradient(x, y, 0, x, y, r * 2.2);
        v.addColorStop(0, 'rgba(255,240,215,.95)'); v.addColorStop(0.35, 'rgba(255,225,180,.45)'); v.addColorStop(1, 'rgba(255,210,150,0)');
        g.fillStyle = v; g.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
      }
      // Dörfer in der Ferne (Nutzer, 19.10.2026): kleine warme Lichter knapp unter dem Horizont, links und rechts der Straße,
      // ein paar flackern leicht (Fenster, Straßenlaternen)
      const t = performance.now() / 1000, gr = Math.max(1, (unten - hz) / 140);
      DORFLICHTER.forEach(([fx, dy, h], i) => {
        const x = B * fx, y = hzLand + dy * gr, r = gr * (1 + h) * (i % 5 === 0 ? 0.8 + 0.2 * Math.sin(t * 3 + i) : 1);
        if (verdeckt(x, y)) return;   // Dorf liegt hinter den Fahrzeugen
        const v = g.createRadialGradient(x, y, 0, x, y, r * 3);
        v.addColorStop(0, 'rgba(255,214,140,.95)'); v.addColorStop(0.3, 'rgba(255,190,110,.45)'); v.addColorStop(1, 'rgba(255,170,90,0)');
        g.fillStyle = v; g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
      });
      g.restore();
    } else if (f.wetter === 'sonne') {
      sonne(g);
      // das Holz auf der Straße bleibt im Gegenlicht schwach erkennbar (sonst wäre es nicht fair zu sehen)
      if (lkw && hoelzer.length) { g.save(); g.globalAlpha = 0.6; hoelzerZeichnen(g, true); g.restore(); }
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

  // Tief stehende Sonne knapp über dem Horizont, rechts der Mitte (neben der Sonnenblende): grelles Licht,
  // das alles überstrahlt, dazu Lichtflecken auf der Scheibe. Die Helligkeit flackert, ab und zu blitzt sie heller auf
  // (wie zwischen Bäumen hindurch). Nutzer, 18.10.2026.
  function sonne(g) {
    const t = performance.now() / 1000;
    const flackern = 0.82 + 0.1 * Math.sin(t * 7.3) + 0.08 * Math.sin(t * 13.1 + 1) + (Math.sin(t * 1.7) > 0.93 ? 0.35 : 0);
    const sx = B * 0.68, sy = hzLand - Math.max(22, (unten - hz) * 0.14), r = Math.max(B, H) * 0.7;
    // ganze Scheibe ausgebleicht
    g.fillStyle = `rgba(255,244,214,${0.22 * flackern})`;
    g.fillRect(0, 0, B, unten);
    g.save(); g.globalCompositeOperation = 'lighter';
    const v = g.createRadialGradient(sx, sy, 0, sx, sy, r);
    v.addColorStop(0, `rgba(255,255,250,${Math.min(1, flackern)})`);
    v.addColorStop(0.04, `rgba(255,250,225,${0.95 * flackern})`);
    v.addColorStop(0.13, `rgba(255,232,170,${0.6 * flackern})`);
    v.addColorStop(0.35, `rgba(255,205,125,${0.24 * flackern})`);
    v.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = v; g.fillRect(0, 0, B, H);
    // Lichtflecken auf der Windschutzscheibe (auf der Linie von der Sonne zur Bildmitte)
    for (const [k, gr, al] of [[0.45, 0.05, 0.22], [0.8, 0.09, 0.14], [1.25, 0.035, 0.25], [1.6, 0.13, 0.08]]) {
      const x = sx + (B / 2 - sx) * k * 2, y = sy + (unten * 0.8 - sy) * k, rr = Math.max(B, H) * gr;
      const f2 = g.createRadialGradient(x, y, 0, x, y, rr);
      f2.addColorStop(0, `rgba(255,236,190,${al * flackern})`); f2.addColorStop(1, 'rgba(255,236,190,0)');
      g.fillStyle = f2; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    g.restore();
  }

  // Sonnenblende vor dem Fahrer, halb heruntergeklappt (oben links in der Windschutzscheibe)
  // gemalt (ChatGPT, Original Material/Bilder/sonnenblende.webp, Nutzer 18.10.2026): Halterung links oben, Bügel rechts
  const BLENDE = bild('sonnenblende.webp');
  function sonnenblende(g, ck) {
    const oben = Math.max(0, ck.y + ck.h * 0.02), unten2 = oben + (hz - oben) * 0.62;
    const x0 = B * 0.03, x1 = B * 0.5;
    if (fertig(BLENDE)) {
      // so breit wie vorgesehen, aber nie tiefer als drei Viertel bis zum Horizont (Querformat)
      let w = x1 - x0, h = w * BLENDE.naturalHeight / BLENDE.naturalWidth;
      const hMax = (hz - oben) * 0.75;
      if (h > hMax) { h = hMax; w = h * BLENDE.naturalWidth / BLENDE.naturalHeight; }
      g.drawImage(BLENDE, x0, oben - h * 0.06, w, h);
      return;
    }
    const v = g.createLinearGradient(0, oben, 0, unten2);
    v.addColorStop(0, '#2a2b2e'); v.addColorStop(1, '#17181a');
    g.fillStyle = v;
    g.beginPath();
    g.moveTo(x0, oben); g.lineTo(x1, oben); g.lineTo(x1 - B * 0.015, unten2 - 6);
    g.quadraticCurveTo(x1 - B * 0.02, unten2, x1 - B * 0.05, unten2);
    g.lineTo(x0 + B * 0.04, unten2); g.quadraticCurveTo(x0 + B * 0.01, unten2, x0 + B * 0.005, unten2 - 8);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; g.stroke();
    // Halterung oben
    g.fillStyle = '#0e0f10';
    g.fillRect(x0 + B * 0.04, oben - 2, B * 0.05, Math.max(6, (unten2 - oben) * 0.12));
  }

  // ---------- Cockpit ----------
  const COCKPIT = new Image();
  COCKPIT.src = 'bilder/cockpit.webp';
  // Lage im Cockpit-Bild (Anteile von Breite/Höhe): Unterkante der Windschutzscheibe, Mitte des Tachos
  const SCHEIBE_UNTEN = 0.46, TACHO = [0.44, 0.6], LENKRAD = [0.44, 0.768];
  // Zeichen in der Lenkradmitte (z. B. das „Z“ aus dem Logo), in kunde.js als lenkradLogo
  // Bildschirm der Mittelkonsole im Cockpit-Bild (Anteile von Breite/Höhe: links, oben, rechts, unten)
  const BILDSCHIRM = bild('bildschirm.webp'), BILDSCHIRM_FLAECHE = [0.6495, 0.5175, 0.8725, 0.6535];
  // Scheibenwischer: im zugeschnittenen Original (1487 × 150) liegt die Achse bei (50, 99), die Spitze 1435 Bildpunkte rechts davon
  const WISCHER = bild('scheibenwischer.webp'), WISCHER_ACHSE = [50, 99], WISCHER_LAENGE = 1435;
  const LENKRADLOGO = new Image();
  if (R_.kunde.lenkradLogo) LENKRADLOGO.src = R_.kunde.lenkradLogo;

  function cockpitMasse() {
    // Das Cockpit füllt die Breite (auf schmalen Handys etwas breiter, damit Lenkrad und Tacho groß genug sind) und sitzt unten
    const w = Math.max(B, H * 0.95), h = w * 2 / 3;
    return { x: (B - w) / 2, y: H - h, w, h, armaturen: H - h + h * SCHEIBE_UNTEN };
  }

  let dachStreifen = null, drehzahlJetzt = 0, drehzahlZeit = 0;
  // Regentropfen auf der Scheibe (ChatGPT, kachelbar, Original Material/Bilder/regentropfen.webp, Nutzer 18.10.2026):
  // Beim Wisch nach oben verschwinden sie im überstrichenen Bereich, danach sammeln sie sich bis zum nächsten Wisch wieder.
  const TROPFEN = bild('regentropfen.webp'), WISCH = { periode: 1.6, dauer: 1.1, achsen: [[0.3, 0.42], [0.62, 0.38]] };
  let tropfenMuster = null, tropfenLeinwand = null;
  function wischWinkel(t) { return 0.15 + (t < WISCH.dauer ? Math.sin(t / WISCH.dauer * P) * 1.25 : 0); }
  function tropfen(g, ck) {
    if (!fertig(TROPFEN)) return;
    if (!tropfenLeinwand) tropfenLeinwand = document.createElement('canvas');
    if (tropfenLeinwand.width !== B || tropfenLeinwand.height !== H) { tropfenLeinwand.width = B; tropfenLeinwand.height = H; tropfenMuster = null; }
    const k = tropfenLeinwand.getContext('2d');
    if (!tropfenMuster) tropfenMuster = k.createPattern(TROPFEN, 'repeat');
    const t = (performance.now() / 1000) % WISCH.periode, oben = WISCH.dauer / 2;
    // Deckkraft: nach dem Wisch (Wischer oben) frisch, wächst bis zum nächsten Wisch auf 0,85
    const seit = (t - oben + WISCH.periode) % WISCH.periode;
    const deck = 0.85 * Math.min(1, seit / (WISCH.periode - oben)) * (t < oben ? 1 : 1);
    k.clearRect(0, 0, B, H);
    const m = ck.w * 0.5 / TROPFEN.naturalWidth;
    tropfenMuster.setTransform(new DOMMatrix().translate(ck.x, ck.y).scale(m));
    k.globalAlpha = t < oben ? 0.85 : deck; k.fillStyle = tropfenMuster;
    k.fillRect(0, 0, B, ck.armaturen);
    // Beim Wisch nach oben: der bereits überstrichene Bereich (Wischblatt = äußere drei Viertel des Arms) ist frei
    if (t < oben) {
      k.globalCompositeOperation = 'destination-out'; k.globalAlpha = 1;
      const w = wischWinkel(t);
      for (const [px, l] of WISCH.achsen) {
        const x0 = ck.x + ck.w * px, y0 = ck.armaturen, r = ck.w * l;
        k.beginPath(); k.arc(x0, y0, r, -w, -0.15); k.arc(x0, y0, r * 0.27, -0.15, -w, true); k.closePath(); k.fill();
      }
      k.globalCompositeOperation = 'source-over';
    }
    k.globalAlpha = 1;
    g.drawImage(tropfenLeinwand, 0, 0);
  }

  function cockpit(g, f, ck) {
    if (f.wetter === 'regen') tropfen(g, ck);
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
    if (f.wetter === 'sonne') sonnenblende(g, ck);
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
    // Scheibenwischer bei Regen: gemalter Wischer (ChatGPT, Original Material/Bilder/scheibenwischer.webp), dreht um seine Achse.
    // Ein Wisch hin und zurück in 1,1 s, dann 0,5 s Pause in Ruhestellung (Nutzer, 18.10.2026: realistischer)
    if (f.wetter === 'regen') {
      const t = (performance.now() / 1000) % WISCH.periode, w = wischWinkel(t) - 0.15;
      // nur auf der Windschutzscheibe sichtbar: nicht über den Dachhimmel, die Achsen verschwinden unter der Scheibenkante
      g.save(); g.beginPath(); g.rect(0, Math.max(0, ck.y + ck.h * 0.04), B, ck.armaturen - Math.max(0, ck.y + ck.h * 0.04) + ck.h * 0.01); g.clip();
      for (const [px, l] of [[0.3, 0.42], [0.62, 0.38]]) {
        const x0 = ck.x + ck.w * px, y0 = ck.armaturen, winkel = 0.15 + w;
        if (fertig(WISCHER)) {
          const k = ck.w * l / WISCHER_LAENGE;   // Bildschirmpunkte je Bildpunkt des Originals (die Datei selbst ist verkleinert)
          g.save(); g.translate(x0, y0); g.rotate(-winkel);
          g.drawImage(WISCHER, -WISCHER_ACHSE[0] * k, -WISCHER_ACHSE[1] * k, 1487 * k, 150 * k);
          g.restore();
        } else {
          g.strokeStyle = '#0d0e10'; g.lineWidth = Math.max(3, ck.w * 0.006); g.lineCap = 'round';
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(winkel) * ck.w * l, y0 - Math.sin(winkel) * ck.w * l); g.stroke();
        }
      }
      g.restore();
    }
    // Runde Anzeigen mit eigenen Nadeln (Nutzer, 19.10.2026): links Drehzahl (roter Bereich am Ende), rechts Tempo.
    // Mitte/Radius im Cockpit-Bild (1536 × 1024) abgemessen; Skala beginnt unten links (141°) und läuft 256° im Uhrzeigersinn.
    // Die gemalten Nadeln (in Nullstellung) werden mit der Farbe des Ziffernblatts übermalt. Die kleinen Anzeigen ganz
    // außen (Tank, Motortemperatur) bleiben stehen – die ändern sich auf einer kurzen Fahrt nicht.
    {
      const k = ck.w / 1536, kv = Math.max(0, v || 0) * 3.6, t = performance.now() / 1000;
      // Steht das Auto, geht der Motor aus – die Drehzahl fällt auf 0 (Nutzer, 19.10.2026);
      // weich nachgeführt, damit die Nadel nicht springt
      const ziel2 = kv < 1 ? 0 : 800 + kv * 22 + 35 * Math.sin(t * 9) + 20 * Math.sin(t * 23);
      drehzahlJetzt += (ziel2 - drehzahlJetzt) * Math.min(1, (t - (drehzahlZeit || t)) * 6); drehzahlZeit = t;
      const drehzahl = drehzahlJetzt;
      const nadel = (mx, my, r, anteil) => {
        const x = ck.x + mx * k, y = ck.y + my * k * (ck.h / ck.w) * (1536 / 1024), rr = r * k;
        const a0 = 141 * P / 180, a = a0 + Math.max(0, Math.min(1, anteil)) * 256 * P / 180;
        g.save(); g.lineCap = 'round';
        g.strokeStyle = 'rgb(10,12,14)'; g.lineWidth = Math.max(3, 10 * k);   // gemalte Nadel abdecken
        g.beginPath(); g.moveTo(x + Math.cos(a0) * rr * 0.25, y + Math.sin(a0) * rr * 0.25); g.lineTo(x + Math.cos(a0) * rr * 0.92, y + Math.sin(a0) * rr * 0.92); g.stroke();
        g.shadowColor = 'rgba(255,255,255,.6)'; g.shadowBlur = 4 * k;
        g.strokeStyle = '#f2f4f7'; g.lineWidth = Math.max(1.2, 3.2 * k);
        g.beginPath(); g.moveTo(x + Math.cos(a) * rr * 0.38, y + Math.sin(a) * rr * 0.38); g.lineTo(x + Math.cos(a) * rr * 0.93, y + Math.sin(a) * rr * 0.93); g.stroke();
        g.restore();
      };
      nadel(570.7, 629.3, 61, drehzahl / 7000);   // Drehzahl 0–7.000/min
      nadel(775, 629.3, 61.7, kv / 260);           // Tempo 0–260 km/h
      // Kleine Anzeigen ganz außen (Nutzer: nicht auf 0): links Tank ¾ voll, rechts Motortemperatur im Normalbereich.
      // Kreis am Bild eingepasst; Winkel in Grad (Bildschirm: 0° = rechts, 90° = unten)
      const kurz = (mx, my, r, grad) => {
        const x = ck.x + mx * k, y = ck.y + my * k, rr = r * k, a = grad * P / 180;
        g.save(); g.lineCap = 'round'; g.shadowColor = 'rgba(255,255,255,.6)'; g.shadowBlur = 3 * k;
        g.strokeStyle = '#f2f4f7'; g.lineWidth = Math.max(1, 2.4 * k);
        g.beginPath(); g.moveTo(x + Math.cos(a) * rr * 0.45, y + Math.sin(a) * rr * 0.45); g.lineTo(x + Math.cos(a) * rr * 0.88, y + Math.sin(a) * rr * 0.88); g.stroke();
        g.restore();
      };
      kurz(496.6, 656, 23.8, 88 + 0.75 * 163);   // Tank: unten leer (88°) über links bis oben voll (251°)
      kurz(847.5, 655.6, 24.5, 82 - 0.5 * 148);  // Temperatur: unten kalt (82°) über rechts bis oben heiß (−66°)
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
      zeile(zuFruehGesamt >= ZU_FRUEH_MAX ? zuFruehGesamt + '× zu früh – Schluss!' : '+' + String(ZU_FRUEH).replace('.', ',') + 's', hz * 0.5 + 30 + fs * 1.5, fs * 0.8, '#ffb347');
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
      [FAHRTEN[e.fahrt].steigung > 0 ? 'Bremsweg (bergauf)' : FAHRTEN[e.fahrt].steigung < 0 ? 'Bremsweg (bergab)' : 'Bremsweg', meter(e.bremsweg)],
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
  const draussen = { voegel: R_.dauerton('voegel'), wald: R_.dauerton('wald'), kinder: R_.dauerton('kinder') };
  let wischVorher = 0;

  R_.spiel({
    id: 'bremsen',   // neuer Name: Bestwerte zählen seit der Umstellung auf 1.000 Punkte neu
    wertung: 'hoch',
    format: p => p.toLocaleString('de-DE') + ' Punkte',
    hoechst: 1000,
    texte: {
      titel: 'Bremsen',
      untertitel: 'Wie sicher reagierst du?',
      anleitung: 'Probefahrt. Plötzlich taucht eine Gefahr auf. Tippe so schnell wie möglich, um zu bremsen. Aber nicht zu früh! Sieben Fahrten: bei Regen, Nebel, Nacht und tief stehender Sonne. Ein Unfall – und aus.',
      ende: 'Gute Reflexe brauchen gute Bremsen.',
    },
    // Aufnahmen (Pixabay Content License)
    klaenge: {
      klick: { datei: 'klaenge/klick.wav', pegel: 0.35 },
      crash: { datei: 'klaenge/crash.mp3', proben: 58433, pegel: 0.55 },
      motor: { datei: 'klaenge/motor-fahrt.mp3', proben: 242550, pegel: 0.3 },
      bremsen: { datei: 'klaenge/bremsen.wav', pegel: 0.5 },
      hupe: { datei: 'klaenge/hupe.wav', pegel: 0.35 },
      fehler: { datei: 'klaenge/fehler.wav', pegel: 0.3 },   // wie beim Reifenwechsel (Pixabay)
      gut: { datei: 'klaenge/gut.wav', pegel: 0.4 },
      regen: { datei: 'klaenge/regen.mp3', proben: 242550, pegel: 0.35 },
      nacht: { datei: 'klaenge/nacht.mp3', proben: 242550, pegel: 0.3 },
      voegel: { datei: 'klaenge/voegel.mp3', proben: 242550, pegel: 0.18 },
      wald: { datei: 'klaenge/wald.mp3', proben: 242550, pegel: 0.2 },
      kinder: { datei: 'klaenge/kinder.mp3', proben: 242550, pegel: 0.16 },
      ball: { datei: 'klaenge/ball.mp3', proben: 11024, pegel: 0.25 },   // dumpf, wie durch die Scheibe
      wischer: { datei: 'klaenge/wischer.mp3', proben: 22932, pegel: 0.22 },
      holz: { datei: 'klaenge/holz.mp3', proben: 30428, pegel: 0.75 },   // verdichtet, damit der Aufschlag laut genug ist (etwas leiser, damit das Bremsen hörbar bleibt)
      'holz-2': { datei: 'klaenge/holz-2.mp3', proben: 37107, pegel: 0.65 },   // tiefer (dickeres Holz)
      'holz-3': { datei: 'klaenge/holz-3.mp3', proben: 24940, pegel: 0.6 },    // höher
      rutschen: { datei: 'klaenge/rutschen.mp3', proben: 27563, pegel: 0.4 },   // Holz schrammt über den Asphalt (Pixabay, freesound_community 90317)
      blinker: { datei: 'klaenge/blinker.mp3', proben: 43473, pegel: 0.3 },
      musik: { datei: 'klaenge/musik.mp3', proben: 606375, pegel: 0.07 },   // leise Hintergrundmusik (Pixabay, Red Skies – Late Night Ride)
      sieg: { datei: 'klaenge/sieg.mp3', proben: 71663, pegel: 0.45 },
      bestwert: { datei: 'klaenge/bestwert.mp3', proben: 37485, pegel: 0.4 },
    },
    schleife: 'musik',
    neu, schritt, zeichne, runter, groesse(b, h) { B = b; H = h; },
  });
})();
