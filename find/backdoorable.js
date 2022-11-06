import { all_hacked } from "utils";

/**
 * Find hacked servers that have not yet a backdoor installed.
 *  
 * @param {import("external/NetscriptDefinitions").NS} ns 
 */
export async function main(ns) {
    const servers = all_hacked(ns).filter(name => !ns.getServer(name).backdoorInstalled);
    ns.tprint("\n\n" + servers.join("\n"));
}