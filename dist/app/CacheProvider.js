"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("util");
const redis = require("redis");
const RedisClustr = require("redis-clustr");
redis.Multi.prototype.execAsync = util.promisify(redis.Multi.prototype.exec);
const common_1 = require("@micro-fleet/common");
const EVENT_PREFIX = '__keyspace@0__:', PRIMITIVE = 0, OBJECT = 1, ARRAY = 2;
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
/**
 * Provides methods to read and write data to cache.
 */
class CacheProvider {
    constructor(_options) {
        this._options = _options;
        this._localCache = {
            '@#!': null,
        };
        this._cacheTypes = {};
        this._cacheExps = {};
        this._cacheLocks = {};
        if (_options.cluster) {
            this._promisify(RedisClustr.prototype);
            this._engine = new RedisClustr({
                servers: _options.cluster,
            });
        }
        else {
            this._promisify(redis.RedisClient.prototype);
            this._engine = this._connectSingle();
        }
    }
    get _hasEngine() {
        return (this._engine != null);
    }
    /**
     * Clears all local cache and disconnects from remote cache service.
     */
    async dispose() {
        const tasks = [];
        if (this._engine) {
            tasks.push(this._engine.quitAsync());
        }
        if (this._engineSub) {
            tasks.push(this._engineSub.quitAsync());
            this._engineSub = null;
        }
        await Promise.all(tasks);
        this._engine = this._localCache = this._cacheTypes = this._cacheExps = null;
    }
    /**
     * Removes a key from cache.
     */
    async delete(key) {
        key = this._realKey(key);
        this._deleteLocal(key);
        await this._syncOff(key);
        await this._engine.delAsync(key);
    }
    /**
     * Retrieves a string or number or boolean from cache.
     * @param {string} key The key to look up.
     * @param {boolean} forceRemote Skip local cache and fetch from remote server. Default is `false`.
     * @param {boolean} parseType (Only takes effect when `forceRemote=true`)
     *      If true, try to parse value to nearest possible primitive data type.
     *      If false, always return string. Default is `true`. Set to `false` to save some performance.
     */
    getPrimitive(key, forceRemote = false, parseType = true) {
        key = this._realKey(key);
        const cacheType = this._cacheTypes[key];
        if (cacheType != null && cacheType !== PRIMITIVE) {
            return Promise.resolve(new common_1.Maybe);
        }
        if (forceRemote && this._hasEngine) {
            return this._fetchPrimitive(key, parseType);
        }
        if (this._localCache.hasOwnProperty(key)) {
            return Promise.resolve(new common_1.Maybe(this._localCache[key]));
        }
        if (this._includeBit(cacheType, CacheLevel.REMOTE)) {
            return this._fetchPrimitive(key, parseType);
        }
        return Promise.resolve(new common_1.Maybe);
    }
    /**
     * Retrieves an array of strings or numbers or booleans from cache.
     * @param {string} key The key to look up.
     * @param {boolean} forceRemote Skip local cache and fetch from remote server. Default is `false`.
     */
    async getArray(key, forceRemote = false) {
        // key = this._realKey(key)
        // if (this._cacheTypes[key] != null && this._cacheTypes[key] !== ARRAY) { return Promise.resolve(new Maybe<any[]>()) }
        // const stringified: string = (!(forceRemote && this._hasEngine) && this._localCache[key] !== undefined)
        //     ? await Promise.resolve(this._localCache[key])
        //     : await this._fetchPrimitive(key, false)
        // return JSON.parse(stringified)
        key = this._realKey(key);
        const cacheType = this._cacheTypes[key];
        const emtpyMaybe = new common_1.Maybe();
        let stringified;
        if (cacheType != null && cacheType !== ARRAY) {
            return Promise.resolve(emtpyMaybe);
        }
        if (forceRemote && this._hasEngine) {
            stringified = (await this._fetchPrimitive(key, false)).TryGetValue(null);
        }
        if ((typeof stringified !== 'string') && this._localCache.hasOwnProperty(key)) {
            stringified = this._localCache[key];
        }
        if ((typeof stringified !== 'string') && this._includeBit(cacheType, CacheLevel.REMOTE)) {
            stringified = (await this._fetchPrimitive(key, false)).TryGetValue(null);
        }
        if ((typeof stringified === 'string')) {
            return Promise.resolve(new common_1.Maybe(JSON.parse(stringified)));
        }
        return Promise.resolve(emtpyMaybe);
    }
    /**
     * Retrieves an object from cache.
     * @param {string} key The key to look up.
     * @param {boolean} forceRemote Skip local cache and fetch from remote server. Default is `false`.
     * @param {boolean} parseType (Only takes effect when `forceRemote=true`)
     *      If true, try to parse every property value to nearest possible primitive data type.
     *      If false, always return an object with string properties.
     *      Default is `true`. Set to `false` to save some performance.
     */
    getObject(key, forceRemote = false, parseType = true) {
        // key = this._realKey(key)
        // if (this._cacheTypes[key] != null && this._cacheTypes[key] !== OBJECT) { return Promise.resolve(new Maybe) }
        // return (!(forceRemote && this._hasEngine) && this._localCache[key] !== undefined)
        //     ? Promise.resolve(this._localCache[key])
        //     : this._fetchObject(key, parseType)
        key = this._realKey(key);
        const cacheType = this._cacheTypes[key];
        if (cacheType != null && cacheType !== OBJECT) {
            return Promise.resolve(new common_1.Maybe);
        }
        if (forceRemote && this._hasEngine) {
            return this._fetchObject(key, parseType);
        }
        if (this._localCache.hasOwnProperty(key)) {
            return Promise.resolve(new common_1.Maybe(this._localCache[key]));
        }
        if (this._includeBit(cacheType, CacheLevel.REMOTE)) {
            return this._fetchObject(key, parseType);
        }
        return Promise.resolve(new common_1.Maybe);
    }
    /**
     * Saves a string or number or boolean to cache.
     * @param {string} key The key for later look up.
     * @param {Primitive} value Primitive value to save.
     * @param {number} duration Expiration time in seconds.
     * @param {CacheLevel} level Whether to save in local cache only, or remote only, or both.
     *         If both, then local cache is kept in sync with remote value even when
     *         this value is updated in remote service by another app process.
     */
    async setPrimitive(key, value, duration = 0, level) {
        common_1.Guard.assertArgDefined('key', key);
        common_1.Guard.assertArgDefined('value', value);
        let multi;
        level = this._defaultLevel(level);
        key = this._realKey(key);
        this._cacheTypes[key] = PRIMITIVE;
        if (this._includeBit(level, CacheLevel.LOCAL)) {
            this._localCache[key] = value;
            this._setLocalExp(key, duration);
        }
        if (this._hasEngine && this._includeBit(level, CacheLevel.REMOTE)) {
            multi = this._engine.multi();
            multi.del(key);
            multi.set(key, value);
            if (duration > 0) {
                multi.expire(key, duration);
            }
            await multi.execAsync();
        }
        if (this._hasEngine && this._includeBit(level, CacheLevel.BOTH)) {
            await this._syncOn(key);
        }
    }
    /**
     * Saves an array to cache.
     * @param {string} key The key for later look up.
     * @param {PrimitiveType[] | PrimitiveFlatJson[] } arr Array of any type to save.
     * @param {number} duration Expiration time in seconds.
     * @param {CacheLevel} level Whether to save in local cache only, or remote only, or both.
     *         If both, then local cache is kept in sync with remote value even when
     *         this value is updated in remote service by another app process.
     */
    setArray(key, arr, duration = 0, level) {
        common_1.Guard.assertArgDefined('key', key);
        common_1.Guard.assertArgDefined('arr', arr);
        const stringified = JSON.stringify(arr);
        const promise = this.setPrimitive(key, stringified, duration, level);
        this._cacheTypes[this._realKey(key)] = ARRAY;
        return promise;
    }
    /**
     * Saves an object to cache.
     * @param {string} key The key for later look up.
     * @param {PrimitiveFlatJson} value Object value to save.
     * @param {number} duration Expiration time in seconds.
     * @param {CacheLevel} level Whether to save in local cache only, or remote only, or both.
     *         If both, then local cache is kept in sync with remote value even when
     *         this value is updated in remote service by another app process.
     */
    async setObject(key, value, duration, level) {
        common_1.Guard.assertArgDefined('key', key);
        common_1.Guard.assertArgDefined('value', value);
        let multi;
        level = this._defaultLevel(level);
        key = this._realKey(key);
        this._cacheTypes[key] = OBJECT;
        if (this._includeBit(level, CacheLevel.LOCAL)) {
            this._localCache[key] = value;
            this._setLocalExp(key, duration);
        }
        if (this._hasEngine && this._includeBit(level, CacheLevel.REMOTE)) {
            multi = this._engine.multi();
            multi.del(key);
            multi.hmset(key, value);
            if (duration > 0) {
                multi.expire(key, duration);
            }
            await multi.execAsync();
        }
        if (this._hasEngine && this._includeBit(level, CacheLevel.BOTH)) {
            await this._syncOn(key);
        }
    }
    _connectSingle() {
        const opts = this._options.single;
        if (!opts) {
            return null;
        }
        return redis.createClient({
            host: opts.host,
            port: opts.port,
        });
    }
    _defaultLevel(level) {
        return (level)
            ? level
            : (this._hasEngine) ? CacheLevel.REMOTE : CacheLevel.LOCAL;
    }
    _deleteLocal(key) {
        delete this._localCache[key];
        delete this._cacheTypes[key];
        clearTimeout(this._cacheExps[key]);
        delete this._cacheExps[key];
    }
    _extractKey(channel) {
        const result = this._keyRegrex.exec(channel);
        return result[1];
    }
    async _fetchObject(key, parseType) {
        const response = await this._engine.hgetallAsync(key);
        const data = (this._cacheTypes[key] != ARRAY && parseType) ? this._parseObjectType(response) : response;
        return (data == null) ? new common_1.Maybe : new common_1.Maybe(data);
    }
    async _fetchPrimitive(key, parseType = true) {
        const response = await this._engine.getAsync(key);
        const data = (this._cacheTypes[key] != ARRAY && parseType) ? this._parsePrimitiveType(response) : response;
        return (data == null) ? new common_1.Maybe : new common_1.Maybe(data);
    }
    _createLockChain() {
        return [];
    }
    /**
     * Removes the last lock from lock queue then returns it.
     */
    _popLock(key) {
        const lockChain = this._cacheLocks[key], lock = lockChain.pop();
        if (!lockChain.length) {
            delete this._cacheLocks[key];
        }
        return lock;
    }
    /**
     * Gets the first lock in queue.
     */
    _peekLock(key) {
        return (this._cacheLocks[key]) ? this._cacheLocks[key][0] : null;
    }
    /**
     * Adds a new lock at the beginning of lock queue.
     */
    _pushLock(key) {
        let lockChain = this._cacheLocks[key];
        let releaseFn;
        // Note: The callback inside Promise constructor
        //        is invoked SYNCHRONOUSLY
        const lock = new Promise(resolve => releaseFn = resolve);
        lock['release'] = releaseFn;
        if (!lockChain) {
            lockChain = this._cacheLocks[key] = this._createLockChain();
        }
        lockChain.unshift(lock);
    }
    _lockKey(key) {
        const lock = this._peekLock(key);
        // Put my lock here
        this._pushLock(key);
        // If I'm the first one, I don't need to wait.
        if (!lock) {
            return Promise.resolve();
        }
        // If this key is already locked, then wait...
        return lock;
    }
    _releaseKey(key) {
        const lock = this._popLock(key);
        lock && lock['release']();
    }
    async _syncOn(key) {
        let sub = this._engineSub;
        if (!sub) {
            this._keyRegrex = new RegExp(`${EVENT_PREFIX}(.*)`);
            if (!this._options.cluster) {
                sub = this._engineSub = this._connectSingle();
            }
            else {
                // Redis-clusr can handle bi-directional commands.
                sub = this._engineSub = this._engine;
            }
            // TODO: This config should be in Redis conf
            await this._engine.config('SET', 'notify-keyspace-events', 'KEA');
            sub.on('message', async (channel, action) => {
                const affectedKey = this._extractKey(channel);
                let fromRemote;
                await this._lockKey(key);
                switch (action) {
                    case 'set':
                        fromRemote = await this._fetchPrimitive(affectedKey, true);
                        if (fromRemote.hasValue) {
                            this._localCache[affectedKey] = fromRemote.value;
                        }
                        break;
                    case 'hset':
                        fromRemote = await this._fetchObject(affectedKey, true);
                        if (fromRemote.hasValue) {
                            this._localCache[affectedKey] = fromRemote.value;
                        }
                        break;
                    case 'del':
                        this._deleteLocal(affectedKey);
                        break;
                }
                this._releaseKey(key);
            });
        }
        // Listens to changes of this key.
        await sub.subscribeAsync(`${EVENT_PREFIX}${key}`);
    }
    async _syncOff(key) {
        const sub = this._engineSub;
        if (!sub) {
            return;
        }
        await sub.unsubscribeAsync(`${EVENT_PREFIX}${key}`);
    }
    _includeBit(source, target) {
        return ((source & target) == target);
    }
    _parsePrimitiveType(val) {
        try {
            // Try parsing to number or boolean
            return JSON.parse(val);
        }
        catch {
            return val;
        }
    }
    _parseObjectType(obj) {
        for (const p in obj) {
            /* istanbul ignore else */
            if (obj.hasOwnProperty(p)) {
                obj[p] = this._parsePrimitiveType(obj[p]);
            }
        }
        return obj;
    }
    _promisify(prototype) {
        for (const fn of ['del', 'hmset', 'hgetall', 'get', 'set', 'config', 'quit', 'subscribe', 'unsubscribe']) {
            prototype[`${fn}Async`] = util.promisify(prototype[fn]);
        }
        prototype['__promisified'] = true;
    }
    _setLocalExp(key, duration) {
        if (duration > 0) {
            this._cacheExps[key] = setTimeout(() => this._deleteLocal(key), duration * 1000);
        }
    }
    _realKey(key) {
        return `${this._options.name}::${key}`;
    }
}
exports.CacheProvider = CacheProvider;
//# sourceMappingURL=CacheProvider.js.map