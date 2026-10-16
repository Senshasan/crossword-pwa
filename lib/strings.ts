// All user-visible text. The app is German only (du-form); add new UI text here, not inline.
export const de = {
  meta: {
    title: "Across & Along – Kreuzworträtsel für die Familie",
    description: "Eine private, werbefreie Kreuzworträtsel-Sammlung für Familie und Freunde.",
  },
  common: {
    loading: "Lädt …",
    refresh: "Aktualisieren",
    retry: "Erneut versuchen",
  },
  app: {
    loadingCollection: "Deine Sammlung wird geladen …",
    loadFailedTitle: "Deine Rätsel konnten nicht geladen werden.",
    loadFailedText: "Prüf deine Verbindung und versuch es noch einmal. Dein Fortschritt ist gespeichert.",
    retrying: "Wird erneut versucht …",
    emptyTitle: "Deine Sammlung wird vorbereitet",
    emptyText: "Es wurden noch keine Rätsel hinzugefügt.",
    checking: "Wird geprüft …",
    refreshFailed: "Aktualisieren fehlgeschlagen. Du siehst deine Rätsel von vorhin.",
    retryingShort: "Versuche …",
    pullRefreshing: "Wird aktualisiert …",
    pullRefreshingSr: "Wird aktualisiert",
    updateReady: "Neue Version verfügbar",
    updateReload: "Neu laden",
  },
  auth: {
    welcome: "Willkommen bei Across & Along",
    checkEmail: "Schau in dein Postfach",
    intro:
      "Eine private Kreuzworträtsel-Sammlung für Familie und Freunde. Du meldest dich mit einem Einmalcode an: kein Passwort, keine Werbung.",
    // The email address goes between these two parts.
    codeSentBefore: "Wir haben dir einen 6-stelligen Code an ",
    codeSentAfter: " geschickt.",
    emailLabel: "E-Mail-Adresse",
    codeLabel: "6-stelliger Code",
    emailPlaceholder: "du@beispiel.de",
    wait: "Einen Moment …",
    sendCode: "Code senden",
    enter: "Zur Sammlung",
    otherEmail: "Andere E-Mail verwenden",
    errors: {
      invalidCode: "Der Code stimmt nicht oder ist abgelaufen. Lass dir bei Bedarf einen neuen schicken.",
      rateLimit: "Zu viele Versuche. Warte kurz und versuch es dann noch einmal.",
      network: "Keine Verbindung. Prüf dein Internet und versuch es noch einmal.",
      invalidEmail: "Diese E-Mail-Adresse sieht nicht richtig aus.",
      generic: "Das hat leider nicht geklappt. Versuch es bitte noch einmal.",
    },
  },
  profile: {
    title: "Wie sollen wir dich nennen?",
    text: "Diesen Namen sehen Familie und Freunde in der Bestenliste.",
    label: "Dein Name",
    placeholder: "z. B. Oma Rosi",
    save: "Namen speichern",
  },
  header: {
    home: "Across & Along, Startseite",
    lightTheme: "Helles Design aktivieren",
    darkTheme: "Dunkles Design aktivieren",
    account: "Konto",
    signOut: "Abmelden",
  },
  leaderboard: {
    failed: "Die Bestenliste konnte nicht geladen werden.",
    empty: "Noch hat niemand ein Rätsel gelöst.",
    title: "Gelöste Rätsel",
    you: "(du)",
  },
  home: {
    heroLead: "Ein bisschen Zeit zusammen, ",
    heroEmphasis: "Kästchen für Kästchen.",
    subtitle: "Eine kostenlose, werbefreie Kreuzworträtsel-Sammlung für Familie und Freunde.",
    installHint: "Auf dem iPhone? Über das Teilen-Menü in Safari kannst du die App zum Home-Bildschirm hinzufügen.",
    allSolved: "Alle Rätsel gelöst",
    continue: "Weiter, wo du aufgehört hast",
    teaser: (number: number, text: string) => `${number} waagerecht: ${text}`,
    collection: "Die Sammlung",
    seeAll: (n: number) => `Alle ${n} ansehen`,
  },
  browse: {
    back: "Start",
    title: "Die Sammlung",
    solvedCount: (solved: number, total: number) => `${solved} von ${total} gelöst`,
    filterLabel: "Rätsel filtern",
    all: "Alle",
    empty: "Hier gibt es noch keine Rätsel.",
  },
  puzzle: {
    standard: "Standard",
    family: "Von der Familie",
    fromAuthor: (name: string) => `Von ${name}`,
    solved: "Gelöst",
  },
  play: {
    back: "Rätsel",
    time: (time: string) => `Zeit ${time}`,
    inputLabel: "Buchstaben eingeben",
    across: "Waagerecht",
    down: "Senkrecht",
    clueRef: (number: number, direction: "across" | "down") =>
      `${number} ${direction === "across" ? "waagerecht" : "senkrecht"}`,
    prevClue: "Vorheriger Hinweis",
    nextClue: "Nächster Hinweis",
    blockedCell: "Schwarzes Feld",
    cell: (row: number, col: number, letter: string) =>
      `Zeile ${row}, Spalte ${col}, ${letter || "leer"}`,
    checkWord: "Wort prüfen",
    checkGrid: "Rätsel prüfen",
    reset: "Zurücksetzen",
    resetConfirm: "Gitter leeren?",
    umlautHint: "Umlaute: AE, OE, UE · ß: SS",
    nothingToCheck: "Noch nichts zum Prüfen.",
    wordCorrect: "Das Wort stimmt!",
    gridCorrect: "Alles richtig!",
    noMistakes: "Bisher kein Fehler.",
    lettersWrong: (n: number) => (n === 1 ? "1 Buchstabe ist falsch." : `${n} Buchstaben sind falsch.`),
    solvedTitle: "Gelöst.",
    solvedIn: "in",
    close: "Schließen",
    backToPuzzles: "Zurück zu den Rätseln",
  },
} as const;

export type Strings = typeof de;

const twoDigits = new Intl.NumberFormat("de-DE", { minimumIntegerDigits: 2, useGrouping: false });

// Solve time as mm:ss (minutes keep counting past 60).
export function formatSolveTime(seconds: number) {
  return `${twoDigits.format(Math.floor(seconds / 60))}:${twoDigits.format(seconds % 60)}`;
}

