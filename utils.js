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
    ns.scan(current).forEach(server => queue.push(server));
    return find_all_servers(ns, queue, servers);
}

/**
 * Returns an array of names of all servers that are hackable with the current hack skill and programs you have.
 *
 * @param {import("external/NetscriptDefinitions").NS} ns
 * @return {string[]}
 */
export function all_hackable(ns) {
    return Array.from(
        all_servers(ns)
            .filter(name => {
                const server = ns.getServer(name);
                return player_can_hack(ns, server);
            })
    );
}

export const HACK_FILES = [
    "BruteSSH.exe",
    "FTPCrack.exe",
    "relaySMTP.exe",
    "HTTPWorm.exe",
    "SQLInject.exe"
];
/**
 * Whether the player can hack the target server.
 * Will return false if it is not hackable or if the server is already hacked.
 *
 * @param {import("external/NetscriptDefinitions").NS} ns
 * @param {import("external/NetscriptDefinitions").Server} target
 * @return {boolean}
 */
function player_can_hack(ns, target) {
    if (target.hasAdminRights) {
        return false;
    }

    const hackable_ports = HACK_FILES.filter(file => ns.fileExists(file)).length;
    const needed_ports = target.numOpenPortsRequired;
    if (hackable_ports < needed_ports) {
        return false;
    }

    return ns.getHackingLevel() >= target.requiredHackingSkill;
}

/**
 * Get the corresponding hack-function to a hack-file.
 *
 * @param {import("external/NetscriptDefinitions").NS} ns
 * @param {string} file
 * @return {(host: string) => void}
 */
export function hack_file_to_function(ns, file) {
    switch (file) {
        case "BruteSSH.exe":
            return ns.brutessh;
        case "FTPCrack.exe":
            return ns.ftpcrack;
        case "relaySMTP.exe":
            return ns.relaysmtp;
        case "HTTPWorm.exe":
            return ns.httpworm;
        case "SQLInject.exe":
            return ns.sqlinject;
        default:
            return (_) => { throw Error("Unknown hack-file") };
    }
}

const SCRIPTS = [
    "/find/backdoorable.js",
    "/find/server.js",
    "access.js",
    "utils.js",
    "weaken.js"
];
/**
 * Arm server with all needed files.
 *
 * @param {import("external/NetscriptDefinitions").NS} ns
 * @param {string} server
 */
export function arm(ns, server) {
    ns.scp(SCRIPTS, server, "home");
}