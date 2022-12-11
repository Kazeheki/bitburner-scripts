import { all_hacked } from "utils";

const timeout = 10_000;
const hack_script = "hack.js";

/**
 * Deploy the hack script and start it with as many threads as possible.
 * 
 * @param {import("external/NetscriptDefinitions").NS} ns 
 */
export async function main(ns) {
    const script_ram = ns.getScriptRam(hack_script);

    ns.disableLog("getServerMaxRam");
    ns.disableLog("getServerUsedRam");
    ns.disableLog("getServerMoneyAvailable");
    ns.disableLog("getServerGrowth");
    ns.disableLog("scan");
    ns.disableLog("getServerMaxMoney");
    ns.disableLog("sleep");

    while (true) {
        const target = server_with_max_money(ns);
        if (target == null) {
            ns.alert("no server with max money found (no target)");
            break;
        }
        ns.printf(">>> target = %s", target);

        all_hacked(ns).concat(ns.getPurchasedServers())
            .forEach((server) => {

                const available_ram = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
                const threads = Math.floor(available_ram / script_ram);
                if (threads > 0) {
                    ns.rm(hack_script, server);
                    ns.scp(hack_script, server, "home");
                    ns.exec(hack_script, server, threads, target);
                }
            });

        await ns.sleep(timeout);
    }
}

/**
 * @param {import("external/NetscriptDefinitions").NS} ns 
 */
function server_with_max_money(ns) {
    return all_hacked(ns)
        .filter((server) => ns.getServerMaxMoney(server) > 0)
        .filter((server) => ns.getServerMoneyAvailable(server) > 0)
        .filter((server) => ns.getServerGrowth(server) > 0)
        .sort((serverA, serverB) => {
            const a = ns.getServerMaxMoney(serverA);
            const b = ns.getServerMaxMoney(serverB);
            return b - a;
        })
    [0];
}