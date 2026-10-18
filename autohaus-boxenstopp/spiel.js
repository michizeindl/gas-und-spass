// Boxenstopp: Radmuttern über Kreuz in der richtigen Reihenfolge festziehen – sechs Fahrzeuge vom Kleinwagen
// bis zum Transporter, so schnell wie möglich. Je größer das Rad, desto schwieriger.
(function () {
  'use strict';
  const R_ = Rahmen, F = R_.farben;
  const SCHRIFT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

  // Pro Runde ein Fahrzeug. muttern = Anzahl, dreh = Drehung (Bogenmaß pro Sekunde, minus = gegen den Uhrzeigersinn),
  // groesse = Raddurchmesser im Verhältnis zum größten, felge = Felgendurchmesser im Verhältnis zum Rad,
  // tipps = Tipper pro Mutter, wechsel = Sekunden bis zum Richtungswechsel, farbe = Felge (hell, mittel, dunkel)
  // Gemalte Räder: bild = Datei, nabe / lochkreis / mutter = Radius der Nabenkappe, Abstand der Muttern
  // zur Mitte und Muttergröße im Verhältnis zum Radradius (am Bild abgemessen). Ohne Bild wird gezeichnet.
  const RAEDER = [
    { name: 'Kleinwagen', muttern: 4, dreh: 0, groesse: 0.78, felge: 0.7, farbe: ['#f2f4f7', '#c3c9d1', '#848c96'],
      bild: 'bilder/rad-1.webp', nabe: 0.198, lochkreis: 0.31, mutter: 0.07 },
    { name: 'Kompaktwagen', muttern: 5, dreh: 0, groesse: 0.82, felge: 0.72, farbe: ['#f4f6f9', '#cdd3da', '#8d959f'],
      bild: 'bilder/rad-2.webp', nabe: 0.185, lochkreis: 0.29, mutter: 0.066 },
    { name: 'Kompakt-SUV', muttern: 5, dreh: 0.5, groesse: 0.87, felge: 0.69, farbe: ['#a2a8b0', '#626871', '#3b4047'],
      bild: 'bilder/rad-3.webp', nabe: 0.15, lochkreis: 0.3, mutter: 0.058 },
    { name: 'SUV', muttern: 5, dreh: -0.8, groesse: 0.91, felge: 0.66, farbe: ['#62666c', '#33363b', '#1c1e21'],
      bild: 'bilder/rad-4.webp', nabe: 0.145, lochkreis: 0.29, mutter: 0.056 },
    { name: 'Großer SUV', muttern: 6, dreh: 1.1, groesse: 0.96, felge: 0.66, farbe: ['#ffffff', '#dde1e6', '#9aa2ac'],
      bild: 'bilder/rad-5.webp', nabe: 0.143, lochkreis: 0.29, mutter: 0.055 },
    { name: 'Transporter', muttern: 6, dreh: 1.3, groesse: 1, felge: 0.62, tipps: 2, wechsel: 2.2, farbe: ['#e4e7eb', '#b5bcc5', '#7d8590'],
      bild: 'bilder/rad-6.webp', nabe: 0.19, lochkreis: 0.31, mutter: 0.055, versatz: Math.PI / 6 },
  ];
  // Eigene Fahrzeugnamen aus kunde.js (z. B. Modelle der Marke des Autohauses)
  (R_.kunde.fahrzeuge || []).forEach((n, i) => { if (RAEDER[i] && n) RAEDER[i].name = n; });
  // Gemalte Räder laden; der grüne Bremssattel (#00FF00) wird dabei in die Kundenfarbe umgefärbt
  RAEDER.forEach(r => {
    if (!r.bild) return;
    const img = new Image();
    img.onload = () => { r.fertig = R_.umfaerben(img); };
    img.src = r.bild;
  });

  // Anzugsreihenfolge über Kreuz, wie in der Werkstatt (Lochpositionen im Uhrzeigersinn)
  const KREUZ = { 4: [0, 2, 1, 3], 5: [0, 2, 4, 1, 3], 6: [0, 3, 1, 4, 2, 5] };
  const STRAFE = 1;     // Sekunden pro falsch angetippter Mutter
  const WECHSEL = 0.35; // Sekunden für Rad raus bzw. rein
  const BEREIT = 3;     // Countdown 3 – 2 – 1, dann LOS (passend zu klaenge/start.mp3)
  // Zeit → Punkte (höchstens 1.000, wie in allen Spielen), dazwischen gleichmäßig verteilt.
  // Die Stufengrenzen 900/800/700/550 sind in allen Spielen gleich.
  const ZU_LANGSAM = 120;   // Sekunden (mit Strafzeit): danach Spielende „Zu langsam“ mit 0 Punkten (Nutzerwunsch)
  const PUNKTE = [[15, 1000], [20, 900], [25, 800], [32, 700], [40, 550], [70, 150], [100, 1]];   // ab 100s nur noch 1 Punkt

  let rad, muttern, naechste, zeit, strafe, radStart, radZeiten, winkel, richtung, richtungT, phase, phaseT, wackeln, schilder, ansage, startTon;
  // Geometrie, wird beim Zeichnen berechnet: R = Rad, FR = Felge, LK = Lochkreis, MG = Muttergröße, NB = Nabenkappe
  let cx = 0, cy = 0, R = 100, FR = 70, LK = 43, MG = 10, NB = 25, unten = 80;

  function neuesRad() {
    const n = RAEDER[rad].muttern, versatz = Math.floor(Math.random() * n);
    muttern = [];
    for (let i = 0; i < n; i++) muttern.push({ i, nr: 0, tipps: 0, fest: false, anim: 0 });
    KREUZ[n].forEach((pos, k) => { muttern[(pos + versatz) % n].nr = k + 1; });
    naechste = 1;
    radStart = { zeit, strafe };   // für die Auswertung: Zeit und Strafe je Fahrzeug
    winkel = Math.random() * Math.PI * 2;
    richtung = 1; richtungT = 0;
  }

  function neu() {
    // #runde=6 hinter der Adresse startet direkt bei Runde 6 (zum Testen)
    const sprung = /runde=(\d)/.exec(location.hash);
    rad = sprung ? Math.max(0, Math.min(RAEDER.length - 1, sprung[1] - 1)) : 0;
    zeit = 0; strafe = 0; radZeiten = []; wackeln = 0; schilder = []; ansage = null; startTon = false;
    phase = 'bereit'; phaseT = 0;
    neuesRad();
  }

  function gesamt() { return Math.round((zeit + strafe) * 10) / 10; }
  function punkteAus(t) {
    if (t <= PUNKTE[0][0]) return PUNKTE[0][1];
    for (let i = 1; i < PUNKTE.length; i++) {
      const [t0, p0] = PUNKTE[i - 1], [t1, p1] = PUNKTE[i];
      if (t <= t1) return Math.round(p0 + (p1 - p0) * (t - t0) / (t1 - t0));
    }
    return PUNKTE[PUNKTE.length - 1][1];
  }
  function sekunden(p) { return p.toFixed(1).replace('.', ',') + 's'; }   // ohne Leerzeichen vor dem s (Nutzerwunsch)

  function mutterPos(m) {
    const n = muttern.length, a = winkel + versatz() + m.i * Math.PI * 2 / n - Math.PI / 2;
    return [cx + Math.cos(a) * LK, cy + Math.sin(a) * LK];
  }

  // Drehung der Muttern gegenüber dem Bild (z. B. zwischen die Lüftungslöcher einer Stahlfelge)
  function versatz() { const r = RAEDER[Math.min(rad, RAEDER.length - 1)]; return r.fertig ? r.versatz || 0 : 0; }

  function schild(text, x, y, farbe) { schilder.push({ text, x, y, t: 0, farbe }); }
  function ansagen() {
    const r = RAEDER[rad];
    ansage = { text: `Runde ${rad + 1}: ${r.name}`, zusatz: r.tipps > 1 ? `Jede Mutter ${r.tipps}× tippen!` : '', t: 0 };
  }

  // ---------- Ablauf ----------
  function schritt(dt) {
    const r = RAEDER[rad];
    phaseT += dt;
    wackeln = Math.max(0, wackeln - dt);
    muttern.forEach(m => { m.anim = Math.max(0, m.anim - dt * 3); });
    schilder.forEach(s => { s.t += dt; });
    schilder = schilder.filter(s => s.t < 0.9);
    if (ansage) { ansage.t += dt; if (ansage.t > (ansage.zusatz ? 2.2 : 1.5)) ansage = null; }

    if (phase === 'bereit') {
      if (!startTon) { startTon = true; R_.ton('start'); }   // Countdown: Piep bei 3, 2, 1 und LOS
      if (phaseT > BEREIT + 0.35) { phase = 'rad'; phaseT = 0; ansagen(); }
    }
    else if (phase === 'rad') {
      zeit += dt;
      if (zeit + strafe >= ZU_LANGSAM && R_.zustand === 'spiel') {   // Zeit abgelaufen: Spielende mit 0 Punkten
        phase = 'aus';
        R_.ton('fehler'); R_.vibrieren([200, 80, 200]);
        R_.ende(0, { ueberschrift: 'Zu langsam', auswertung: auswertung(true), verzoegerung: 300 });
        return;
      }
      if (r.wechsel) { richtungT += dt; if (richtungT > r.wechsel) { richtungT = 0; richtung = -richtung; } }
      winkel += r.dreh * richtung * dt;
    }
    else if (phase === 'raus' && phaseT > WECHSEL) { rad++; neuesRad(); phase = 'rein'; phaseT = 0; ansagen(); }
    else if (phase === 'rein' && phaseT > WECHSEL) { phase = 'rad'; phaseT = 0; }
    else if (phase === 'fertig' && phaseT > 0.5 && R_.zustand === 'spiel') {
      const t = gesamt();
      R_.ton('sieg');
      R_.ende(punkteAus(t), {
        ueberschrift: t < 20 ? 'Formel-1-Niveau' : t < 25 ? 'Profi-Mechaniker' : t < 32 ? 'Gute Arbeit' : t < 40 ? 'Passt schon' : 'Endlich fertig',
        zusatz: sekunden(t),
        auswertung: auswertung(false),
      });
    }
    const nr = Math.min(rad, RAEDER.length - 1);
    R_.anzeige(`Runde ${nr + 1}/${RAEDER.length} – ${RAEDER[nr].name}`, sekunden(zeit + strafe));
  }

  // Für das Endbild: Zeit je Fahrzeug. Balken im Verhältnis zu einer flotten Zeit für dieses Rad
  // (je Mutter und Tipp 0,45 s), damit große Räder nicht unfair wirken. Bei „Zu langsam“: aktuelles Rad rot, Rest grau.
  function auswertung(abgebrochen) {
    return {
      zeilen: RAEDER.map((r, i) => {
        const z = radZeiten.find(x => x.rad === i);
        if (z) {
          const flott = r.muttern * (r.tipps || 1) * 0.45;
          return { name: r.name, zusatz: z.strafe ? '+' + Math.round(z.strafe) + 's' : '', anteil: Math.min(1, flott / z.t), wert: sekunden(z.t) };
        }
        if (abgebrochen && i === rad) return { name: r.name, anteil: 0, wert: 'Aus', schlecht: true };
        return abgebrochen ? { name: r.name, anteil: null, wert: '–' } : null;
      }).filter(Boolean),
    };
  }

  function runter(x, y) {
    if (phase !== 'rad') return;
    // Trefferkreis großzügig, aber nie bis zur Nachbarmutter
    let beste = null, d2 = Math.min(Math.max(MG * 2, 24), LK * Math.sin(Math.PI / muttern.length) * 0.95) ** 2;
    muttern.forEach(m => {
      const [mx, my] = mutterPos(m), d = (mx - x) ** 2 + (my - y) ** 2;
      if (d < d2) { d2 = d; beste = m; }
    });
    if (!beste) return;
    const [mx, my] = mutterPos(beste);
    if (beste.nr === naechste) {   // schon feste Muttern haben eine kleinere Nummer und zählen unten als Fehler
      beste.tipps++;
      if (beste.tipps < (RAEDER[rad].tipps || 1)) {   // Transporter: erst halb angezogen
        beste.anim = 0.6;
        R_.ton('ratsche');
        return;
      }
      beste.fest = true; beste.anim = 1; naechste++;
      R_.ton('schlagschrauber');
      if (naechste > muttern.length) {
        radZeiten.push({ rad, t: zeit + strafe - radStart.zeit - radStart.strafe, strafe: strafe - radStart.strafe });
        R_.ton('rad-fertig');
        if (rad < RAEDER.length - 1) R_.ton('rad-rollen');
        schild('Rad fertig!', cx, cy - R * 1.05, '#7bd88f');
        phase = rad === RAEDER.length - 1 ? 'fertig' : 'raus';
        phaseT = 0;
      }
    } else {
      strafe += STRAFE; wackeln = 0.35;
      R_.ton('fehler'); R_.vibrieren(80);
      schild('+' + STRAFE + 's', mx, my - MG * 1.3, '#ff6b6b');
    }
  }

  // ---------- Zeichnen ----------
  function zeichne(g, B, H, zustand, dt) {
    unten = Math.max(48, Math.min(80, H * 0.12));
    const oben = 54, platz = H - oben - unten - 8;
    const rMax = Math.max(40, Math.min(B * 0.44, platz * 0.46));
    const r = RAEDER[Math.min(rad, RAEDER.length - 1)];
    R = rMax * r.groesse;
    FR = R * r.felge;
    if (r.fertig) { LK = R * r.lochkreis; MG = Math.max(12, R * r.mutter); NB = R * r.nabe; }
    else { LK = FR * 0.62; MG = FR * 0.15; NB = FR * 0.35; }
    cy = oben + platz / 2;
    cx = B / 2;
    if (zustand === 'start') winkel += dt * 0.25;

    hintergrund(g, B, H, rMax);

    // Rad rein- und rausrollen, wackeln bei Fehlern
    let dx = 0;
    if (phase === 'raus') dx = -((phaseT / WECHSEL) ** 2) * (B / 2 + R * 1.2);
    if (phase === 'rein') dx = (1 - phaseT / WECHSEL) ** 2 * (B / 2 + R * 1.2);
    if (wackeln > 0) dx += Math.sin(wackeln * 60) * R * 0.04 * (wackeln / 0.35);
    const rollen = dx / R; // beim Rollen dreht sich das Rad mit
    g.save();
    g.translate(dx, 0);
    zeichneRad(g, r, zustand !== 'start', rollen);
    g.restore();

    zeichneFortschritt(g, B, H);

    schilder.forEach(s => {
      g.save();
      g.globalAlpha = 1 - s.t / 0.9;
      g.font = `800 ${Math.round(rMax * 0.15)}px ${SCHRIFT}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.6)';
      g.strokeText(s.text, s.x, s.y - s.t * 40);
      g.fillStyle = s.farbe;
      g.fillText(s.text, s.x, s.y - s.t * 40);
      g.restore();
    });

    // Name des Fahrzeugs zu Beginn jeder Runde
    if (ansage && zustand === 'spiel') {
      const dauer = ansage.zusatz ? 2.2 : 1.5, fs = Math.max(18, Math.min(34, B * 0.065));
      g.save();
      g.globalAlpha = Math.min(1, ansage.t * 6, (dauer - ansage.t) * 4);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.65)';
      g.font = `900 ${fs}px ${SCHRIFT}`;
      const y = Math.max(oben + fs * 0.7, cy - rMax - fs * 0.2);
      g.strokeText(ansage.text, cx, y);
      g.fillStyle = '#fff'; g.fillText(ansage.text, cx, y);
      if (ansage.zusatz) {
        g.font = `800 ${fs * 0.75}px ${SCHRIFT}`;
        g.strokeText(ansage.zusatz, cx, y + fs * 1.05);
        g.fillStyle = F.akzent; g.fillText(ansage.zusatz, cx, y + fs * 1.05);
      }
      g.restore();
    }

    if (zustand === 'spiel' && phase === 'bereit') {
      const los = phaseT >= BEREIT, zahl = BEREIT - Math.floor(phaseT);
      g.save();
      g.fillStyle = 'rgba(0,0,0,.45)';
      g.fillRect(0, cy - rMax * 0.25, B, rMax * 0.5);
      g.font = `900 ${Math.round(rMax * 0.3)}px ${SCHRIFT}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = los ? F.akzent : '#fff';
      g.fillText(los ? 'LOS!' : String(zahl), cx, cy + 2);
      g.restore();
    }
  }

  // Fotografierter Hintergrund (stark unscharf), je ein Bild für Hoch- und Querformat
  const FOTO = { hoch: new Image(), quer: new Image() };
  FOTO.hoch.src = 'bilder/werkstatt-hoch.webp';
  FOTO.quer.src = 'bilder/werkstatt-quer.webp';

  function hintergrund(g, B, H, rMax) {
    const foto = B > H ? FOTO.quer : FOTO.hoch;
    if (foto.complete && foto.naturalWidth) return fotoHintergrund(g, B, H, rMax, foto);
    // Werkstattwand
    const w = g.createLinearGradient(0, 0, 0, H);
    w.addColorStop(0, R_.toenen(F.dunkel, 0.12));
    w.addColorStop(1, R_.toenen(F.dunkel, -0.2));
    g.fillStyle = w;
    g.fillRect(0, 0, B, H);
    g.strokeStyle = 'rgba(255,255,255,.04)';
    g.lineWidth = 2;
    for (let x = (B / 2) % 90; x < B; x += 90) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    // Licht hinter dem Rad
    const l = g.createRadialGradient(cx, cy, rMax * 0.2, cx, cy, rMax * 1.8);
    l.addColorStop(0, R_.mitAlpha(F.haupt, 0.28));
    l.addColorStop(1, R_.mitAlpha(F.haupt, 0));
    g.fillStyle = l;
    g.fillRect(0, 0, B, H);
    // Boden mit Warnstreifen
    const y = H - unten - 4;
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(0, y, B, H - y);
    g.save();
    g.beginPath(); g.rect(0, y, B, 8); g.clip();
    g.fillStyle = F.akzent; g.fillRect(0, y, B, 8);
    g.fillStyle = '#111';
    for (let x = -20; x < B + 20; x += 24) { g.beginPath(); g.moveTo(x, y + 8); g.lineTo(x + 12, y + 8); g.lineTo(x + 20, y); g.lineTo(x + 8, y); g.fill(); }
    g.restore();
  }

  function fotoHintergrund(g, B, H, rMax, foto) {
    // Bild füllt die Fläche (wird an den Seiten bzw. oben/unten beschnitten)
    const f = Math.max(B / foto.naturalWidth, H / foto.naturalHeight);
    const w = foto.naturalWidth * f, h = foto.naturalHeight * f;
    g.drawImage(foto, (B - w) / 2, (H - h) / 2, w, h);
    // oben abdunkeln, damit die Anzeige lesbar bleibt
    const o = g.createLinearGradient(0, 0, 0, 90);
    o.addColorStop(0, 'rgba(0,0,0,.55)'); o.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = o; g.fillRect(0, 0, B, 90);
    // dunkler Hof hinter dem Rad, damit es sich abhebt
    const l = g.createRadialGradient(cx, cy, rMax * 0.6, cx, cy, rMax * 1.7);
    l.addColorStop(0, 'rgba(0,0,0,.35)'); l.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = l; g.fillRect(0, 0, B, H);
    // Boden mit Warnstreifen für die Fortschrittsanzeige
    const y = H - unten - 4;
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(0, y, B, H - y);
    g.save();
    g.beginPath(); g.rect(0, y, B, 8); g.clip();
    g.fillStyle = F.akzent; g.fillRect(0, y, B, 8);
    g.fillStyle = '#111';
    for (let x = -20; x < B + 20; x += 24) { g.beginPath(); g.moveTo(x, y + 8); g.lineTo(x + 12, y + 8); g.lineTo(x + 20, y); g.lineTo(x + 8, y); g.fill(); }
    g.restore();
  }

  function zeichneRad(g, r, zahlen, rollen) {
    const w = winkel + rollen, n = muttern.length;
    // Schatten
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath(); g.ellipse(cx, cy + R * 1.02, R * 0.85, R * 0.1, 0, 0, Math.PI * 2); g.fill();
    if (r.fertig) {
      // Gemaltes Rad, dreht sich als Ganzes
      g.save();
      g.translate(cx, cy); g.rotate(w);
      g.drawImage(r.fertig, -R, -R, R * 2, R * 2);
      g.restore();
    } else {
      gezeichnetesRad(g, r, w, n);
    }
    // Logo auf der Nabenkappe (bleibt aufrecht, damit man es lesen kann)
    R_.zeichneLogo(g, cx - NB * 0.8, cy - NB * 0.4, NB * 1.6, NB * 0.8, null, true);
    zeichneMuttern(g, r, w, n, zahlen);
  }

  function gezeichnetesRad(g, r, w, n) {
    // Reifen mit Profil (große Räder mit gröberem Profil)
    const stollen = Math.round(44 - r.groesse * 16);
    g.fillStyle = '#18191b';
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2c2e31'; g.lineWidth = R * (0.025 + r.groesse * 0.035);
    for (let k = 0; k < stollen; k++) {
      const a = w + k * Math.PI * 2 / stollen;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86);
      g.lineTo(cx + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.98);
      g.stroke();
    }
    g.strokeStyle = '#303236'; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, (R + FR) / 2 + R * 0.04, 0, Math.PI * 2); g.stroke();
    // Felge
    const f = g.createRadialGradient(cx - FR * 0.3, cy - FR * 0.35, FR * 0.07, cx, cy, FR);
    f.addColorStop(0, r.farbe[0]); f.addColorStop(0.6, r.farbe[1]); f.addColorStop(1, r.farbe[2]);
    g.fillStyle = f;
    g.beginPath(); g.arc(cx, cy, FR, 0, Math.PI * 2); g.fill();
    // Fenster zwischen den Speichen, dahinter Bremsscheibe und Bremssattel in Kundenfarbe
    const fenster = new Path2D(), halb = Math.PI / n * 0.55;
    for (let k = 0; k < n; k++) {
      const a = w + (k + 0.5) * Math.PI * 2 / n - Math.PI / 2;
      fenster.moveTo(cx + Math.cos(a - halb * 0.55) * FR * 0.42, cy + Math.sin(a - halb * 0.55) * FR * 0.42);
      fenster.arc(cx, cy, FR * 0.88, a - halb, a + halb);
      fenster.arc(cx, cy, FR * 0.42, a + halb * 0.55, a - halb * 0.55, true);
      fenster.closePath();
    }
    g.save();
    g.clip(fenster);
    g.fillStyle = '#3a3f46'; g.fillRect(cx - R, cy - R, R * 2, R * 2);
    g.strokeStyle = '#2a2e33'; g.lineWidth = FR * 0.04;
    for (let k = 0.47; k < 0.9; k += 0.1) { g.beginPath(); g.arc(cx, cy, FR * k, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = F.haupt;
    g.beginPath(); g.roundRect(cx + FR * 0.53, cy - FR * 0.42, FR * 0.36, FR * 0.84, FR * 0.11); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5;
    g.stroke(fenster);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = FR * 0.04;
    g.beginPath(); g.arc(cx, cy, FR * 0.98, 0, Math.PI * 2); g.stroke();
    // Nabendeckel
    g.fillStyle = '#f6f7f9';
    g.beginPath(); g.arc(cx, cy, NB, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#9aa1ab'; g.lineWidth = 2; g.stroke();
  }

  function zeichneMuttern(g, r, w, n, zahlen) {
    const noetig = r.tipps || 1;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    muttern.forEach(m => {
      const a = w + versatz() + m.i * Math.PI * 2 / n - Math.PI / 2;
      const x = cx + Math.cos(a) * LK, y = cy + Math.sin(a) * LK;
      const gr = MG * (m.fest ? 0.8 : 1) * (1 + m.anim * 0.25);
      if (m.anim > 0) {
        g.fillStyle = R_.mitAlpha(F.akzent, m.anim * 0.6);
        g.beginPath(); g.arc(x, y, gr * (1.4 + (1 - m.anim)), 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = 'rgba(0,0,0,.35)';
      sechseck(g, x + 2, y + 3, gr, w + m.anim * 2);
      g.fill();
      g.fillStyle = m.fest ? '#7d848d' : '#dfe3e8';
      g.strokeStyle = m.fest ? '#4b5057' : '#5d636b';
      g.lineWidth = 2;
      sechseck(g, x, y, gr, w + m.anim * 2);
      g.fill(); g.stroke();
      // halb angezogen: Ring zeigt den Fortschritt
      if (!m.fest && m.tipps > 0) {
        g.strokeStyle = F.akzent; g.lineWidth = Math.max(3, MG * 0.23);
        g.beginPath(); g.arc(x, y, gr * 1.25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * m.tipps / noetig); g.stroke();
      }
      if (m.fest) {
        g.strokeStyle = '#7bd88f'; g.lineWidth = Math.max(2, MG * 0.23);
        g.beginPath(); g.moveTo(x - gr * 0.45, y); g.lineTo(x - gr * 0.1, y + gr * 0.35); g.lineTo(x + gr * 0.5, y - gr * 0.35); g.stroke();
      } else if (zahlen) {
        g.fillStyle = '#1b1f27';
        g.font = `800 ${Math.round(MG * 1.13)}px ${SCHRIFT}`;
        g.fillText(m.nr, x, y + 1);
      }
    });
  }

  function sechseck(g, x, y, r, a) {
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const b = a + k * Math.PI / 3;
      g[k ? 'lineTo' : 'moveTo'](x + Math.cos(b) * r, y + Math.sin(b) * r);
    }
    g.closePath();
  }

  // Fortschritt unten: ein Reifen pro Fahrzeug, von klein nach groß
  function zeichneFortschritt(g, B, H) {
    const y = H - unten / 2 - 2, rGross = Math.min(unten * 0.36, B / (RAEDER.length * 2.6));
    const abst = rGross * 2.5, x0 = B / 2 - abst * (RAEDER.length - 1) / 2;
    const blink = 0.5 + 0.5 * Math.sin(performance.now() / 150);
    RAEDER.forEach((r, i) => {
      const rr = rGross * (0.55 + 0.45 * r.groesse), x = x0 + i * abst;
      const fertig = i < rad || (i === rad && (phase === 'raus' || phase === 'fertig'));
      const dran = i === rad && !fertig && R_.zustand === 'spiel';
      g.fillStyle = '#18191b';
      g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
      g.fillStyle = fertig ? '#43a047' : dran ? R_.mitAlpha(F.akzent, 0.55 + 0.45 * blink) : '#5a5f67';
      g.beginPath(); g.arc(x, y, rr * r.felge, 0, Math.PI * 2); g.fill();
      if (fertig) {
        g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, rr * 0.18);
        g.beginPath(); g.moveTo(x - rr * 0.3, y); g.lineTo(x - rr * 0.07, y + rr * 0.24); g.lineTo(x + rr * 0.33, y - rr * 0.24); g.stroke();
      }
    });
  }

  R_.spiel({
    id: 'reifenwechsel',   // neuer Name: Bestwerte zählen seit der Umstellung auf 1.000 Punkte neu
    wertung: 'hoch',
    format: p => p.toLocaleString('de-DE') + ' Punkte',
    hoechst: 1000,
    texte: {
      titel: 'Reifenwechsel',
      untertitel: 'Wie schnell bist du?',
      anleitung: 'Zieh die Radmuttern über Kreuz fest: Tippe sie in der Reihenfolge 1, 2, 3… an. Sechs Fahrzeuge vom Kleinwagen bis zum Transporter – je größer das Rad, desto kniffliger. Jede falsche Mutter kostet eine Sekunde. Je schneller, desto mehr Punkte.',
      ende: 'Reifenwechsel ohne Stress? Das übernimmt unsere Werkstatt für dich.',
    },
    // Aufnahmen: Pixabay Content License; Werkstatt-Geräusch von Freesound (CC BY 3.0, Namensnennung in quellen)
    klaenge: {
      klick: { datei: 'klaenge/klick.wav', pegel: 0.35 },   // Ton-Knopf
      schlagschrauber: { datei: 'klaenge/schlagschrauber.wav', pegel: 0.45 },
      ratsche: { datei: 'klaenge/ratsche.wav', pegel: 0.4 },
      fehler: { datei: 'klaenge/fehler.wav', pegel: 0.3 },
      'rad-fertig': { datei: 'klaenge/rad-fertig.wav', pegel: 0.3 },
      'rad-rollen': { datei: 'klaenge/rad-rollen.wav', pegel: 0.35 },
      start: { datei: 'klaenge/start.mp3', proben: 77760, pegel: 0.3 },
      sieg: { datei: 'klaenge/sieg.mp3', proben: 72765, pegel: 0.45 },
      bestwert: { datei: 'klaenge/bestwert.mp3', proben: 37485, pegel: 0.4 },
      werkstatt: { datei: 'klaenge/werkstatt.mp3', proben: 522270, pegel: 0.1 },
    },
    schleife: 'werkstatt',
    quellen: 'Werkstatt-Geräusche: „Auto Repair Shop with Pneumatic Drill Sounds“ von ericreinert (freesound.org), Lizenz CC BY 3.0, gekürzt. Weitere Klänge: Pixabay.',
    neu, schritt, zeichne, runter,
  });
})();
