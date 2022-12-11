import { all_hacked } from "utils";

/**
 * Kill all scripts except those on home.
 * @param {import("external/NetscriptDefinitions").NS} ns 
 */
export async function main(ns) {
    all_hacked(ns).concat(ns.getPurchasedServers())
        .filter(is_not_home)
        .forEach(kill(ns));
}

const is_not_home = (server) => server != "home";
const kill = (ns) => (server) => ns.killall(server);