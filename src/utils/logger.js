import fs from "fs";
import path from "path";

const COLORS = {
    error: "\x1b[31m",
    warn: "\x1b[33m",
    info: "\x1b[36m",
    success: "\x1b[32m",

    reset: "\x1b[0m"
};

let logLabel = true;
let logTimestamp = false;
let silentLogs = false;

let logFilePath = null;

const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

function getTimestamp() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
}

export function setLogStyle(options = {}) {
    if (typeof options.logLabel === "boolean") {
        logLabel = options.logLabel;
    }

    if (typeof options.logTimestamp === "boolean") {
        logTimestamp = options.logTimestamp;
    }

    if (typeof options.silentLogs === "boolean") {
        silentLogs = options.silentLogs;
    }

    if (typeof options.saveLogs === "boolean") {
        if (options.saveLogs) {
            const dir = path.join(process.cwd(), ".nodelens");
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }
            logFilePath = path.join(dir, "nodelens.txt");
        } else {
            logFilePath = null;
        }
    }
}

function shouldPrint(label) {
    if (silentLogs) {
        return label === "ERROR" || label === "WARN";
    }
    return true;
}

function format(prefixColor, label, msg) {
    const timestampPart = logTimestamp ? `[${getTimestamp()}] ` : "";
    const labelPart = logLabel ? `[${label}] ` : "";

    return `NL ${timestampPart}${prefixColor}${labelPart}${COLORS.reset}${msg}`;
}

function formatForFile(label, msg) {
    const timestampPart = `[${getTimestamp()}] `;
    const labelPart = `[${label}] `;
    return `NL ${timestampPart}${labelPart}${msg}`;
}

function writeToFile(label, msg) {
    if (!logFilePath) return;

    try {
        const fileLine = formatForFile(label, msg).replace(ANSI_REGEX, "") + "\n";
        fs.appendFileSync(logFilePath, fileLine, "utf8");
    } catch (err) {
        console.error("Logger file write failed:", err.message);
    }
}

export const log = {
    error(msg) {
        writeToFile("ERROR", msg);
        if (!shouldPrint("ERROR")) return;
        console.log(format(COLORS.error, "ERROR", msg));
    },

    warn(msg) {
        writeToFile("WARN", msg);
        if (!shouldPrint("WARN")) return;
        console.log(format(COLORS.warn, "WARN", msg));
    },

    info(msg) {
        writeToFile("INFO", msg);
        if (!shouldPrint("INFO")) return;
        console.log(format(COLORS.info, "INFO", msg));
    },

    success(msg) {
        writeToFile("SUCCESS", msg);
        if (!shouldPrint("SUCCESS")) return;
        console.log(format(COLORS.success, "SUCCESS", msg));
    },

    separator() {
        if (!shouldPrint("INFO")) return;
        const line = "-------------------------";

        console.log(line);

        if (logFilePath) {
            try {
                fs.appendFileSync(logFilePath, line + "\n", "utf8");
            } catch (err) {
                console.error("Logger file write failed:", err.message);
            }
        }
    }
};
