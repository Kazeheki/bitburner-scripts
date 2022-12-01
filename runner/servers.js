import {arm} from "utils";

const prefix = "bought-server-";
const initial_ram = 4;

/**
 * Buy and upgrade servers indefinably.
 * @param {import("external/NetscriptDefinitions").NS} ns
 */
export async function main(ns) {
    await buy(ns);

    await expand(ns);
}

/**
 * Buy as many servers as possible.
 * @param {import("external/NetscriptDefinitions").NS} ns
 */
async function buy(ns) {
    let count = 1;
    while (ns.getPurchasedServerLimit() > ns.getPurchasedServers().length) {
        const cost = ns.getPurchasedServerCost(initial_ram);
        const available_money = ns.getServerMoneyAvailable("home");

        if (available_money > cost) {
            const name = prefix + count;
            ns.purchaseServer(name, initial_ram);
            arm(ns, name);
            count++;
        }

        await ns.sleep(10_000);
    }
}

/**
 * Expand bought servers.
 * @param {import("external/NetscriptDefinitions").NS} ns
 */
async function expand(ns) {
    while (true) {
       const servers = ns.getPurchasedServers();
       const available_money = ns.getServerMoneyAvailable("home");
       for (let server of servers) {
           const current_ram = ns.getServerMaxRam(server);
           const next_ram = current_ram << 1;
           const cost = ns.getPurchasedServerUpgradeCost(server, next_ram);
           if (available_money > cost) {
               ns.upgradePurchasedServer(server, next_ram);
           }
       }

        await ns.sleep(10_000);
    }
}