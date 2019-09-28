"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@micro-fleet/common");
const CacheAddOn_1 = require("./CacheAddOn");
const Types_1 = require("./Types");
function registerCacheAddOn() {
    const depCon = common_1.serviceContext.dependencyContainer;
    /*
     * Don't bind CacheProvider here, as CacheAddOn.init() will do that.
     */
    if (!depCon.isBound(Types_1.Types.CACHE_ADDON)) {
        depCon.bindConstructor(Types_1.Types.CACHE_ADDON, CacheAddOn_1.CacheAddOn).asSingleton();
    }
    const addon = depCon.resolve(Types_1.Types.CACHE_ADDON);
    return addon;
}
exports.registerCacheAddOn = registerCacheAddOn;
//# sourceMappingURL=register-addon.js.map