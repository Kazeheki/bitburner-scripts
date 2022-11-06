/**
 *
 * @param {any} value
 * @param {string} field_name
 */
export function assure_not_blank(value, field_name = "Field") {
    if (value == null) {
        throw Error(`${field_name} must not be null`);
    }
    if (typeof value === "string" && value.trim().length === 0) {
        throw Error(`${field_name} must not be blank`);
    }
}

/**
 * Returns an array of all names of hacked servers excluding bought ones.
 *
 * @param {import("external/NetscriptDefinitions").NS} ns
 * @return {string[]}
 */
export function all_hacked(ns) {
    return Array.from(find_all_servers(ns, [ns.getHostname()])).filter(name => {
        const server = ns.getServer(name);
        return server.hasAdminRights && !server.purchasedByPlayer;
    });
}

/**
 * Returns an array of all server names.
 *
 * @param {import("external/NetscriptDefinitions").NS} ns
 * @return {string[]}
 */
export function all_servers(ns) {
    return Array.from(find_all_servers(ns, [ns.getHostname()]));
}

/**
 *
 * @param {import("external/NetscriptDefinitions").NS} ns
 * @param {string[]} queue
 * @param {Set<string>} servers
 * @return {Set<string>}
 */
function find_all_servers(ns, queue, servers = new Set()) {
    if (queue.length === 0) {
        return servers;
    }

    const current = queue.shift();

    if (servers.has(current)) {
        return find_all_servers(ns, queue, servers);
    }
    servers.add(current);
    ns.scan(current).forEach(server => servers.add(server));
    return find_all_servers(ns, queue, servers);
}
