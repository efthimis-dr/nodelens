#!/usr/bin/env node

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

const args = process.argv.slice(2);
const cmd = parseCommands(args);

if (args.length === 0) {
    printHelp();
    process.exit(0);
}

if (cmd.type === "help") {
    printHelp();
    process.exit(0);
}

if (cmd.type === "version") {
    printVersion();
    process.exit(0);
}

if (cmd.type === "config-init") {
    createDefaultConfigFile();
    process.exit(0);
}

if (cmd.type === "config-delete") {
    await removeConfigFile();
    process.exit(0);
}

if (cmd.type === "config-reset") {
    await resetConfigFile();
    process.exit(0);
}

if (cmd.type === "clear-logs") {
    await clearLogFile();
    process.exit(0);
}

if (cmd.type === "run") {
    const entryPath = path.resolve(cmd.entry);

    if (!fs.existsSync(entryPath)) {
        log.error(`Entry file or command not found: "${cmd.entry}"`);
        printHelp();
        process.exit(1);
    }

    startWatcher(cmd.entry);
}
