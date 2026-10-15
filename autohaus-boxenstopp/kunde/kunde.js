// Kundendaten – nur diese Datei und das Logo ändern sich pro Kunde.
// Fehlt ein Eintrag, nimmt das Spiel den Standard.
window.KUNDE = {
  firma: 'Autohaus Zeindl',

  // Logo im Ordner kunde/ (SVG oder PNG, am besten mit transparentem Hintergrund)
  // Aus der EPS-Datei des Autohauses umgewandelt (silbern, mit Slogan)
  logo: 'kunde/logo.svg',
  // Logo für helle Flächen im Spiel (Radnabe, Schilder, Münzen)
  logoAufHell: 'kunde/logo-dunkel.svg',

  // Farben als Hex-Code: haupt = Markenfarbe, akzent = Hervorhebung, dunkel = Hintergrund, hell = Schrift
  farben: { haupt: '#f7d900', akzent: '#f7d900', dunkel: '#0d0d0d', hell: '#ffffff' },

  // Texte überschreiben (alle optional): titel, untertitel, anleitung, ende, endeTitel
  texte: {
    ende: 'Reifenwechsel ohne Stress? Das übernimmt die Werkstatt vom Autohaus Zeindl in Malching.',
  },

  // Fahrzeuge der sechs Runden, vom kleinsten zum größten Rad
  // (ohne Eintrag: Kleinwagen, Kompaktwagen, Kompakt-SUV, SUV, Großer SUV, Transporter)
  fahrzeuge: ['Corsa', 'Astra', 'Mokka', 'Frontera', 'Grandland', 'Vivaro'],

  // Startseite mit allen Spielen (Haus-Knopf oben links und Knopf im Start-/Endbild); weglassen, wenn das Spiel allein läuft
  startseite: '../',

  // Knopf am Ende (ohne link wird er nicht gezeigt)
  knopf: { text: 'Zum Autohaus Zeindl', link: 'https://www.auto-zeindl.de/' },
};
