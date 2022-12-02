import { all_hacked } from "utils";

/**
 * Run weaken with all hacked servers with enough free RAM.
 * 
 * @param {import("external/NetscriptDefinitions").NS} ns 
 */
export async function main(ns) {
    const target = ns.args[0];

    if (target == null || target.toString().trim() == "") {
        throw Error("no target given");
    }

    const script = "weaken.js";
    const ram_cost = ns.getScriptRam(script);

    const curried_execute = (server) => execute(
        ns,
        server,
        target.toString(),
        script,
        ram_cost
    );

    ns.getPurchasedServers().concat(all_hacked(ns)).forEach(curried_execute);
}

/**
 * Execute the script with as many threads as possible on the given server. 
 * 
 * @param {import("external/NetscriptDefinitions").NS} ns 
 * @param {string} server 
 * @param {string} target 
 * @param {string} script 
 * @param {number} ram_cost 
 */
function execute(ns, server, target, script, ram_cost) {
    if (!ns.fileExists(script, server)) {
        return;
    }
    const free_ram = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
    const threads = Math.floor(free_ram / ram_cost);
    if (threads == 0) {
        return;
    }
    ns.exec(script, server, threads, target);
}