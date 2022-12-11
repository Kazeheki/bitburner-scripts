const money_threshold = 0.75;

/**
 * basic hack script.
 * 
 * @param {import("external/NetscriptDefinitions").NS} ns 
 */
export async function main(ns) {
    const raw_target = ns.args[0] || "";

    if (raw_target == null || raw_target.toString().trim() === "") {
        throw Error("no target given");
    }

    const target = raw_target.toString();
    const min_security_level = ns.getServerMinSecurityLevel(target);
    const server_max_money = ns.getServerMaxMoney(target);

    let last_hack_successful = true;
    let needs_new_target = false;
    while (!needs_new_target) {
        const available_money = ns.getServerMoneyAvailable(target);
        const server_growth = ns.getServerGrowth(target);

        if (available_money <= 0) {
            needs_new_target = true;
            continue;
        }

        if (!last_hack_successful || is_hard_to_hack(ns, target, min_security_level)) {
            await ns.weaken(target);
            last_hack_successful = true;
        } else if (is_money_low(ns, target, server_max_money) && server_growth > 0 && available_money > 0) {
            await ns.grow(target);
        } else {
            const earned = await ns.hack(target);
            last_hack_successful = earned > 0;
        }
    }
}

/**
 * @param {import("external/NetscriptDefinitions").NS} ns 
 * @param {string} target
 * @param {number} min_security_level
 */
function is_hard_to_hack(ns, target, min_security_level) {
    return ns.hackAnalyzeChance(target) < 0.6 && ns.getServerSecurityLevel(target) > min_security_level;
}

/**
 * @param {import("external/NetscriptDefinitions").NS} ns 
 * @param {string} target 
 * @param {number} server_max_money
 */
function is_money_low(ns, target, server_max_money) {
    return ns.getServerMoneyAvailable(target) < server_max_money * money_threshold;
}