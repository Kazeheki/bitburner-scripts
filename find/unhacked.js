import { all_servers } from "utils";

/**
 * Find all unhacked servers and display the min-level needed to hack it.
 *  
 * @param {import("external/NetscriptDefinitions").NS} ns 
 */
export async function main(ns) {
    const unhacked = (server) => !ns.hasRootAccess(server);
    const servers = all_servers(ns).filter(unhacked);
    if (servers.length == 0) {
        ns.tprint("No servers found");
        return;
    }
    ns.tprint("");
    for (let server of servers) {
        ns.tprintf("%s (%d)", server, ns.getServerRequiredHackingLevel(server));
    }
}