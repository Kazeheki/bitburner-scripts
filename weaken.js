/**
 * Run weaken on a target indefinately.
 * 
 * @param {import("external/NetscriptDefinitions").NS} ns 
 */
export async function main(ns) {

    const target = ns.args[0];

    if (target == null || target.toString().trim() == "") {
        throw Error("no target given");
    }

    while (true) {
        await ns.weaken(target.toString());
    }
}