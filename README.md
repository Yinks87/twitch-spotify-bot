# twitch-spotify-bot

Electron-App (React), mit der Zuschauer per **Channelpoints** oder **Power-Ups** Spotify-Songs in die
Warteschlange oder eine Playlist wünschen können. Per Chat-Command kann der aktuelle Song im Twitch-Chat
ausgegeben werden, und Zuschauer können den laufenden Song per Abstimmung überspringen.

## Funktionen

- Geführte Ersteinrichtung (Twitch → Song-Request → Spotify → Ziel → Skip), danach Dashboard
- Dashboard mit Verbindungsstatus, Neu-verbinden/Trennen, Spotify-Ablaufdatum der Autorisierung
- Song-Request: Eingabe des Zuschauers ist immer Pflicht (Suchbegriff oder Spotify-Track-Link)
- Channelpoint-Rewards: Name, Kosten, Farbe, max. Einlösungen pro Stream und pro Zuschauer und Stream
  einstellbar; Rewards lassen sich im Dashboard löschen. Ein Reward-Bild kann die Twitch-API nicht setzen
  (nur im Twitch-Dashboard).
- Skip per Abstimmung: Stimmenzahl und Zeitfenster einstellbar (Standard 3 Stimmen / 120 s), jeder Zuschauer
  nur eine Stimme; wird das Ziel nicht erreicht, werden die Stimmen verworfen. Es ist genau ein Auslöser
  aktiv (Channelpoints, Power-Up _oder_ Chat-Command)
- Song-Command mit Cooldown, Variablen `${song}` (Titel - Interpret), `${artist}`, `${url}`, `${user}`
- Alle Chat-Texte einstellbar; Chatnachrichten lassen sich global abschalten
- Twitch-Token wird beim Start, stündlich und vor jedem Chat-Post validiert (bei Bedarf Refresh)
- Twitch-Events (Chat, Channelpoints, Power-Ups) über EventSub-WebSocket
- Action-Log aller Aktionen (aufzeichnen immer, Anzeige optional)

## Einrichtung der Entwickler-Anwendungen

| Plattform | Konsole                                                          | Redirect-URI                                  |
| --------- | ---------------------------------------------------------------- | --------------------------------------------- |
| Twitch    | [dev.twitch.tv/console](https://dev.twitch.tv/console/apps)      | `http://localhost:3131/auth/twitch/callback`  |
| Spotify   | [developer.spotify.com](https://developer.spotify.com/dashboard) | `http://127.0.0.1:3131/auth/spotify/callback` |

Die Autorisierung läuft im Standard-Browser. Der Port `3131` muss frei sein.

Hinweise:

- Twitch-Anwendung: Kategorie **Other**, Client-Typ **Vertraulich**. Spotify-App: bei „API/SDKs“ **Web API**.
- Power-Ups werden über den exakten Titel des eigenen
  (Custom) Power-Ups erkannt; die Zuschauer-Eingabe ist die Song-Eingabe.

## Updates

Die installierte App prüft beim Start auf Updates (GitHub-Releases),
lädt sie automatisch herunter und installiert sie sofort mit Neustart. Ein Release erstellen: Version in `package.json` erhöhen, `GH_TOKEN` (Token mit Schreibrecht
auf das Repo) setzen und `npm run release:win` ausführen. Das veröffentlicht den Installer samt
`latest.yml` als GitHub-Release.