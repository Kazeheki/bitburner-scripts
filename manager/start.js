const FILES = [
    "manager/servers.js",
    "manager/deploy-hack.js",
    "manager/hacknodes.js"
];
/**
 * Start all the manager scripts.
 * 
 * @param {import("external/NetscriptDefinitions").NS} ns 
 */
export async function main(ns) {
    for (let file of FILES) {
        if (ns.fileExists(file)) {
            ns.exec(file, "home");
        }
    }
}
