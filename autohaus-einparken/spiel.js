// Einpark-Profi: Mit dem Finger eine Linie vom Auto in die Parklücke ziehen – das Auto fährt sie nach.
// Sechs Parklücken, drei Beulen erlaubt. Je gerader und mittiger geparkt, desto mehr Punkte.
(function () {
  'use strict';
  const R_ = Rahmen, F = R_.farben;
  const SCHRIFT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const P = Math.PI;
  const W = 600, HW = 900;   // Spielwelt in Einheiten (hochkant); im Querformat wird sie gedreht
  const AL = 92, AB = 40;    // Länge und Breite eines Autos (Verhältnis wie beim gemalten Auto)
  const TEMPO = 230;         // Einheiten pro Sekunde
  const LEBEN = 3;
  // Aktuelle Opel-Lackfarben (Corsa, Mokka, Grandland laut carwow.de, Okt. 2026); Farbwerte nachempfunden, nicht offiziell.
  // Kein Gelb: das eigene Auto hat die Kundenfarbe.
  const FARBEN = [
    '#f2f3f1', // Arktis Weiß
    '#b9bdc0', // Kristall Silber
    '#5f6366', // Grafik Grau
    '#e2622f', // Koral Orange
    '#1d1f22', // Karbon Schwarz
    '#2f63c6', // Voltaik Blau
    '#7d8287', // Kontrast Grau
    '#2e7d6b', // Tropikal Grün
    '#9a5a3c', // Impakt Kupfer
    '#2a4f8f', // Spektrum Blau
    '#e6e6e1', // Kontur Weiß
    '#6f8f7c', // Eukalyptus Grün
  ];
  // ---------- Parkplätze ----------
  // a = Drehung: 0 = Auto zeigt nach oben, P/2 = nach rechts
  const auto = (x, y, a) => ({ art: 'auto', x, y, w: AB, h: AL, a: a || 0 });
  const wand = (x, y, w, h) => ({ art: 'wand', x, y, w, h, a: 0 });
  const pylon = (x, y) => ({ art: 'pylon', x, y, w: 26, h: 26, a: 0 });
  // Baum in runder Pflanzinsel: d = Bildgröße; anstoßen kann man nur an der Pflanzinsel, die Krone ragt darüber
  const baum = (x, y, bild, d) => ({ art: 'baum', x, y, w: d * 0.7, h: d * 0.7, a: 0, bild, d });
  const LEVEL = [
    { start: { x: 300, y: 780, a: 0 }, ziel: { x: 300, y: 220, w: 72, h: 110, a: 0 },
      hindernisse: [auto(190, 220), auto(410, 220), baum(85, 560, 0, 110), baum(520, 690, 1, 80)], logo: [300, 520], hinweis: true },
    { start: { x: 120, y: 770, a: 0 }, ziel: { x: 390, y: 190, w: 66, h: 104, a: 0 },
      hindernisse: [auto(120, 190), auto(210, 190), auto(300, 190), auto(480, 190), pylon(300, 520)], logo: [430, 600] },
    { start: { x: 140, y: 790, a: 0 }, ziel: { x: 505, y: 450, w: 66, h: 104, a: P / 2 },
      hindernisse: [auto(505, 355, P / 2), auto(505, 545, P / 2), auto(505, 640, P / 2), pylon(260, 330), pylon(330, 330), baum(95, 130, 0, 110), baum(330, 150, 1, 80)], logo: [230, 560] },
    { start: { x: 545, y: 800, a: 0 }, ziel: { x: 100, y: 170, w: 66, h: 104, a: 0 },
      hindernisse: [wand(300, 470, 380, 16), auto(190, 170), auto(280, 170), pylon(380, 300), pylon(430, 640)], logo: [300, 650] },
    { start: { x: 300, y: 110, a: P }, ziel: { x: 300, y: 770, w: 60, h: 100, a: 0 },
      hindernisse: [auto(228, 770), auto(372, 770), wand(300, 420, 200, 16), pylon(120, 600), pylon(480, 600), baum(75, 250, 0, 110), baum(535, 840, 1, 80)], logo: [300, 280] },
    { start: { x: 90, y: 800, a: 0 }, ziel: { x: 300, y: 215, w: 64, h: 104, a: 0 },
      hindernisse: [wand(222, 205, 16, 230), wand(378, 205, 16, 230), wand(300, 98, 172, 16),
        pylon(170, 520), pylon(430, 520), auto(510, 790, 0.3), auto(500, 650, 0.3)], logo: [300, 650], halle: true },
  ];
  // Jedes geparkte Auto bekommt eine feste Farbe
  LEVEL.forEach(l => l.hindernisse.forEach((h, i) => { h.farbe = FARBEN[(i * 3 + l.start.x) % FARBEN.length]; }));
  // Gemalte Autos von oben (12 Stück, Opel-Farben) reihum auf die geparkten Autos verteilen; ohne Bild bleibt die Zeichnung
  const FREMDE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => { const b = new Image(); b.src = 'bilder/autos/auto-' + n + '.webp'; return b; });
  let autoNr = 0;
  LEVEL.forEach(l => l.hindernisse.forEach(h => { if (h.art === 'auto') h.bild = autoNr++ % FREMDE.length; }));

  let lv, wagen, pfad, route, strecke, zeichnet, phase, phaseT, leben, punkte, meldung, wackeln, funken, schonGezogen;
  let ansicht = new DOMMatrix(), umkehr = new DOMMatrix();

  // Pflaster-Bild: enthält genau 5 × 4 Steinmuster; 130 Einheiten breit = ein Stein gut halb so breit wie ein Auto
  const PFLASTER = new Image(), PFLASTER_BREITE = 130;
  PFLASTER.src = 'bilder/pflaster.webp';
  let pflasterMuster = null;

  // Eigenes Auto: gemalt von oben (Front oben), grüne Karosserie wird in die Kundenfarbe umgefärbt.
  // Am Bild abgemessen: Auto 1686 px lang, Mitte bei y 887, Dach von y 632 bis 1360.
  const SPIELERAUTO = new Image(), BILD_LAENGE = 1686, BILD_MITTE = 887, DACH = [632, 1360];
  let spielerAuto = null;
  const KEGEL = new Image();   // Leitkegel von oben (auf die Fußplatte zugeschnitten)
  KEGEL.src = 'bilder/leitkegel.webp';
  const MAUER = new Image();   // Betontextur für Mauern, nahtlos wiederholbar
  MAUER.src = 'bilder/mauer.webp';
  let mauerMuster = null;
  const BAEUME = [1, 2].map(n => { const b = new Image(); b.src = 'bilder/baum-' + n + '.webp'; return b; });
  function baumZeichnen(g, h) {
    const b = BAEUME[h.bild];
    if (b.complete && b.naturalWidth) { g.drawImage(b, h.x - h.d / 2, h.y - h.d / 2, h.d, h.d); return; }
    g.fillStyle = '#3d6b35'; g.beginPath(); g.arc(h.x, h.y, h.d / 2, 0, P * 2); g.fill();   // ohne Bild: grüne Krone
  }
  const motorLeerlauf = R_.dauerton('motorLeerlauf'), motorFahrt = R_.dauerton('motorFahrt'), voegel = R_.dauerton('parkplatz');
  SPIELERAUTO.onload = () => { spielerAuto = R_.umfaerben(SPIELERAUTO); };
  SPIELERAUTO.src = 'bilder/auto-spieler.webp';

  function neu() {
    // #luecke=4 hinter der Adresse startet direkt bei Parklücke 4 (zum Testen)
    const sprung = /luecke=(\d)/.exec(location.hash);
    lv = sprung ? Math.max(0, Math.min(LEVEL.length - 1, sprung[1] - 1)) : 0;
    leben = LEBEN; punkte = 0; schonGezogen = false;
    neuerVersuch();
  }
  function neuerVersuch() {
    wagen = Object.assign({}, LEVEL[lv].start);
    pfad = []; route = null; strecke = 0; zeichnet = false;
    phase = 'zeichnen'; phaseT = 0; meldung = null; wackeln = 0; funken = [];
  }

  // ---------- Geometrie ----------
  function achsen(o) { const c = Math.cos(o.a), s = Math.sin(o.a); return [[c, s], [-s, c]]; }
  function ecken(o) {
    const [u, v] = achsen(o), w = o.w / 2, h = o.h / 2;
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [o.x + u[0] * w * i + v[0] * h * j, o.y + u[1] * w * i + v[1] * h * j]);
  }
  // Überschneiden sich zwei gedrehte Rechtecke? (Trennachsen-Test, mit etwas Nachsicht)
  function ueberlappt(a, b) {
    const ea = ecken(a), eb = ecken(b);
    for (const ax of [...achsen(a), ...achsen(b)]) {
      const pa = ea.map(p => p[0] * ax[0] + p[1] * ax[1]), pb = eb.map(p => p[0] * ax[0] + p[1] * ax[1]);
      if (Math.max(...pa) - 2 < Math.min(...pb) || Math.max(...pb) - 2 < Math.min(...pa)) return false;
    }
    return true;
  }
  function innen(p, o, tol) {
    const [u, v] = achsen(o), dx = p[0] - o.x, dy = p[1] - o.y;
    return Math.abs(dx * u[0] + dy * u[1]) <= o.w / 2 + tol && Math.abs(dx * v[0] + dy * v[1]) <= o.h / 2 + tol;
  }
  function wagenBox() { return { x: wagen.x, y: wagen.y, w: AB, h: AL, a: wagen.a }; }
  function kollision() {
    const box = wagenBox();
    if (ecken(box).some(([x, y]) => x < 0 || x > W || y < 0 || y > HW)) return true;
    return LEVEL[lv].hindernisse.some(h => ueberlappt(box, h));
  }

  // Linie glätten (Chaikin) und in gleich lange Schritte teilen
  const SCHRITT = 3;
  function glaetten(pkt) {
    for (let r = 0; r < 3; r++) {
      const n = [pkt[0]];
      for (let i = 0; i < pkt.length - 1; i++) {
        const a = pkt[i], b = pkt[i + 1];
        n.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
      }
      n.push(pkt[pkt.length - 1]);
      pkt = n;
    }
    const aus = [pkt[0]];
    let rest = 0;
    for (let i = 1; i < pkt.length; i++) {
      let a = pkt[i - 1];
      const b = pkt[i];
      let d = Math.hypot(b.x - a.x, b.y - a.y);
      while (rest + d >= SCHRITT) {
        const t = (SCHRITT - rest) / d;
        a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        aus.push(a);
        d = Math.hypot(b.x - a.x, b.y - a.y);
        rest = 0;
      }
      rest += d;
    }
    aus.push(pkt[pkt.length - 1]);
    return aus;
  }
  function routePunkt(d) {
    const i = Math.max(0, Math.min(route.length - 1, d / SCHRITT));
    const a = route[Math.floor(i)], b = route[Math.min(route.length - 1, Math.floor(i) + 1)], t = i - Math.floor(i);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  // ---------- Eingabe ----------
  function welt(x, y) { const p = umkehr.transformPoint(new DOMPoint(x, y)); return { x: p.x, y: p.y }; }
  function runter(x, y) {
    if (phase !== 'zeichnen') return;
    const p = welt(x, y);
    if (Math.hypot(p.x - wagen.x, p.y - wagen.y) > 75) return;
    zeichnet = true; schonGezogen = true;
    pfad = [{ x: wagen.x, y: wagen.y }];
  }
  function bewegen(x, y) {
    if (!zeichnet) return;
    const p = welt(x, y), l = pfad[pfad.length - 1];
    if (Math.hypot(p.x - l.x, p.y - l.y) >= 6 && pfad.length < 600) pfad.push(p);
  }
  function hoch() {
    if (!zeichnet) return;
    zeichnet = false;
    let lang = 0;
    for (let i = 1; i < pfad.length; i++) lang += Math.hypot(pfad[i].x - pfad[i - 1].x, pfad[i].y - pfad[i - 1].y);
    if (lang < 40) { pfad = []; return; }
    route = glaetten(pfad);
    strecke = 0;
    phase = 'fahren'; phaseT = 0;
  }

  // ---------- Ablauf ----------
  function schritt(dt) {
    phaseT += dt;
    wackeln = Math.max(0, wackeln - dt);
    funken.forEach(f => { f.x += f.vx * dt; f.y += f.vy * dt; f.t += dt; });
    funken = funken.filter(f => f.t < 0.6);

    let tempo = 0;
    if (phase === 'fahren') {
      const gesamt = (route.length - 1) * SCHRITT, rest = gesamt - strecke;
      tempo = Math.min(TEMPO, 60 + rest * 2.4);
      strecke = Math.min(gesamt, strecke + tempo * dt);
      const p = routePunkt(strecke), v = routePunkt(Math.max(0, strecke - 8)), n = routePunkt(Math.max(16, strecke + 8));
      wagen.x = p.x; wagen.y = p.y;
      if (Math.hypot(n.x - v.x, n.y - v.y) > 0.5) wagen.a = Math.atan2(n.x - v.x, -(n.y - v.y));
      if (kollision()) crash();
      else if (strecke >= gesamt) pruefen();
      else parksensor(dt);
    } else if (phase === 'crash' && phaseT > 1.3) {
      if (leben <= 0) { phase = 'aus'; R_.ende(punkte, { ueberschrift: 'Zu viele Beulen!', verzoegerung: 200 }); }
      else neuerVersuch();
    } else if (phase === 'daneben' && phaseT > 1.3) {
      neuerVersuch();
    } else if (phase === 'geparkt' && phaseT > 1.5) {
      if (lv === LEVEL.length - 1) {
        phase = 'aus';
        R_.ton('sieg');
        R_.ende(punkte, { ueberschrift: 'Alle Lücken geschafft!', verzoegerung: 200 });
      } else { lv++; neuerVersuch(); }
    }
    // Motor: Leerlauf, solange man die Linie zieht; beim Fahren dreht er je nach Tempo höher
    voegel.stellen(phase === 'aus' ? 0 : 1);   // Vögel auf dem Hof, leise unter der Musik
    motorLeerlauf.stellen(phase === 'zeichnen' ? 1 : phase === 'fahren' ? 0.35 : 0);
    motorFahrt.stellen(phase === 'fahren' ? 1 : 0, 0.8 + tempo / TEMPO * 0.45);
    if (meldung) meldung.t += dt;
    R_.anzeige(`Parklücke ${Math.min(lv + 1, LEVEL.length)}/${LEVEL.length}`, '♥'.repeat(leben) + '♡'.repeat(LEBEN - leben) + '  ' + punkte + ' P');
  }

  // Parksensor: piept schneller, je näher das Auto einem Hindernis kommt (wie beim Parkassistenten)
  let piepT = 0;
  function abstandHindernis() {
    const box = wagenBox();
    for (const m of [5, 10, 16, 24, 34, 46, 60]) {
      const gross = { x: box.x, y: box.y, a: box.a, w: AB + 2 * m, h: AL + 2 * m };
      if (LEVEL[lv].hindernisse.some(h => ueberlappt(gross, h))) return m;
    }
    return Infinity;
  }
  function parksensor(dt) {
    const d = abstandHindernis();
    if (d === Infinity) { piepT = 0; return; }
    piepT -= dt;
    if (piepT <= 0) { R_.ton('parksensor'); piepT = d <= 5 ? 0.09 : 0.1 + d / 60 * 0.55; }
  }

  function crash() {
    leben--;
    phase = 'crash'; phaseT = 0; wackeln = 0.4;
    meldung = { text: 'Blechschaden!', farbe: '#ff6b6b', t: 0 };
    R_.ton('crash');
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * P * 2, v = 60 + Math.random() * 160;
      funken.push({ x: wagen.x, y: wagen.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: Math.random() * 0.2 });
    }
  }

  function pruefen() {
    const z = LEVEL[lv].ziel;
    if (!ecken(wagenBox()).every(p => innen(p, z, 3))) {
      phase = 'daneben'; phaseT = 0;
      meldung = { text: 'Nicht ganz drin – nochmal!', farbe: '#fff', t: 0 };
      R_.ton('hupe');
      return;
    }
    const versatz = Math.hypot(wagen.x - z.x, wagen.y - z.y);
    const spiel = Math.max(4, (z.w - AB) / 2 + (z.h - AL) / 2);
    let dw = ((wagen.a - z.a) % P + P) % P;
    if (dw > P / 2) dw = P - dw;
    const p = Math.max(30, Math.round(100 - 35 * Math.min(1, versatz / spiel) - 35 * Math.min(1, dw / 0.3)));
    punkte += p;
    phase = 'geparkt'; phaseT = 0;
    meldung = { text: (p >= 90 ? 'Perfekt geparkt!' : p >= 70 ? 'Sauber!' : 'Geparkt – passt schon') + '  +' + p, farbe: F.akzent, t: 0 };
    R_.ton('handbremse');                       // Handbremse ziehen, dann Tür zu
    setTimeout(() => R_.ton('tuer'), 450);
  }

  // ---------- Zeichnen ----------
  function zeichne(g, B, H) {
    const oben = 50, quer = B > H * 1.05;
    const s = quer ? Math.min((B - 20) / HW, (H - oben - 10) / W) : Math.min((B - 16) / W, (H - oben - 10) / HW);
    let wx = 0, wy = 0;
    if (wackeln > 0) { wx = Math.sin(wackeln * 70) * 8 * wackeln; wy = Math.cos(wackeln * 55) * 6 * wackeln; }
    ansicht = new DOMMatrix().translate(B / 2 + wx, oben + (H - oben) / 2 + wy).rotate(quer ? -90 : 0).scale(s).translate(-W / 2, -HW / 2);
    umkehr = ansicht.inverse();

    // Rand rundherum schwarz
    g.fillStyle = '#000000';
    g.fillRect(0, 0, B, H);

    g.save();
    g.transform(ansicht.a, ansicht.b, ansicht.c, ansicht.d, ansicht.e, ansicht.f);
    const L = LEVEL[lv];
    // Boden: Pflaster vom Hof des Autohauses (nahtlos gekachelt, abgedunkelt für gute Sicht auf die Linien);
    // solange das Bild fehlt, grauer Asphalt
    g.fillStyle = '#3b4048';
    g.fillRect(0, 0, W, HW);
    if (PFLASTER.complete && PFLASTER.naturalWidth) {
      if (!pflasterMuster) {
        pflasterMuster = g.createPattern(PFLASTER, 'repeat');
        pflasterMuster.setTransform(new DOMMatrix().scale(PFLASTER_BREITE / PFLASTER.naturalWidth));
      }
      g.fillStyle = pflasterMuster;
      g.fillRect(0, 0, W, HW);
      g.fillStyle = 'rgba(15,17,20,.38)';
      g.fillRect(0, 0, W, HW);
    }
    // Bordstein
    g.strokeStyle = F.haupt; g.lineWidth = 10;   // Bordstein in der Kundenfarbe
    g.strokeRect(-5, -5, W + 10, HW + 10);
    if (L.halle) {
      g.fillStyle = R_.mitAlpha(F.haupt, 0.18);
      g.fillRect(230, 106, 140, 214);
    }
    // Parkbuchten der geparkten Autos
    L.hindernisse.filter(h => h.art === 'auto').forEach(h => bucht(g, { x: h.x, y: h.y, w: 66, h: 104, a: h.a }, R_.mitAlpha(F.haupt, 0.85)));
    // Ziel-Lücke
    const z = L.ziel, blink = 0.5 + 0.5 * Math.sin(performance.now() / 250);
    g.save();
    g.translate(z.x, z.y); g.rotate(z.a);
    g.fillStyle = R_.mitAlpha(F.akzent, 0.12 + 0.1 * blink);
    g.fillRect(-z.w / 2, -z.h / 2, z.w, z.h);
    g.strokeStyle = F.akzent; g.lineWidth = 4; g.setLineDash([12, 8]);
    g.strokeRect(-z.w / 2, -z.h / 2, z.w, z.h);
    g.setLineDash([]);
    g.fillStyle = R_.mitAlpha(F.akzent, 0.85);
    g.font = `900 40px ${SCHRIFT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.rotate(quer ? P / 2 - z.a : -z.a);
    g.fillText('P', 0, 2);
    g.restore();

    L.hindernisse.forEach(h => { if (h.art !== 'baum') hindernis(g, h); });

    // Gezogene Linie
    const linie = phase === 'fahren' ? route.slice(Math.floor(strecke / SCHRITT)) : pfad;
    if (linie && linie.length > 1) {
      g.strokeStyle = R_.mitAlpha(F.akzent, 0.85); g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
      g.setLineDash([14, 10]);
      g.beginPath();
      linie.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](p.x, p.y));
      g.stroke();
      g.setLineDash([]);
    }

    // Hinweis in der ersten Lücke: vom Auto zur Lücke ziehen
    if (L.hinweis && !schonGezogen && phase === 'zeichnen' && Rahmen.zustand === 'spiel') {
      const t = (performance.now() / 1400) % 1;
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 4;
      g.beginPath(); g.arc(wagen.x, wagen.y, 55 + 10 * Math.sin(t * P * 2), 0, P * 2); g.stroke();
      const hx = wagen.x + (z.x - wagen.x) * t, hy = wagen.y + (z.y - wagen.y) * t;
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.beginPath(); g.arc(hx, hy, 14, 0, P * 2); g.fill();
    }

    zeichneAuto(g, wagen.x, wagen.y, wagen.a, F.haupt, true);
    // Bäume zuletzt: die Krone liegt über dem Auto
    L.hindernisse.forEach(h => { if (h.art === 'baum') baumZeichnen(g, h); });

    funken.forEach(f => {
      g.fillStyle = `rgba(255,${180 + Math.random() * 60 | 0},80,${1 - f.t / 0.6})`;
      g.fillRect(f.x - 3, f.y - 3, 6, 6);
    });
    g.restore();

    if (meldung && meldung.t < 1.4) {
      const fs = Math.max(22, Math.min(40, B * 0.07));
      g.save();
      g.globalAlpha = Math.min(1, (1.4 - meldung.t) * 3);
      g.font = `900 ${fs}px ${SCHRIFT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const y = oben + (H - oben) * 0.42 - meldung.t * 20;
      g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.65)';
      g.strokeText(meldung.text, B / 2, y);
      g.fillStyle = meldung.farbe;
      g.fillText(meldung.text, B / 2, y);
      g.restore();
    }
  }

  function bucht(g, o, farbe) {
    g.save();
    g.translate(o.x, o.y); g.rotate(o.a);
    g.strokeStyle = farbe; g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-o.w / 2, -o.h / 2); g.lineTo(-o.w / 2, o.h / 2);
    g.moveTo(o.w / 2, -o.h / 2); g.lineTo(o.w / 2, o.h / 2);
    g.stroke();
    g.restore();
  }

  function hindernis(g, h) {
    if (h.art === 'auto') return zeichneAuto(g, h.x, h.y, h.a, h.farbe, false, h.bild);
    g.save();
    g.translate(h.x, h.y); g.rotate(h.a);
    if (h.art === 'wand') {
      g.fillStyle = 'rgba(0,0,0,.3)';
      g.fillRect(-h.w / 2 + 4, -h.h / 2 + 5, h.w, h.h);
      g.fillStyle = '#80868f';
      g.fillRect(-h.w / 2, -h.h / 2, h.w, h.h);
      if (MAUER.complete && MAUER.naturalWidth) {
        // Betontextur: läuft immer längs der Mauer, Texturhöhe = Mauerdicke
        const quer = h.h > h.w, lang = quer ? h.h : h.w, dick = quer ? h.w : h.h;
        if (!mauerMuster) mauerMuster = g.createPattern(MAUER, 'repeat');
        g.save();
        if (quer) g.rotate(P / 2);
        mauerMuster.setTransform(new DOMMatrix().translate(-lang / 2, -dick / 2).scale(dick / MAUER.naturalHeight));
        g.fillStyle = mauerMuster;
        g.fillRect(-lang / 2, -dick / 2, lang, dick);
        g.restore();
      }
      g.fillStyle = 'rgba(255,255,255,.18)';
      g.fillRect(-h.w / 2, -h.h / 2, h.w, Math.min(5, h.h * 0.35));
    } else if (h.art === 'pylon' && KEGEL.complete && KEGEL.naturalWidth) {
      // gemalter Leitkegel von oben; Fußplatte etwas größer als die Kollisionsfläche
      g.fillStyle = 'rgba(0,0,0,.3)';
      g.fillRect(-14, -12, 32, 32);
      g.drawImage(KEGEL, -16, -16, 32, 32);
    } else if (h.art === 'pylon') {
      g.fillStyle = 'rgba(0,0,0,.3)';
      g.beginPath(); g.arc(3, 4, 13, 0, P * 2); g.fill();
      g.fillStyle = '#ff7a1a';
      g.beginPath(); g.arc(0, 0, 13, 0, P * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 4;
      g.beginPath(); g.arc(0, 0, 7, 0, P * 2); g.stroke();
      g.fillStyle = '#ffb07a';
      g.beginPath(); g.arc(0, 0, 3, 0, P * 2); g.fill();
    }
    g.restore();
  }

  // Auto von oben, Front zeigt in Richtung a (0 = nach oben)
  function zeichneAuto(g, x, y, a, farbe, mitLogo, bild) {
    const l = AL / 2, b = AB / 2;
    g.save();
    g.translate(x, y); g.rotate(a);
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath(); g.roundRect(-b + 4, -l + 6, AB, AL, 11); g.fill();
    const fremd = bild != null && FREMDE[bild];
    if (!mitLogo && fremd && fremd.complete && fremd.naturalWidth) {
      // gemaltes Auto: so skaliert, dass es genau so lang ist wie das Auto im Spiel
      const s = AL / fremd.naturalHeight;
      g.drawImage(fremd, -fremd.naturalWidth * s / 2, -l, fremd.naturalWidth * s, AL);
      g.restore();
      return;
    }
    if (mitLogo && spielerAuto) {
      const s = AL / BILD_LAENGE, dy = ((DACH[0] + DACH[1]) / 2 - BILD_MITTE) * s, dl = (DACH[1] - DACH[0]) * s;
      g.drawImage(spielerAuto, -spielerAuto.width * s / 2, -BILD_MITTE * s, spielerAuto.width * s, spielerAuto.height * s);
      // Logo längs aufs Dach (von hinten nach vorne lesbar)
      g.save(); g.translate(0, dy); g.rotate(-Math.PI / 2);
      R_.zeichneLogo(g, -dl * 0.42, -AB * 0.2, dl * 0.84, AB * 0.4, null, R_.textFarbe(farbe) !== '#ffffff');
      g.restore();
      g.restore();
      return;
    }
    // Spiegel
    g.fillStyle = R_.toenen(farbe, -0.3);
    g.fillRect(-b - 5, -l * 0.3, 6, 8); g.fillRect(b - 1, -l * 0.3, 6, 8);
    // Karosserie
    const k = g.createLinearGradient(-b, 0, b, 0);
    k.addColorStop(0, R_.toenen(farbe, -0.18)); k.addColorStop(0.5, R_.toenen(farbe, 0.12)); k.addColorStop(1, R_.toenen(farbe, -0.18));
    g.fillStyle = k;
    g.beginPath(); g.roundRect(-b, -l, AB, AL, 11); g.fill();
    // Scheiben
    g.fillStyle = 'rgba(25,35,50,.85)';
    g.beginPath(); g.moveTo(-b + 4, -l * 0.38); g.lineTo(b - 4, -l * 0.38); g.lineTo(b - 6, -l * 0.12); g.lineTo(-b + 6, -l * 0.12); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-b + 6, l * 0.5); g.lineTo(b - 6, l * 0.5); g.lineTo(b - 4, l * 0.68); g.lineTo(-b + 4, l * 0.68); g.closePath(); g.fill();
    // Dach
    g.fillStyle = R_.toenen(farbe, 0.06);
    g.beginPath(); g.roundRect(-b + 6, -l * 0.1, AB - 12, l * 0.58, 5); g.fill();
    if (mitLogo) R_.zeichneLogo(g, -b + 8, -l * 0.04, AB - 16, l * 0.46, null, R_.textFarbe(farbe) !== '#ffffff');
    // Lichter
    g.fillStyle = '#fff6c8';
    g.fillRect(-b + 4, -l + 1, 9, 4); g.fillRect(b - 13, -l + 1, 9, 4);
    g.fillStyle = '#e53935';
    g.fillRect(-b + 4, l - 5, 9, 4); g.fillRect(b - 13, l - 5, 9, 4);
    g.restore();
  }

  R_.spiel({
    id: 'autohaus-einparken',
    wertung: 'hoch',
    format: p => p + ' Punkte',
    texte: {
      titel: 'Einparken',
      untertitel: 'Passt du in jede Lücke?',
      anleitung: 'Zieh mit dem Finger eine Linie vom Auto in die markierte Parklücke – das Auto fährt sie nach. Je gerader und mittiger, desto mehr Punkte. Drei Beulen, dann ist Schluss.',
      ende: 'Einparken auf Knopfdruck? Unsere Neuwagen helfen mit Kamera und Parkassistent.',
    },
    // Aufnahmen (Pixabay Content License); 'crash' ersetzt den erzeugten Ton gleichen Namens
    klaenge: {
      crash: { datei: 'klaenge/blechschaden.wav', pegel: 0.5 },
      tuer: { datei: 'klaenge/tuer-zu.wav', pegel: 0.45 },
      parksensor: { datei: 'klaenge/parksensor.wav', pegel: 0.28 },
      motorLeerlauf: { datei: 'klaenge/motor-leerlauf.wav', pegel: 0.25 },
      motorFahrt: { datei: 'klaenge/motor-fahrt.wav', pegel: 0.3 },
      parkplatz: { datei: 'klaenge/parkplatz.wav', pegel: 0.12 },
      musik: { datei: 'klaenge/musik.wav', pegel: 0.08 },   // leise Hintergrundmusik (Pixabay, bombinsound)
      handbremse: { datei: 'klaenge/handbremse.wav', pegel: 0.45 },
      hupe: { datei: 'klaenge/hupe.wav', pegel: 0.35 },   // falsch geparkt
      sieg: { datei: 'klaenge/sieg.wav', pegel: 0.45 },
      bestwert: { datei: 'klaenge/bestwert.wav', pegel: 0.4 },
      klick: { datei: 'klaenge/klick.wav', pegel: 0.35 },
    },
    schleife: 'musik',
    neu, schritt, zeichne, runter, bewegen, hoch,
  });
})();
