import { all_hackable, HACK_FILES, hack_file_to_function } from "utils";

/**
 * Get access to all hackable servers.
 *
 * @param {import("external/NetscriptDefinitions").NS} ns
 */
export async function main(ns) {
    all_hackable(ns).forEach(server_name => {
        HACK_FILES
            .filter(file => ns.fileExists(file))
            .forEach(file => hack_file_to_function(ns, file)(server_name));
        ns.nuke(server_name);
        ns.tprint(`Got access to ${server_name}`);
    })
}