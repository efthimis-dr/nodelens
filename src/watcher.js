// ================ IMPORTS ================

import chokidar from "chokidar";
import { spawn } from "child_process";
import path from "path";
import readline from "readline/promises";
import { loadConfig, DEFAULT_CONFIG } from "./commands.js";
import { log, setLogStyle } from "./utils/logger.js";
import fs from "fs";

// ================ INTERNAL STATE ================

let server = null;
let restartTimer = null;
let projectWatcher = null;
let configWatcher = null;
let configDebounceTimer = null;
let effectiveConfig = null;
let silentOverride = null;

// Internal files/folders that should always be ignored by watchers
const INTERNAL_ALWAYS_IGNORE = [".nodelens", "nl.config.json"];

// Stores last file change metadata for status reporting
let lastChange = {
    file: null,
    event: null,
    timestamp: null
};

// ================ UTILITIES ================

// Formats a timestamp as human-readable "time ago" string
function formatAgoFull(timestamp) {
    const diff = Math.max(0, Date.now() - timestamp.getTime());

    let seconds = Math.floor(diff / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);

    seconds %= 60;
    minutes %= 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(", ") + " ago";
}

// Converts Windows backslashes to forward slashes for path normalization
function toForwardSlashes(p) {
    return p.replace(/\\/g, "/");
}

// Converts a user pattern (string or RegExp) to a valid RegExp object
function patternToRegExp(pattern) {
    if (pattern instanceof RegExp) return pattern;

    let str = String(pattern).trim();
    if (!str) return /.^/;

    if (str.includes("*")) {
        const escaped = str.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
        const source = escaped.replace(/\*/g, ".*");
        return new RegExp(source);
    }

    try {
        return new RegExp(str);
    } catch {
        const escaped = str.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(escaped);
    }
}

// Merges provided config with DEFAULT_CONFIG for a full effective configuration
function buildEffectiveConfig(rawConfig) {
    if (!rawConfig || typeof rawConfig !== "object") {
        return { ...DEFAULT_CONFIG };
    }

    return {
        ...DEFAULT_CONFIG,
        ...rawConfig
    };
}

// ================ WATCHERS ================

/**
 * Creates the main project watcher that restarts the server when files change
 */
function createProjectWatcher(entry, projectRoot, effectiveConfigRef) {
    const { watch, ignore, debounceDelay, restartDelay } = effectiveConfigRef;

    const debounceMs =
        typeof debounceDelay === "number" && debounceDelay >= 0
            ? debounceDelay
            : DEFAULT_CONFIG.debounceDelay;

    const restartDelayMs =
        typeof restartDelay === "number" && restartDelay >= 0
            ? restartDelay
            : DEFAULT_CONFIG.restartDelay;

    const userIgnoreList = Array.isArray(ignore) ? ignore : [ignore];
    const finalIgnoreList = [...userIgnoreList, ...INTERNAL_ALWAYS_IGNORE];
    const ignoreRegexes = finalIgnoreList.map(patternToRegExp);

    let watchRegexes = null;
    if (watch !== "all" && Array.isArray(watch)) {
        watchRegexes = watch.map(patternToRegExp);
    } else if (watch !== "all") {
        watchRegexes = [patternToRegExp(watch)];
    }

    const watcher = chokidar.watch(projectRoot, {
        ignoreInitial: true,
        persistent: true
    });

    watcher.on("all", (event, filePath) => {
        const rel = toForwardSlashes(path.relative(projectRoot, filePath));
        if (!rel) return;

        // Skip ignored files
        if (ignoreRegexes.some(re => re.test(rel))) return;
        // Skip files outside watched patterns
        if (watchRegexes && !watchRegexes.some(re => re.test(rel))) return;

        // Record latest file change
        if (["add", "change", "unlink"].includes(event)) {
            lastChange = {
                file: rel,
                event,
                timestamp: new Date()
            };
        }

        // Trigger restart debounce
        if (!restartTimer) {
            log.separator();
            log.info(`Change in ${rel}. Restarting...`);
        }

        if (restartTimer) clearTimeout(restartTimer);

        restartTimer = setTimeout(() => {
            const doRestart = () => {
                if (server) server.kill();
                startServer(entry);
                restartTimer = null;
            };

            if (restartDelayMs > 0) {
                setTimeout(doRestart, restartDelayMs);
            } else {
                doRestart();
            }
        }, debounceMs);
    });

    return watcher;
}

/**
 * Creates watcher for detecting changes in nl.config.json
 */
function createConfigWatcher(projectRoot, onConfigUpdate) {
    const configDir = path.join(projectRoot, ".nodelens");

    const watcher = chokidar.watch(configDir, {
        ignoreInitial: true,
        persistent: true
    });

    watcher.on("all", (event, filePath) => {
        if (!filePath.endsWith("nl.config.json")) return;

        const configDebounceMs =
            typeof DEFAULT_CONFIG.debounceDelay === "number"
                ? DEFAULT_CONFIG.debounceDelay
                : 200;

        if (configDebounceTimer) clearTimeout(configDebounceTimer);

        configDebounceTimer = setTimeout(() => {
            log.separator();
            log.info("nl.config.json changed. Reloading config...");

            const raw = loadConfig();
            if (!raw) {
                log.warn("Config unreadable. Keeping previous...");
                return;
            }

            let newEffectiveConfig = buildEffectiveConfig(raw);

            // Preserve manual silent override from runtime commands
            if (silentOverride !== null) {
                newEffectiveConfig.silentLogs = silentOverride;
            }

            newEffectiveConfig.logFile = newEffectiveConfig.saveLogs
                ? path.join(projectRoot, ".nodelens", "nodelens.txt")
                : null;

            setLogStyle(newEffectiveConfig);
            effectiveConfig = newEffectiveConfig;

            onConfigUpdate(newEffectiveConfig);
            configDebounceTimer = null;
        }, configDebounceMs);
    });

    return watcher;
}

// ================ MAIN WATCHER CONTROLLER ================

/**
 * Starts the watcher, server, and CLI interface for runtime commands
 */
export function startWatcher(entry) {
    const entryPath = path.resolve(entry);
    const projectRoot = path.dirname(entryPath);
    const raw = loadConfig();

    // Merge default config with loaded one
    effectiveConfig = raw
        ? buildEffectiveConfig(raw)
        : { ...DEFAULT_CONFIG };

    effectiveConfig.logFile = effectiveConfig.saveLogs
        ? path.join(projectRoot, ".nodelens", "nodelens.txt")
        : null;

    setLogStyle(effectiveConfig);

    // ---------------- Start server process ----------------

    startServer(entry);
    log.separator();
    log.info(`\x1b[32mStarting \`node ${entry}\`\x1b[0m`);

    if (fs.existsSync(path.join(projectRoot, ".nodelens", "nl.config.json"))) {
        log.info("Using \x1b[33mnl.config.json\x1b[0m");
    } else {
        log.info("Using \x1b[33mdefault config\x1b[0m");
    }
    log.info("Watching for file changes...");

    // ================ RUNTIME COMMANDS ================

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: ""
    });

    // Graceful shutdown on Ctrl+C
    rl.on("SIGINT", () => {
        rl.close();
        process.kill(process.pid, "SIGINT");
    });

    rl.on("line", (input) => {
        const line = input.trim();
        if (!line) return;

        const cmd = line.toLowerCase();

        // ---------------- Utility Commands ----------------

        if (cmd === "clear" || cmd === "cls") {
            console.clear();
            return;
        }

        // ---------------- Help ----------------

        if (cmd === "help" || cmd === "h" || cmd === "?") {
            console.log("-------------------------");
            console.log("\x1b[33mnodeLens Runtime Commands:\x1b[0m");
            console.log(" rs ............. Restarts server");
            console.log(" stop/x ......... Stops nodeLens");
            console.log(" status/stats ... Shows watcher status");
            console.log(" last-change/lc . Shows last file change");
            console.log(" silent ......... Toggles silent logs");
            console.log(" help/h/? ....... Shows this help");
            console.log(" clear/cls ...... Clears console");
            return;
        }

        // ---------------- Status ----------------

        if (cmd === "status" || cmd === "stats") {
            console.log("-------------------------");
            console.log("\x1b[33mnodeLens Status:\x1b[0m");
            console.log(` Server PID .... ${server ? server.pid : "not running"}`);
            console.log(` Watching ...... ${Array.isArray(effectiveConfig.watch) ? effectiveConfig.watch.join(", ") : effectiveConfig.watch}`);
            console.log(` Ignoring ...... ${effectiveConfig.ignore.join(", ")}`);
            console.log(` Debounce ...... ${effectiveConfig.debounceDelay}ms`);
            console.log(` Restart Delay . ${effectiveConfig.restartDelay}ms`);
            console.log(` Silent Logs ... ${effectiveConfig.silentLogs ? "ON" : "OFF"}`);
            console.log(` Save Logs ..... ${effectiveConfig.saveLogs ? "ON" : "OFF"}`);
            console.log(` Log File ...... ${effectiveConfig.logFile}`);
            return;
        }

        // ---------------- Last Change ----------------

        if (cmd === "last-change" || cmd === "lc") {
            if (!lastChange.file) {
                log.info("No changes recorded yet.");
                return;
            }

            const timeStr = lastChange.timestamp.toLocaleTimeString("en-GB", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            });
            const agoStr = formatAgoFull(lastChange.timestamp);

            console.log("-------------------------");
            console.log("\x1b[33mLast Change:\x1b[0m");
            console.log(`File ..... ${lastChange.file}`);
            console.log(`Event .... ${lastChange.event}`);
            console.log(`Time ..... ${timeStr} (${agoStr})`);
            return;
        }

        // ---------------- Silent Mode ----------------

        if (cmd.startsWith("silent")) {
            log.separator();

            const parts = cmd.split(/\s+/);
            const action = parts[1];

            // Manual silent mode control
            if (action === "on") {
                if (!effectiveConfig.silentLogs) {
                    effectiveConfig.silentLogs = true;
                    silentOverride = true;
                    setLogStyle(effectiveConfig);
                    console.log("Silent logs: ON");
                } else {
                    console.log("Silent logs already ON.");
                }
                return;
            }

            if (action === "off") {
                if (effectiveConfig.silentLogs) {
                    effectiveConfig.silentLogs = false;
                    silentOverride = false;
                    setLogStyle(effectiveConfig);
                    console.log("Silent logs: OFF");
                } else {
                    console.log("Silent logs already OFF.");
                }
                return;
            }

            effectiveConfig.silentLogs = !effectiveConfig.silentLogs;
            silentOverride = effectiveConfig.silentLogs;
            setLogStyle(effectiveConfig);
            console.log(`Silent logs: ${effectiveConfig.silentLogs ? "ON" : "OFF"}`);
            return;
        }

        // ---------------- Restart ----------------

        if (cmd === "rs") {
            log.separator();
            log.info("Restarting server...");

            if (restartTimer) clearTimeout(restartTimer);
            if (server) server.kill();

            startServer(entry);
            return;
        }

        // ---------------- Stop ----------------
        
        if (cmd === "stop" || cmd === "x") {
            log.separator();
            log.info("Stopping nodeLens...");

            rl.close();

            if (projectWatcher) projectWatcher.close();
            if (configWatcher) configWatcher.close();
            if (server) server.kill();

            process.exit(0);
        }

        // Unknown command feedback
        log.separator();
        log.error(`Command not found: "${line}". Run "help" for commands list.`);
    });

    // Start project + config watchers
    projectWatcher = createProjectWatcher(entry, projectRoot, effectiveConfig);

    configWatcher = createConfigWatcher(projectRoot, (newConfig) => {
        if (restartTimer) clearTimeout(restartTimer);
        if (projectWatcher) projectWatcher.close();

        projectWatcher = createProjectWatcher(entry, projectRoot, newConfig);
    });

    // Handle process termination gracefully
    process.on("SIGINT", () => {
        if (projectWatcher) projectWatcher.close();
        if (configWatcher) configWatcher.close();
        if (server) server.kill();
        process.exit(0);
    });

    process.on("SIGTERM", () => {
        if (projectWatcher) projectWatcher.close();
        if (configWatcher) configWatcher.close();
        if (server) server.kill();
        process.exit(0);
    });
}

// ================ SERVER HANDLER ================

// Spawns a Node.js process for the watched entry file
function startServer(entry) {
    server = spawn("node", [entry], {
        stdio: ["ignore", "inherit", "inherit"]
    });

    // Detect abnormal process exits and report
    server.on("exit", (code, signal) => {
        if (!signal && code !== 0) {
            log.separator();
            log.error(`Server crashed (exit code ${code}). Waiting for changes...`);
        }
    });
}
