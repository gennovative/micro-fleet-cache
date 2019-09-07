"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var CacheLevel;
(function (CacheLevel) {
    /**
     * Only caches in local memory.
     */
    CacheLevel[CacheLevel["LOCAL"] = 1] = "LOCAL";
    /**
     * Only caches in remote service.
     */
    CacheLevel[CacheLevel["REMOTE"] = 2] = "REMOTE";
    /**
     * Caches in remote service and keeps sync with local memory.
     */
    CacheLevel[CacheLevel["BOTH"] = 3] = "BOTH";
})(CacheLevel = exports.CacheLevel || (exports.CacheLevel = {}));
//# sourceMappingURL=ICacheProvider.js.map