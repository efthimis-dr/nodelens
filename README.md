<p align="center">
  <img src="nl-banner-1000x300.pnghttps://raw.githubusercontent.com/efthimis-dr/nodelens/main/nl-banner-1000x300.png" alt="nodeLens Banner">
</p>

[![npm version](https://img.shields.io/npm/v/@efthimis.dr%2Fnodelens.svg)](https://www.npmjs.com/package/@efthimis.dr/nodelens)

# About nodeLens

nodeLens is a fast and lightweight file-watcher that automatically restarts your Node.js server after file changes.

# Platform Support

nodeLens uses [Chokidar](https://github.com/paulmillr/chokidar), so it supports:

- Windows
- Linux
- macOS
- Docker*

\* Docker bind mounts on macOS/Windows depend on Docker Desktop performance.

# Installation

## Global

```bash
npm i -g "@efthimis.dr/nodelens"
```

## Local

```bash
npm i "@efthimis.dr/nodelens"
```

## After Installation (optional)

You can configure nodelens using the `nodelens config init` command. (more info [here](#nodelens-configuration))

# Quick Start

```bash
nodelens <entry-file>
```

# Project Structure

```
project-root/
│ index.js (or any preferred name)
│ .nodelens/
│   ├ nl.config.json  (if config is initialized)
│   └ nodelens.txt    (if saveLogs is enabled)
```

# Main Commands

| Command               | Description           |
| --------------------- | --------------------- |
| `nodelens help`       | Shows help view       |
| `nodelens version`    | Shows current version |
| `nodelens clear-logs` | Clears nodelens.txt   |

# Runtime Commands

While nodeLens is running, you can run commands in the console:

| Command       | Description            |
| ------------- | ---------------------- |
| `rs`          | Restarts the server    |
| `stop`        | Stops nodeLens         |
| `status`      | Shows watcher status   |
| `last-change` | Shows last file change |
| `silent`      | Toggles silent mode    |
| `help`        | Shows runtime help     |
| `clear`       | Clears the console     |

# Features

- Automatic restarts on file changes
- Configurable ignore/watch patterns
- Runtime commands (rs, stop, clear…)
- Clean, readable logs with labels and timestamps
- Logs saving
- Instant restarts (debounced)
- Crash detection

# nodeLens Configuration

nodeLens includes an optional configuration file named `nl.config.json`.

## Config Commands

You can manage the config file using:

```bash
nodelens config init # Creates nl.config.json
nodelens config reset # Resets it to default settings
nodelens config delete # Deletes the config file
```

## Config Structure

```json
{
  "watch": "all",
  "ignore": ["node_modules", ".git", "dist", "build", "temp", "logs"],
  "debounceDelay": 200,
  "restartDelay": 0,
  "logLabel": true,
  "logTimestamp": false,
  "silentLogs": false,
  "saveLogs": false
}
```

## watch

Controls which files/folders nodeLens should monitor.

- `"all"`: Watch everything (default)
- or specify an array of patterns (files/folders/globs/regex)

```json
"watch": ["src", "routes", "index.js"]
```

## ignore

Controls which files/folders nodeLens should ignore.

- nodeLens already includes common ignores
- but you can specify your own patterns

```json
"ignore": ["node_modules", "dist", ".git"]
```

## debounceDelay

Milliseconds to wait after the last file change before restarting the server.

```json
"debounceDelay": 225
```

Useful for projects that output many files rapidly.

## restartDelay

Additional milliseconds to wait before restarting. (after debounce)

```json
"restartDelay": 0
```

## logLabel

Shows log labels like `[INFO]`, `[ERROR]`... at the start of a log. (after timestamp)

```json
"logLabel": true
```

Included labels: `[INFO]`, `[ERROR]`, `[WARN]`, `[SUCCESS]`

## logTimestamp

Shows a timestamp like [HH:MM:SS] at the start of a log. (before label)

```json
"logTimestamp": true
```

## silentLogs

Hides all logs except `[ERROR]` and `[WARN]`

```json
"silentLogs": true
```

## saveLogs

Saves all logs to `.nodelens/nodelens.txt`.

```json
"saveLogs": true
```

# Links

- [npm](https://www.npmjs.com/package/@efthimis.dr/nodelens)
- [GitHub](https://github.com/efthimis/nodelens)
- [Report an issue](https://github.com/efthimis/nodelens/issues)
- [Get Support](https://github.com/efthimis/nodelens/discussions)
- [Donate](https://www.paypal.com/donate/?hosted_button_id=K2NBKKED548D4)

# License

MIT + Commons Clause<br>
By Efthimis Drolapas — © 2025
