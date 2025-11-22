#!/usr/bin/env node

// ================ IMPORTS ================

import fs from "fs";
import path from "path";
import { log } from "../src/utils/logger.js";

import {
    parseCommands,
    printVersion,
    printHelp,
    createDefaultConfigFile,
    removeConfigFile,
    resetConfigFile,
    clearLogFile
} from "../src/commands.js";

import { startWatcher } from "../src/watcher.js";

// ================ ARGUMENT PARSING ================

const args = process.argv.slice(2);
const cmd = parseCommands(args);

// ================ BASE CONDITIONS ================

// Show help when no arguments are provided
if (args.length === 0) {
    printHelp();
    process.exit(0);
}

// ---------------- Help / Version ----------------

if (cmd.type === "help") {
    printHelp();
    process.exit(0);
}

if (cmd.type === "version") {
    printVersion();
    process.exit(0);
}

// ---------------- Config Commands ----------------

// Create default config file if missing
if (cmd.type === "config-init") {
    createDefaultConfigFile();
    process.exit(0);
}

// Permanently delete config file with confirmation
if (cmd.type === "config-delete") {
    await removeConfigFile();
    process.exit(0);
}

// Reset config file to default state
if (cmd.type === "config-reset") {
    await resetConfigFile();
    process.exit(0);
}

// ---------------- Logs ----------------

// Clear all stored logs from the log file
if (cmd.type === "clear-logs") {
    await clearLogFile();
    process.exit(0);
}

// ================ MAIN COMMAND: RUN ================

// Run the file watcher for the specified entry file
if (cmd.type === "run") {
    const entryPath = path.resolve(cmd.entry);

    // Validate entry path existence
    if (!fs.existsSync(entryPath)) {
        log.error(`Entry file or command not found: "${cmd.entry}"`);
        printHelp();
        process.exit(1);
    }

    // Start watching the project files for changes
    startWatcher(cmd.entry);
}
