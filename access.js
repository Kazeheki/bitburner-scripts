import { all_hackable, HACK_FILES, hack_file_to_function } from "utils";

const SCRIPTS = [
    "/find/backdoorable.js",
    "/find/server.js",
    "/access.js",
    "/utils.js",
    "/weaken.js"
];

/**
 * Get access to all hackable servers.
 *
 * @param {import("external/NetscriptDefinitions").NS} ns
 */
export async function main(ns) {
    all_hackable(ns)
        .filter(server_name => server_name != "home")
        .forEach(server_name => {
            HACK_FILES
                .filter(file => ns.fileExists(file))
                .forEach(file => hack_file_to_function(ns, file)(server_name));
            ns.nuke(server_name);
            ns.tprint(`Got access to ${server_name}`);
            // arm with scripts.
            ns.scp(SCRIPTS, server_name, "home");
        })
}