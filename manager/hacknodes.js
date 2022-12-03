const budget_percentage = 0.3;
const wait_time = 20_000;

/**
 * Manage hacknodes.
 * 
 * @param {import("external/NetscriptDefinitions").NS} ns 
 */
export async function main(ns) {
    while (true) {
        await manage(ns);
    }
}

/**
 * @param {import("external/NetscriptDefinitions").NS} ns 
 */
async function manage(ns) {
    const available_money = ns.getServerMoneyAvailable("home");
    const budget = available_money * budget_percentage;

    for (let action of create_actions(ns, budget)) {
        action.execute();
    }

    await ns.sleep(wait_time);
}

/**
 * Create actions to perform on the hacknet.
 * E.g. create or upgrade.
 *  
 * @param {import("external/NetscriptDefinitions").NS} ns 
 * @param {number} budget 
 * @return {Action[]}
 */
function create_actions(ns, budget) {

    const actions = [];
    const num_nodes = ns.hacknet.numNodes();
    let leftover_budget = budget;
    ns.printf("Budget: %s", ns.nFormat(leftover_budget, "0.0a"));
    for (let i = 0; i < num_nodes; i++) {
        const node = new Node(ns, i);
        leftover_budget = node.add_actions(leftover_budget, actions);
        ns.printf("Budget after node #%d: %s", i, ns.nFormat(leftover_budget, "0.0a"));
    }

    if (actions.length === 0) {
        if (ns.hacknet.getPurchaseNodeCost() < budget) {
            return [new BuyAction(ns)];
        }
    }

    return actions;
}

const MAX_LEVEL = 200;
const MAX_RAM = 64;
const MAX_CORES = 16;

class Action {
    ns;
    node;

    /**
     * @param {import("external/NetscriptDefinitions").NS} ns
     * @param {Node} node
     */
    constructor(ns, node = null) {
        this.ns = ns;
        this.node = node;
    }

    execute() {
        return null;
    }

}

class BuyAction extends Action {
    execute() {
        if (this.ns.hacknet.numNodes() >= this.ns.hacknet.maxNumNodes()) {
            return null;
        }
        return this.ns.hacknet.purchaseNode();
    }
}

class UpgradeLevelAction extends Action {
    execute() {
        this.ns.hacknet.upgradeLevel(this.node.index, 1);
    }
}

class UpgradeRamAction extends Action {
    execute() {
        this.ns.hacknet.upgradeRam(this.node.index, 1);
    }
}

class UpgradeCoresAction extends Action {
    execute() {
        this.ns.hacknet.upgradeCore(this.node.index, 1);
    }
}

class Node {
    index;
    stats;
    ns;

    /**
     * @param {import("external/NetscriptDefinitions").NS} ns
     * @param {number} index
     */
    constructor(ns, index) {
        this.index = index;
        this.stats = ns.hacknet.getNodeStats(index);
        this.ns = ns;
    }

    /**
     * @param {number} budget 
     * @param {Action[]} actions
     * @return {number} left budget
     */
    add_actions(budget, actions) {
        let left_budget = budget;

        let can_buy_level = true;
        let buy_amount = 0;
        while (can_buy_level) {
            const max_reached = this.stats.level >= MAX_LEVEL;
            const cost = this.ns.hacknet.getLevelUpgradeCost(this.index, buy_amount);
            can_buy_level = !max_reached && left_budget > cost;
            if (!can_buy_level) {
                continue;
            }
            if (buy_amount != 0) {
                actions.push(new UpgradeLevelAction(this.ns, this));
            }
            buy_amount++;
        }
        left_budget -= this.ns.hacknet.getLevelUpgradeCost(this.index, buy_amount - 1);

        let can_buy_ram = true;
        buy_amount = 0;
        while (can_buy_ram) {
            const max_reached = this.stats.ram >= MAX_RAM;
            const cost = this.ns.hacknet.getRamUpgradeCost(this.index, buy_amount);
            can_buy_ram = !max_reached && left_budget > cost;
            if (!can_buy_ram) {
                continue;
            }
            if (buy_amount != 0) {
                actions.push(new UpgradeRamAction(this.ns, this));
            }
            buy_amount++;
        }
        left_budget -= this.ns.hacknet.getRamUpgradeCost(this.index, buy_amount - 1);

        let can_buy_cores = true;
        buy_amount = 0;
        while (can_buy_cores) {
            const max_reached = this.stats.cores >= MAX_CORES;
            const cost = this.ns.hacknet.getCoreUpgradeCost(this.index, buy_amount);
            can_buy_cores = !max_reached && left_budget > cost;
            if (!can_buy_cores) {
                continue;
            }
            if (buy_amount != 0) {
                actions.push(new UpgradeCoresAction(this.ns, this));
            }
            buy_amount++;
        }
        left_budget -= this.ns.hacknet.getCoreUpgradeCost(this.index, buy_amount - 1);
        return left_budget;
    }
}