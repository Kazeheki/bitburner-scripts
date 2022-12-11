import { assure_not_blank } from "utils";

/**
 * Find the path to a server from current server.
 * The servers you have already a backdoor on will be marked with a star (*).
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
        ns.tprint(path.map(mark_if_hacked(ns)).join(" -> "));
    }
}

/**
 * 
 * @param {import("external/NetscriptDefinitions").NS} ns 
 * @returns {() => string} 
 */
function mark_if_hacked(ns) {
    return (/** @type {string} */ server) => {
        if (ns.getServer(server).backdoorInstalled) {
            return server + "*";
        }
        return server;
    }
}

/**
 * 
 * @param {import("external/NetscriptDefinitions").NS} ns 
 * @param {string} start 
 * @param {string} target 
 * @param {string[]} seen
 * @return {string[]}
 */
export function recursive_path(ns, start, target, seen = []) {
    if (start === target) {
        return [];
    }
    seen.push(start);

    const not_seen = (/** @type {string} */ server) => seen.indexOf(server) === -1;
    const servers = ns.scan(start).filter(not_seen);
    for (let server of servers) {
        const path = recursive_path(ns, server, target, seen);
        if (path != null) {
            path.unshift(server);
            return path;
        }
    }
    return null;
}