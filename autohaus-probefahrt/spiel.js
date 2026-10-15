// Probefahrt: Das Auto fährt auf einer dreispurigen Landstraße. Links oder rechts tippen wechselt die Spur.
// Hindernissen ausweichen, Logo-Münzen einsammeln. Es wird immer schneller; drei Beulen, dann ist Schluss.
(function () {
  'use strict';
  const R_ = Rahmen, F = R_.farben;
  const SCHRIFT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const P = Math.PI;
  // Maße in Einheiten: eine Spur ist 100 breit, k rechnet in Bildpunkte um
  const SPUREN = 3, AB = 40, AL = 92;
  const TEMPO_START = 420, TEMPO_MAX = 1000, TEMPO_PLUS = 11; // Einheiten pro Sekunde (Zuwachs pro Sekunde)
  const LEBEN = 3, MUENZE = 25;
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
  // Eigenes Auto: gemalt von oben (Front oben), grüne Karosserie wird in die Kundenfarbe umgefärbt.
  // Am Bild abgemessen: Auto 1686 px lang, Mitte bei y 887, Dach von y 632 bis 1360.
  const SPIELERAUTO = new Image(), BILD_LAENGE = 1686, BILD_MITTE = 887, DACH = [632, 1360];
  let spielerAuto = null;
  const KEGEL = new Image();   // Leitkegel von oben (auf die Fußplatte zugeschnitten)
  KEGEL.src = 'bilder/leitkegel.webp';
  const motor = R_.dauerton('motor');
  const bildLaden = n => { const b = new Image(); b.src = 'bilder/' + n + '.webp'; return b; };
  const BAKE = bildLaden('bake'), OEL = bildLaden('oel'), LOCH = bildLaden('loch');
  // Gemalte Autos von oben (12 Stück, Opel-Farben) für den übrigen Verkehr; ohne Bild bleibt die Zeichnung
  const FREMDE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => { const b = new Image(); b.src = 'bilder/autos/auto-' + n + '.webp'; return b; });
  SPIELERAUTO.onload = () => { spielerAuto = R_.umfaerben(SPIELERAUTO); };
  SPIELERAUTO.src = 'bilder/auto-spieler.webp';

  let spur, spurX, tempo, strecke, muenzen, leben, dinge, deko, abstand, schutz, phase, phaseT, meldungen, wackeln, rutschen;
  let k = 1, strasseX = 0, strasseB = 300, autoY = 0, B = 0, H = 0;

  function neu() {
    spur = 1; spurX = 1; tempo = TEMPO_START; strecke = 0; muenzen = 0; leben = LEBEN;
    dinge = []; deko = []; abstand = 700; schutz = 0; wackeln = 0; rutschen = 0;
    phase = 'bereit'; phaseT = 0; meldungen = [];
    for (let y = -200; y < 2000; y += 140) neueDeko(y);
  }
  function punkte() { return Math.floor(strecke / 20) + muenzen * MUENZE; }

  // ---------- Strecke füllen ----------
  // y in Einheiten über dem Auto (positiv = weiter vorne)
  function neueReihe(y) {
    const frei = Math.floor(Math.random() * SPUREN);
    const schwer = Math.min(1, strecke / 30000);
    const zweite = Math.random() < 0.25 + schwer * 0.5;
    for (let s = 0; s < SPUREN; s++) {
      if (s === frei) {
        if (Math.random() < 0.55) dinge.push({ art: 'muenze', s, y, w: 40, h: 40 });
        continue;
      }
      if (!zweite && s !== (frei + 1) % SPUREN) continue;
      const r = Math.random();
      if (r < 0.4) dinge.push({ art: 'auto', s, y: y + Math.random() * 40, w: AB, h: AL, farbe: FARBEN[Math.random() * FARBEN.length | 0], bild: Math.random() * FREMDE.length | 0 });
      else if (r < 0.58) dinge.push({ art: 'bake', s, y, w: 86, h: 26 });
      else if (r < 0.74) dinge.push({ art: 'pylon', s, y, w: 30, h: 30 });
      else if (r < 0.88) dinge.push({ art: 'oel', s, y, w: 70, h: 50 });
      else dinge.push({ art: 'loch', s, y, w: 52, h: 50 });
    }
  }
  function neueDeko(y) {
    const seite = Math.random() < 0.5 ? -1 : 1;
    deko.push({ art: Math.random() < 0.7 ? 'baum' : 'busch', seite, rand: 30 + Math.random() * 160, y, gr: 0.7 + Math.random() * 0.6 });
  }

  // ---------- Steuerung ----------
  function lenken(r) {
    if (phase !== 'fahren') return;
    const n = Math.max(0, Math.min(SPUREN - 1, spur + r));
    if (n !== spur) { spur = n; R_.ton('klick'); }
  }
  function runter(x) { lenken(x < B / 2 ? -1 : 1); }
  addEventListener('keydown', e => {
    if (R_.zustand !== 'spiel') return;
    if (e.key === 'ArrowLeft' || e.key === 'a') lenken(-1);
    if (e.key === 'ArrowRight' || e.key === 'd') lenken(1);
  });

  function meldung(text, farbe) { meldungen.push({ text, farbe, t: 0 }); }

  // ---------- Ablauf ----------
  function schritt(dt) {
    phaseT += dt;
    schutz = Math.max(0, schutz - dt);
    wackeln = Math.max(0, wackeln - dt);
    meldungen.forEach(m => { m.t += dt; });
    meldungen = meldungen.filter(m => m.t < 1.1);

    if (phase === 'bereit') {
      if (phaseT > 1.1) { phase = 'fahren'; phaseT = 0; R_.ton('los'); }
    } else if (phase === 'fahren') {
      tempo = Math.min(TEMPO_MAX, tempo + TEMPO_PLUS * dt);
      const weg = tempo * dt;
      strecke += weg;
      dinge.forEach(d => { d.y -= weg; });
      deko.forEach(d => { d.y -= weg; });
      abstand -= weg;
      if (abstand <= 0) {
        neueReihe(1600);
        abstand = (300 + Math.random() * 180) * (0.8 + tempo / TEMPO_MAX * 0.5);
      }
      while (deko.length && deko[0].y < -300) { deko.shift(); neueDeko(deko[deko.length - 1].y + 100 + Math.random() * 80); }
      dinge = dinge.filter(d => d.y > -200 && !d.weg);
      kollisionen();
    } else if (phase === 'aus' && phaseT > 1.0 && R_.zustand === 'spiel') {
      R_.ende(punkte(), { ueberschrift: 'Probefahrt beendet', verzoegerung: 100 });
    }
    // Motor dreht mit dem Tempo hoch; im Leerlauf (Countdown) leise, nach dem Ende aus
    const anteil = (tempo - TEMPO_START) / (TEMPO_MAX - TEMPO_START);
    motor.stellen(phase === 'fahren' ? 1 : phase === 'bereit' ? 0.5 : 0, phase === 'fahren' ? 0.85 + anteil * 0.6 : 0.75);
    // Spurwechsel weich, beim Rutschen etwas langsamer
    spurX += (spur - spurX) * Math.min(1, dt * (rutschen > 0 ? 6 : 16));
    rutschen = Math.max(0, rutschen - dt);
    R_.anzeige(punkte() + ' Punkte', '♥'.repeat(leben) + '♡'.repeat(LEBEN - leben));
  }

  function kollisionen() {
    dinge.forEach(d => {
      if (d.weg) return;
      const dx = Math.abs((d.s - spurX) * 100), dy = Math.abs(d.y);
      if (dx > (d.w + AB) / 2 - 6 || dy > (d.h + AL) / 2 - 8) return;
      if (d.art === 'muenze') {
        d.weg = true; muenzen++;
        R_.ton('gut');
        meldung('+' + MUENZE, F.akzent);
      } else if (d.art === 'loch') {
        // Schlagloch: rumpelt und bremst, kostet aber keine Beule
        if (d.getroffen) return;
        d.getroffen = true; wackeln = 0.3;
        tempo = Math.max(TEMPO_START, tempo * 0.85);
        R_.ton('crash');
        meldung('Rumms!', '#ffd27a');
      } else if (d.art === 'oel') {
        if (rutschen > 0) return;
        rutschen = 0.5;
        const r = spur === 0 ? 1 : spur === SPUREN - 1 ? -1 : (Math.random() < 0.5 ? -1 : 1);
        spur += r;
        R_.ton('wisch');
        meldung('Rutschig!', '#9ad0ff');
      } else if (schutz <= 0) {
        leben--; schutz = 1.4; wackeln = 0.4;
        d.weg = d.art !== 'auto';
        if (d.art === 'auto') d.getroffen = true;
        R_.ton('crash');
        meldung('Blechschaden!', '#ff6b6b');
        tempo = Math.max(TEMPO_START, tempo * 0.8);
        if (leben <= 0) { phase = 'aus'; phaseT = 0; }
      }
    });
  }

  // ---------- Zeichnen ----------
  function groesse(b, h) { B = b; H = h; }

  function zeichne(g, b, h, zustand, dt) {
    B = b; H = h;
    strasseB = Math.min(b * 0.86, Math.max(260, h * 0.55), 520);
    k = strasseB / (SPUREN * 100 + 40);
    strasseX = (b - strasseB) / 2;
    autoY = h - Math.max(80, h * 0.2);
    const zuY = y => autoY - y * k;              // Einheiten vor dem Auto → Bildschirm
    const zuX = s => strasseX + (20 + 50 + s * 100) * k;
    const scroll = zustand === 'start' ? (performance.now() / 1000) * 300 : strecke;
    if (zustand === 'start') deko.forEach(d => { d.y -= dt * 300; if (d.y < -300) d.y += 2200; });

    g.save();
    if (wackeln > 0) g.translate(Math.sin(wackeln * 70) * 6 * wackeln, 0);

    // Wiese
    g.fillStyle = '#3f7d3a';
    g.fillRect(-10, -10, b + 20, h + 20);
    g.fillStyle = 'rgba(0,0,0,.07)';
    const streifen = 120 * k, off = (scroll * k) % (streifen * 2);
    for (let y = -streifen * 2 + off; y < h; y += streifen * 2) g.fillRect(0, y, b, streifen);

    // Straße
    g.fillStyle = '#41454c';
    g.fillRect(strasseX, 0, strasseB, h);
    g.fillStyle = '#e9ecef';
    g.fillRect(strasseX + 8 * k, 0, 5 * k, h);
    g.fillRect(strasseX + strasseB - 13 * k, 0, 5 * k, h);
    const strich = 70 * k, luecke = 60 * k, o = (scroll * k) % (strich + luecke);
    for (let s = 1; s < SPUREN; s++) {
      const x = strasseX + (20 + s * 100) * k - 2.5 * k;
      for (let y = -strich - luecke + o; y < h; y += strich + luecke) g.fillRect(x, y, 5 * k, strich);
    }

    // Bäume und Büsche
    deko.slice().sort((a, c) => c.y - a.y).forEach(d => {
      const x = d.seite < 0 ? strasseX - d.rand * k : strasseX + strasseB + d.rand * k, y = zuY(d.y);
      if (y < -100 || y > h + 100) return;
      const r = (d.art === 'baum' ? 34 : 20) * d.gr * k;
      g.fillStyle = 'rgba(0,0,0,.2)';
      g.beginPath(); g.arc(x + r * 0.25, y + r * 0.3, r, 0, P * 2); g.fill();
      g.fillStyle = d.art === 'baum' ? '#2f6b2c' : '#4f9445';
      g.beginPath(); g.arc(x, y, r, 0, P * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.12)';
      g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, P * 2); g.fill();
    });

    // Werbeschild mit Logo am Straßenrand (kommt regelmäßig vorbei)
    const abstandSchild = 2400, sy = zuY(abstandSchild - (scroll % abstandSchild) - 300);
    schild(g, b, sy);

    // Dinge auf der Straße
    dinge.forEach(d => {
      const x = zuX(d.s), y = zuY(d.y);
      if (y < -120 || y > h + 120) return;
      if (d.art === 'auto') zeichneAuto(g, x, y, d.farbe, false, d.getroffen ? 0.25 : 0, d.bild);
      else if (d.art === 'pylon') pylon(g, x, y);
      else if (d.art === 'bake') bake(g, x, y);
      else if (d.art === 'oel') oel(g, x, y);
      else if (d.art === 'loch') {
        if (LOCH.complete && LOCH.naturalWidth) bildZeichnen(g, LOCH, x, y, 56 * k);
        else { g.fillStyle = 'rgba(10,10,12,.8)'; g.beginPath(); g.ellipse(x, y, 24 * k, 22 * k, 0, 0, P * 2); g.fill(); }
      }
      else if (d.art === 'muenze') muenze(g, x, y);
    });

    // Eigenes Auto (blinkt nach einem Treffer)
    if (!(schutz > 0 && Math.floor(schutz * 10) % 2)) {
      const kipp = (spur - spurX) * 0.35 + (rutschen > 0 ? Math.sin(rutschen * 30) * 0.15 : 0);
      zeichneAuto(g, strasseX + (70 + spurX * 100) * k, autoY, F.haupt, true, kipp);
    }
    g.restore();

    meldungen.forEach(m => {
      const fs = Math.max(20, Math.min(34, b * 0.06));
      g.save();
      g.globalAlpha = Math.min(1, (1.1 - m.t) * 3);
      g.font = `900 ${fs}px ${SCHRIFT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const y = autoY - 90 * k - m.t * 50;
      g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.6)';
      g.strokeText(m.text, b / 2, y);
      g.fillStyle = m.farbe; g.fillText(m.text, b / 2, y);
      g.restore();
    });

    if (zustand === 'spiel' && phase === 'bereit') {
      const los = phaseT > 0.75, fs = Math.max(30, Math.min(60, b * 0.12));
      g.save();
      g.fillStyle = 'rgba(0,0,0,.45)';
      g.fillRect(0, h * 0.4 - fs, b, fs * 2);
      g.font = `900 ${fs}px ${SCHRIFT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = los ? F.akzent : '#fff';
      g.fillText(los ? 'LOS!' : 'Bereit…', b / 2, h * 0.4 + 2);
      g.restore();
    }
    // Hinweis zur Steuerung in den ersten Sekunden
    if (zustand === 'spiel' && phase === 'fahren' && strecke < 2500) {
      g.save();
      g.globalAlpha = Math.min(1, (2500 - strecke) / 800) * 0.8;
      g.fillStyle = '#fff';
      g.font = `700 ${Math.max(14, Math.min(20, b * 0.04))}px ${SCHRIFT}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('◀ links tippen', b * 0.25, h - 26);
      g.fillText('rechts tippen ▶', b * 0.75, h - 26);
      g.restore();
    }
  }

  function schild(g, b, y) {
    if (y < -200 || y > H + 200) return;
    const breit = Math.min(220 * k, (b - strasseX - strasseB) - 20);
    const rechts = breit > 90 * k;   // passt das Schild neben die Straße? Sonst über die Straße spannen
    const w = rechts ? breit : strasseB * 0.8, hh = w * 0.42;
    const x = rechts ? strasseX + strasseB + 14 * k : strasseX + strasseB * 0.1;
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.fillRect(x + 6, y - hh + 8, w, hh);
    g.fillStyle = '#5b4636';
    if (rechts) g.fillRect(x + w / 2 - 4 * k, y, 8 * k, 26 * k);
    else { g.fillRect(strasseX - 6 * k, y - hh / 2 - 3 * k, strasseB + 12 * k, 6 * k); }
    g.fillStyle = '#ffffff';
    g.strokeStyle = F.haupt; g.lineWidth = 4 * k;
    g.beginPath(); g.roundRect(x, y - hh, w, hh, 8 * k); g.fill(); g.stroke();
    R_.zeichneLogo(g, x + w * 0.1, y - hh * 0.88, w * 0.8, hh * 0.76, null, true);
  }

  function zeichneAuto(g, x, y, farbe, mitLogo, kipp, bild) {
    const l = AL * k / 2, b = AB * k / 2, r = 11 * k;
    g.save();
    g.translate(x, y); g.rotate(kipp || 0);
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath(); g.roundRect(-b + 4 * k, -l + 6 * k, b * 2, l * 2, r); g.fill();
    const fremd = bild != null && FREMDE[bild];
    if (!mitLogo && fremd && fremd.complete && fremd.naturalWidth) {
      // gemaltes Auto: so skaliert, dass es genau so lang ist wie das Auto im Spiel
      const s = AL * k / fremd.naturalHeight;
      g.drawImage(fremd, -fremd.naturalWidth * s / 2, -l, fremd.naturalWidth * s, AL * k);
      g.restore();
      return;
    }
    if (mitLogo && spielerAuto) {
      const s = AL * k / BILD_LAENGE, dy = ((DACH[0] + DACH[1]) / 2 - BILD_MITTE) * s, dl = (DACH[1] - DACH[0]) * s;
      g.drawImage(spielerAuto, -spielerAuto.width * s / 2, -BILD_MITTE * s, spielerAuto.width * s, spielerAuto.height * s);
      // Logo längs aufs Dach (von hinten nach vorne lesbar)
      g.save(); g.translate(0, dy); g.rotate(-Math.PI / 2);
      R_.zeichneLogo(g, -dl * 0.42, -b * 0.4, dl * 0.84, b * 0.8, null, R_.textFarbe(farbe) !== '#ffffff');
      g.restore();
      g.restore();
      return;
    }
    g.fillStyle = R_.toenen(farbe, -0.3);
    g.fillRect(-b - 5 * k, -l * 0.3, 6 * k, 8 * k); g.fillRect(b - k, -l * 0.3, 6 * k, 8 * k);
    const kg = g.createLinearGradient(-b, 0, b, 0);
    kg.addColorStop(0, R_.toenen(farbe, -0.18)); kg.addColorStop(0.5, R_.toenen(farbe, 0.12)); kg.addColorStop(1, R_.toenen(farbe, -0.18));
    g.fillStyle = kg;
    g.beginPath(); g.roundRect(-b, -l, b * 2, l * 2, r); g.fill();
    g.fillStyle = 'rgba(25,35,50,.85)';
    g.beginPath(); g.moveTo(-b + 4 * k, -l * 0.38); g.lineTo(b - 4 * k, -l * 0.38); g.lineTo(b - 6 * k, -l * 0.12); g.lineTo(-b + 6 * k, -l * 0.12); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-b + 6 * k, l * 0.5); g.lineTo(b - 6 * k, l * 0.5); g.lineTo(b - 4 * k, l * 0.68); g.lineTo(-b + 4 * k, l * 0.68); g.closePath(); g.fill();
    g.fillStyle = R_.toenen(farbe, 0.06);
    g.beginPath(); g.roundRect(-b + 6 * k, -l * 0.1, b * 2 - 12 * k, l * 0.58, 5 * k); g.fill();
    if (mitLogo) R_.zeichneLogo(g, -b + 8 * k, -l * 0.04, b * 2 - 16 * k, l * 0.46, null, R_.textFarbe(farbe) !== '#ffffff');
    g.fillStyle = '#fff6c8';
    g.fillRect(-b + 4 * k, -l + k, 9 * k, 4 * k); g.fillRect(b - 13 * k, -l + k, 9 * k, 4 * k);
    g.fillStyle = '#e53935';
    g.fillRect(-b + 4 * k, l - 5 * k, 9 * k, 4 * k); g.fillRect(b - 13 * k, l - 5 * k, 9 * k, 4 * k);
    g.restore();
  }

  function pylon(g, x, y) {
    const r = 15 * k;
    if (KEGEL.complete && KEGEL.naturalWidth) {   // gemalter Leitkegel von oben
      g.fillStyle = 'rgba(0,0,0,.3)';
      g.fillRect(x - r + 3 * k, y - r + 4 * k, r * 2, r * 2);
      g.drawImage(KEGEL, x - r * 1.1, y - r * 1.1, r * 2.2, r * 2.2);
      return;
    }
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.beginPath(); g.arc(x + 3 * k, y + 4 * k, r, 0, P * 2); g.fill();
    g.fillStyle = '#ff7a1a';
    g.beginPath(); g.arc(x, y, r, 0, P * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 4 * k;
    g.beginPath(); g.arc(x, y, r * 0.55, 0, P * 2); g.stroke();
  }
  // Gemalte Hindernisse (Baustellenbake, Ölfleck, Schlagloch), auf eine Breite skaliert und mittig gesetzt
  function bildZeichnen(g, bild, x, y, breite) {
    const h = breite * bild.naturalHeight / bild.naturalWidth;
    g.drawImage(bild, x - breite / 2, y - h / 2, breite, h);
  }
  function bake(g, x, y) {
    if (BAKE.complete && BAKE.naturalWidth) return bildZeichnen(g, BAKE, x, y, 92 * k);
    const w = 86 * k, h = 26 * k;
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.fillRect(x - w / 2 + 4 * k, y - h / 2 + 5 * k, w, h);
    g.save();
    g.beginPath(); g.rect(x - w / 2, y - h / 2, w, h); g.clip();
    g.fillStyle = '#fff'; g.fillRect(x - w / 2, y - h / 2, w, h);
    g.fillStyle = '#e53935';
    for (let i = -2; i < 8; i++) {
      const sx = x - w / 2 + i * 18 * k;
      g.beginPath(); g.moveTo(sx, y + h / 2); g.lineTo(sx + 9 * k, y + h / 2); g.lineTo(sx + 9 * k + h, y - h / 2); g.lineTo(sx + h, y - h / 2); g.fill();
    }
    g.restore();
    g.fillStyle = '#ffeb3b';
    g.beginPath(); g.arc(x - w / 2 + 6 * k, y - h / 2, 5 * k, 0, P * 2); g.arc(x + w / 2 - 6 * k, y - h / 2, 5 * k, 0, P * 2); g.fill();
  }
  function oel(g, x, y) {
    if (OEL.complete && OEL.naturalWidth) return bildZeichnen(g, OEL, x, y, 78 * k);
    g.fillStyle = 'rgba(15,15,20,.85)';
    g.beginPath();
    g.ellipse(x, y, 34 * k, 22 * k, 0.3, 0, P * 2);
    g.ellipse(x + 18 * k, y + 10 * k, 16 * k, 12 * k, 0, 0, P * 2);
    g.fill();
    g.fillStyle = 'rgba(140,120,255,.25)';
    g.beginPath(); g.ellipse(x - 8 * k, y - 6 * k, 14 * k, 6 * k, 0.3, 0, P * 2); g.fill();
  }
  function muenze(g, x, y) {
    const r = 20 * k, s = Math.abs(Math.cos(performance.now() / 300)) * 0.75 + 0.25;
    g.save();
    g.translate(x, y); g.scale(s, 1);
    g.fillStyle = R_.toenen(F.akzent, -0.25);
    g.beginPath(); g.arc(2 * k, 2 * k, r, 0, P * 2); g.fill();
    g.fillStyle = F.akzent;
    g.beginPath(); g.arc(0, 0, r, 0, P * 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(0, 0, r * 0.78, 0, P * 2); g.fill();
    R_.zeichneLogo(g, -r * 0.7, -r * 0.35, r * 1.4, r * 0.7, null, true);
    g.restore();
  }

  R_.spiel({
    id: 'autohaus-probefahrt',
    wertung: 'hoch',
    format: p => p + ' Punkte',
    texte: {
      titel: 'Probefahrt',
      untertitel: 'Wie weit kommst du?',
      anleitung: 'Tippe links oder rechts, um die Spur zu wechseln. Weiche Autos und Baustellen aus und sammle Münzen ein. Vorsicht bei Öl und Schlaglöchern! Drei Beulen, dann ist die Probefahrt vorbei.',
      ende: 'Lust auf eine echte Probefahrt? Wir haben den passenden Wagen für dich.',
    },
    // Aufnahmen (Pixabay Content License); 'crash' ersetzt den erzeugten Ton gleichen Namens
    klaenge: {
      klick: { datei: 'klaenge/klick.wav', pegel: 0.35 },   // Ton-Knopf
      crash: { datei: 'klaenge/blechschaden.wav', pegel: 0.5 },
      motor: { datei: 'klaenge/motor-fahrt.wav', pegel: 0.22 },
      musik: { datei: 'klaenge/musik.wav', pegel: 0.1 },   // leise Hintergrundmusik
    },
    schleife: 'musik',
    neu, schritt, zeichne, runter, groesse,
  });
})();
