import { arm } from "utils";

const prefix = "bought-server-";
const initial_ram = 4;
const budget_percentage = 0.5;
const max_ram = 2 << 15;

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

        if (available_money * budget_percentage > cost) {
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
    let run = true;
    while (run) {
        const max_possible_ram = ns.getPurchasedServerMaxRam();
        const servers = ns.getPurchasedServers();
        const servers_ram = servers.map(server => ns.getServerMaxRam(server));

        if (servers_ram.filter(ram => ram < max_ram).length === 0) {
            run = false;
            ns.alert("Max ram is reached, will no longer upgrade purchased servers.");
            continue;
        }

        if (servers_ram.filter(ram => ram < max_possible_ram).length === 0) {
            run = false;
            ns.alert("No server can be upgraded as maximum possible ram is reached for all servers. If not already done, try purchasing TOR browser and restart this script.");
            continue;
        }

        for (let server of servers) {
            const available_money = ns.getServerMoneyAvailable("home");
            const current_ram = ns.getServerMaxRam(server);
            const next_ram = current_ram << 1;
            if (next_ram > max_possible_ram) {
                continue;
            }
            const cost = ns.getPurchasedServerCost(next_ram);
            if (available_money * budget_percentage > cost) {
                ns.killall(server);
                ns.deleteServer(server);
                ns.purchaseServer(server, next_ram);
            }
        }

        await ns.sleep(10_000);
    }
}