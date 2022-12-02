import { all_hacked } from "utils";

/**
 * Copy a script to all hacked servers.
 *  
 * @param {import("external/NetscriptDefinitions").NS} ns 
 */
export async function main(ns) {
    const script = ns.args[0];

    if (script == null || script.toString().trim() == "") {
        throw Error("no script to copy given");
    }

    if (!ns.fileExists(script.toString())) {
        throw Error("script does not exist on this host");
    }

    all_hacked(ns).forEach((server) => ns.scp(script.toString(), server));
    ns.getPurchasedServers().forEach((server) => ns.scp(script.toString(), server));
}