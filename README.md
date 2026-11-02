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

Scopes — Twitch: `channel:manage:redemptions`, `bits:read`, `user:write:chat`, `user:read:chat`;
Spotify: `user-read-playback-state`, `user-modify-playback-state`, `user-read-currently-playing`,
`playlist-modify-public`, `playlist-modify-private`.

Hinweise:

- Twitch-Anwendung: Kategorie **Other**, Client-Typ **Vertraulich**. Spotify-App: bei „API/SDKs“ **Web API**.
- Spotify nutzt den PKCE-Flow (nur Client-ID, kein Client-Secret).
- Eigene Channelpoint-Rewards (Channelpoints-Modus) setzen einen Twitch-Affiliate/Partner-Kanal voraus.
- Genutzte EventSub-Events: `channel.chat.message`, `channel.channel_points_custom_reward_redemption.add`
  und `channel.custom_power_up_redemption.add`. Power-Ups werden über den exakten Titel des eigenen
  (Custom) Power-Ups erkannt; die Zuschauer-Eingabe (`user_input`) ist die Song-Eingabe. Skip und
  Song-Request sollten nicht dasselbe Power-Up verwenden.
- Das Spotify-Refresh-Token gilt laut Annahme 6 Monate; das Dashboard zeigt den Zeitpunkt der nächsten
  nötigen Autorisierung an. Für Queue/Skip ist Spotify Premium und ein aktives Wiedergabegerät nötig.

## Datenspeicherung (electron-store)

Im `userData`-Ordner der App, aufgeteilt in mehrere Dateien: `app.json`, `twitch-auth.json`,
`spotify-auth.json`, `song-request.json`, `skip.json`, `chat.json`, `rewards.json`, `action-log.json`.
Tokens und Client-Secret werden nur im Main-Prozess verwendet; der Renderer erhält nur Einstellungen und
die Client-Zugangsdaten (Secret im UI unscharf mit „Anzeigen“-Button).

## Updates

Die installierte App prüft beim Start auf Updates (GitHub-Releases von `yinks87/twitch-spotify-bot`),
lädt sie automatisch herunter und installiert sie sofort mit Neustart. Im Entwicklungsmodus ist das
deaktiviert. Ein Release erstellen: Version in `package.json` erhöhen, `GH_TOKEN` (Token mit Schreibrecht
auf das Repo) setzen und `npm run release:win` ausführen. Das veröffentlicht den Installer samt
`latest.yml` als GitHub-Release.

## Projekt

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
