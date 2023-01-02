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
    let servers_with_level = servers.map(server => [server, ns.getServerRequiredHackingLevel(server)]);
    servers_with_level.sort((left, right) => {
        return +left[1] - +right[1];
    });
    ns.tprint("");
    for (let server of servers_with_level) {
        ns.tprintf("%s (%d)", server[0], server[1]);
    }
}
