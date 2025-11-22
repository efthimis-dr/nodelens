import fs from "fs";
import path from "path";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createRequire } from "module";
import { log, setLogStyle } from "./utils/logger.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const CONFIG_DIR = ".nodelens";
const CONFIG_FILENAME = "nl.config.json";
const LOG_FILENAME = "nodelens.txt";

export const DEFAULT_CONFIG = {
    watch: "all",
    ignore: [
        "node_modules",
        ".git",
        "dist",
        "build",
        "temp",
        "logs"
    ],
    debounceDelay: 225,
    restartDelay: 0,
    logLabel: true,
    logTimestamp: false,
    silentLogs: false,
    saveLogs: false
};

function getConfigDir() {
    return path.join(process.cwd(), CONFIG_DIR);
}

function getConfigPath() {
    return path.join(getConfigDir(), CONFIG_FILENAME);
}

function getLogPath() {
    return path.join(getConfigDir(), LOG_FILENAME);
}

export function parseCommands(args) {
    const cmd = {
        type: "run",
        entry: "index.js"
    };

    if (!args || args.length === 0) {
        return cmd;
    }

    const [first, second] = args;

    if (first === "help" || first === "h" || first === "?") {
        cmd.type = "help";
        return cmd;
    }

    if (first === "version" || first === "v") {
        cmd.type = "version";
        return cmd;
    }

    if (first === "config" || first === "cfg") {
        if (second === "init") {
            cmd.type = "config-init";
        } else if (second === "reset") {
            cmd.type = "config-reset";
        } else if (second === "delete") {
            cmd.type = "config-delete";
        } else {
            cmd.type = "help";
        }
        return cmd;
    }

    if (first === "clear-logs") {
        cmd.type = "clear-logs";
        return cmd;
    }

    cmd.type = "run";
    cmd.entry = first;
    return cmd;
}

export function loadConfig() {
    const configPath = getConfigPath();

    if (!fs.existsSync(configPath)) return null;

    try {
        const raw = fs.readFileSync(configPath, "utf8");
        const config = JSON.parse(raw);

        setLogStyle({
            logLabel:
                typeof config.logLabel === "boolean"
                    ? config.logLabel
                    : DEFAULT_CONFIG.logLabel,
            logTimestamp:
                typeof config.logTimestamp === "boolean"
                    ? config.logTimestamp
                    : DEFAULT_CONFIG.logTimestamp,
            silentLogs:
                typeof config.silentLogs === "boolean"
                    ? config.silentLogs
                    : DEFAULT_CONFIG.silentLogs,
            saveLogs:
                typeof config.saveLogs === "boolean"
                    ? config.saveLogs
                    : DEFAULT_CONFIG.saveLogs
        });

        return config;
    } catch (err) {
        log.error(`Failed to parse ${CONFIG_FILENAME}: ${err.message}`);
        return null;
    }
}

export function createDefaultConfigFile() {
    const dir = getConfigDir();
    const configPath = getConfigPath();

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    if (fs.existsSync(configPath)) {
        log.error(`${CONFIG_FILENAME} already exists.`);
        return;
    }

    const defaultConfig = {
        ...DEFAULT_CONFIG
    };

    fs.writeFileSync(
        configPath,
        JSON.stringify(defaultConfig, null, 2)
    );

    setLogStyle({
        logLabel: DEFAULT_CONFIG.logLabel,
        logTimestamp: DEFAULT_CONFIG.logTimestamp,
        silentLogs: DEFAULT_CONFIG.silentLogs,
        saveLogs: DEFAULT_CONFIG.saveLogs
    });

    log.success(`Created ${CONFIG_FILENAME} in .nodelens/`);
}

export async function removeConfigFile() {
    const configPath = getConfigPath();

    if (!fs.existsSync(configPath)) {
        log.error(`${CONFIG_FILENAME} does not exist.`);
        return;
    }

    const rl = readline.createInterface({ input, output });

    const answer = (await rl.question(
        `Permanently delete ${CONFIG_FILENAME}? (y/N): `
    ))
        .trim()
        .toLowerCase();

    rl.close();

    if (answer !== "y" && answer !== "yes") {
        log.info("Delete aborted.");
        return;
    }

    fs.rmSync(configPath);
    log.success(`Deleted ${CONFIG_FILENAME}.`);

    setLogStyle({ ...DEFAULT_CONFIG });
}

export async function resetConfigFile() {
    const dir = getConfigDir();
    const configPath = getConfigPath();

    if (!fs.existsSync(configPath)) {
        log.error(`${CONFIG_FILENAME} does not exist.`);
        return;
    }

    const rl = readline.createInterface({ input, output });

    const answer = (await rl.question(
        `Reset ${CONFIG_FILENAME} to default settings? (y/N): `
    ))
        .trim()
        .toLowerCase();

    rl.close();

    if (answer !== "y" && answer !== "yes") {
        log.info("Reset aborted.");
        return;
    }

    const resetConfig = {
        ...DEFAULT_CONFIG
    };

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    fs.writeFileSync(
        configPath,
        JSON.stringify(resetConfig, null, 2)
    );

    setLogStyle({
        logLabel: DEFAULT_CONFIG.logLabel,
        logTimestamp: DEFAULT_CONFIG.logTimestamp,
        silentLogs: DEFAULT_CONFIG.silentLogs,
        saveLogs: DEFAULT_CONFIG.saveLogs
    });

    log.success(`Reset ${CONFIG_FILENAME} in .nodelens/`);
}

export async function clearLogFile() {
    const logPath = getLogPath();

    if (!fs.existsSync(logPath)) {
        log.warn("nodelens.txt does not exist. Nothing to clear.");
        return;
    }

    const rl = readline.createInterface({ input, output });

    const answer = (await rl.question(
        "Clear nodelens.txt? (y/N): "
    ))
        .trim()
        .toLowerCase();

    rl.close();

    if (answer !== "y" && answer !== "yes") {
        log.info("Clear aborted.");
        return;
    }

    try {
        fs.writeFileSync(logPath, "");
        log.success("Cleared nodelens.txt");
    } catch (err) {
        log.error(`Failed to clear nodelens.txt`);
    }
}

export function printVersion() {
    console.log(pkg.version);
}

export function printHelp() {
    console.log(`
\x1b[33mCommands:\x1b[0m
  \x1b[33mRun:\x1b[0m
    nodelens <entry-file> ....... Starts Node.js with auto-restart

  \x1b[33mHelp:\x1b[0m
    nodelens help/h/? ........... Shows this help view

  \x1b[33mVersion:\x1b[0m
    nodelens version/v .......... Shows version

  \x1b[33mConfig:\x1b[0m
    nodelens config/cfg init .... Creates .nodelens/nl.config.json
    nodelens config/cfg reset ... Resets .nodelens/nl.config.json
    nodelens config/cfg delete .. Deletes .nodelens/nl.config.json

  \x1b[33mLogs:\x1b[0m
    nodelens clear-logs ......... Clears .nodelens/nodelens.txt

  \x1b[33mRuntime:\x1b[0m
    Run "help" during runtime to see runtime commands.
`);
}
