import { recursive_path } from "find/server";
import { assure_not_blank } from "utils";

/**
 * Create a string you can copy to connect through to a server in one go.
 * 
 * @param {import("external/NetscriptDefinitions").NS} ns 
 */
export async function main(ns) {
    const target = ns.args[0];
    assure_not_blank(target, "target");
    if (typeof target != "string") {
        throw Error("target must be string");
    }

    const path = recursive_path(ns, ns.getHostname(), target);
    if (path == null) {
        ns.tprint(`Couldn't find ${target}`);
    } else {
        ns.tprintf("\n%s", path.map(s => `connect ${s}`).join(";"));
    }
}