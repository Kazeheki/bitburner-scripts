const ACTIONS = [
    ["/manager/servers.js"],
    ["/manager/deploy-hack.js", 0.3],
    ["/manager/hacknodes.js"]
];
/**
 * Start all the manager scripts.
 * 
 * @param {import("external/NetscriptDefinitions").NS} ns 
 */
export async function main(ns) {
    for (let action of ACTIONS) {
        let [file, ...args] = action;
        if (ns.fileExists(file)) {
            ns.exec(file, "home", 1, ...args);
        }
    }
}
