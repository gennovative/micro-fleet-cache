"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("util");
const redis = require("redis");
const RedisClustr = require("redis-clustr");
redis.Multi.prototype.execAsync = util.promisify(redis.Multi.prototype.exec);
const common_1 = require("@micro-fleet/common");
const ICacheProvider_1 = require("./ICacheProvider");
const EVENT_PREFIX = '__keyspace@0__:';
/**
 * Provides methods to read and write data to cache.
 */
class RedisCacheProvider {
    constructor(_options) {
        this._options = _options;
        this._localCache = {
            '@#!': null,
        };
        this._cacheExps = {};
        this._cacheLocks = {};
        if (!_options) {
            return;
        }
        if (_options.cluster) {
            this._promisify(RedisClustr.prototype);
            this._engine = new RedisClustr({
                servers: _options.cluster,
            });
        }
        else if (_options.single) {
            this._promisify(redis.RedisClient.prototype);
            this._engine = this._connectSingle(_options.single);
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
        this._engine = this._localCache = this._cacheExps = null;
    }
    /**
     * Removes an exact key or multiple matched keys from cache.
     */
    async delete(key, opts = {}) {
        if (opts.isPattern) {
            return this._deletePattern(key);
        }
        key = opts.isGlobal ? key : this._realKey(key);
        common_1.Guard.assertArgDefined('key', key);
        this._deleteLocal(key);
        await this._syncOff(key);
        await this._engine.delAsync(key);
    }
    async _deletePattern(pattern) {
        this._deleteLocalPattern(pattern);
        if (!this._engine) {
            return;
        }
        // Scan all remote keys
        // Delete all of them
        const END_CURSOR = '0';
        let result = {
            cursor: '',
            keys: [],
        };
        const keySet = new Set();
        do {
            result = await this._scanRemoteKeys(pattern, result.cursor);
            // Redis SCAN may return duplicate items
            // Adding to a Set to avoid duplication
            result.keys.forEach(k => keySet.add(k));
        } while (result.cursor != END_CURSOR);
        return (result.keys.length > 0)
            ? this._engine.delAsync(...keySet)
            : Promise.resolve();
    }
    _deleteLocalPattern(pattern) {
        // Replace with Regexp syntax
        pattern = pattern.replace(/\*/g, '(.*)').replace(/\?/g, '(.?)');
        const regex = new RegExp(`^${pattern}$`);
        this._localCache = Object.entries(this._localCache)
            .reduce((prev, [key, val]) => {
            if (!key.match(regex)) {
                prev[key] = val;
            }
            return prev;
        }, {});
    }
    /**
     * @see https://redis.io/commands/scan
     */
    async _scanRemoteKeys(pattern, fromCursor) {
        const ITEMS_PER_ITERATION = 10;
        const result = await this._engine.scanAsync(fromCursor, 'MATCH', pattern, 'COUNT', ITEMS_PER_ITERATION);
        return {
            cursor: result[0],
            keys: result[1],
        };
    }
    /**
     * Retrieves a string or number or boolean from cache.
     * @param {string} key The key to look up.
     */
    getPrimitive(key, opts = {}) {
        common_1.Guard.assertArgDefined('key', key);
        key = opts.isGlobal ? key : this._realKey(key);
        const parseType = (opts.parseType != null) ? opts.parseType : true;
        if (opts.forceRemote && this._hasEngine) {
            return this._fetchPrimitive(key, parseType);
        }
        else if (this._localCache.hasOwnProperty(key)) {
            return Promise.resolve(common_1.Maybe.Just(this._localCache[key]));
        }
        else if (this._hasEngine) {
            return this._fetchPrimitive(key, parseType);
        }
        return Promise.resolve(common_1.Maybe.Nothing());
    }
    /**
     * Retrieves an array of strings or numbers or booleans from cache.
     * @param {string} key The key to look up.
     * @param {boolean} forceRemote Skip local cache and fetch from remote server. Default is `false`.
     */
    async getArray(key, opts = {}) {
        common_1.Guard.assertArgDefined('key', key);
        key = opts.isGlobal ? key : this._realKey(key);
        let stringified;
        if (opts.forceRemote && this._hasEngine) {
            stringified = (await this._fetchPrimitive(key, false));
        }
        else if (this._localCache.hasOwnProperty(key)) {
            stringified = common_1.Maybe.Just(this._localCache[key]);
        }
        else if (this._hasEngine) {
            stringified = (await this._fetchPrimitive(key, false));
        }
        else {
            stringified = common_1.Maybe.Nothing();
        }
        return Promise.resolve(stringified.map(JSON.parse));
    }
    /**
     * Retrieves an object from cache.
     * @param {string} key The key to look up.
     */
    getObject(key, opts = {}) {
        common_1.Guard.assertArgDefined('key', key);
        key = opts.isGlobal ? key : this._realKey(key);
        const parseType = (opts.parseType != null) ? opts.parseType : true;
        if (opts.forceRemote && this._hasEngine) {
            return this._fetchObject(key, parseType);
        }
        else if (this._localCache.hasOwnProperty(key)) {
            return Promise.resolve(common_1.Maybe.Just(this._localCache[key]));
        }
        else if (this._hasEngine) {
            return this._fetchObject(key, parseType);
        }
        return Promise.resolve(common_1.Maybe.Nothing());
    }
    /**
     * Saves a string or number or boolean to cache.
     * @param {string} key The key for later look up.
     * @param {Primitive} value Primitive value to save.
     */
    async setPrimitive(key, value, opts = {}) {
        common_1.Guard.assertArgDefined('key', key);
        common_1.Guard.assertArgDefined('value', value);
        let multi;
        const level = this._defaultLevel(opts.level);
        const duration = opts.duration || 0;
        key = opts.isGlobal ? key : this._realKey(key);
        if (this._includeBit(level, ICacheProvider_1.CacheLevel.LOCAL)) {
            this._localCache[key] = value;
            this._setLocalExp(key, duration);
        }
        if (this._hasEngine && this._includeBit(level, ICacheProvider_1.CacheLevel.REMOTE)) {
            multi = this._engine.multi();
            multi.del(key);
            multi.set(key, value);
            if (duration > 0) {
                multi.expire(key, duration);
            }
            await multi.execAsync();
        }
        if (this._hasEngine && this._includeBit(level, ICacheProvider_1.CacheLevel.BOTH)) {
            await this._syncOn(key);
        }
    }
    /**
     * Saves an array to cache.
     * @param {string} key The key for later look up.
     * @param {PrimitiveType[] | object[] } arr Array of any type to save.
     */
    setArray(key, arr, opts = {}) {
        common_1.Guard.assertArgDefined('key', key);
        common_1.Guard.assertArgDefined('arr', arr);
        const stringified = JSON.stringify(arr);
        const promise = this.setPrimitive(key, stringified, opts);
        return promise;
    }
    /**
     * Saves an object to cache.
     * @param {string} key The key for later look up.
     * @param {object} value Object value to save.
     */
    async setObject(key, value, opts = {}) {
        common_1.Guard.assertArgDefined('key', key);
        common_1.Guard.assertArgDefined('value', value);
        let multi;
        const level = this._defaultLevel(opts.level);
        const duration = opts.duration || 0;
        key = opts.isGlobal ? key : this._realKey(key);
        if (this._includeBit(level, ICacheProvider_1.CacheLevel.LOCAL)) {
            this._localCache[key] = value;
            this._setLocalExp(key, duration);
        }
        if (this._hasEngine && this._includeBit(level, ICacheProvider_1.CacheLevel.REMOTE)) {
            multi = this._engine.multi();
            multi.del(key);
            multi.hmset(key, value);
            if (duration > 0) {
                multi.expire(key, duration);
            }
            await multi.execAsync();
        }
        if (this._hasEngine && this._includeBit(level, ICacheProvider_1.CacheLevel.BOTH)) {
            await this._syncOn(key);
        }
    }
    _connectSingle({ host, port }) {
        return redis.createClient({ host, port });
    }
    _defaultLevel(level) {
        return (level)
            ? level
            : (this._hasEngine) ? ICacheProvider_1.CacheLevel.REMOTE : ICacheProvider_1.CacheLevel.LOCAL;
    }
    _deleteLocal(key) {
        delete this._localCache[key];
        clearTimeout(this._cacheExps[key]);
        delete this._cacheExps[key];
    }
    _extractKey(channel) {
        const result = this._keyRegrex.exec(channel);
        return result[1];
    }
    async _fetchObject(key, parseType) {
        const response = await this._engine.hgetallAsync(key);
        const data = (parseType ? this._parseObjectType(response) : response);
        return (data == null) ? common_1.Maybe.Nothing() : common_1.Maybe.Just(data);
    }
    async _fetchPrimitive(key, parseType) {
        const response = await this._engine.getAsync(key);
        const data = (parseType ? this._parsePrimitiveType(response) : response);
        return (data == null) ? common_1.Maybe.Nothing() : common_1.Maybe.Just(data);
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
            if (this._options.cluster) {
                // Redis-clusr can handle bi-directional commands.
                sub = this._engineSub = this._engine;
            }
            else {
                sub = this._engineSub = this._connectSingle(this._options.single);
            }
            // TODO: This config should be in Redis conf
            await this._engine.config('SET', 'notify-keyspace-events', 'KEA');
            sub.on('message', async (channel, action) => {
                const affectedKey = this._extractKey(channel);
                await this._lockKey(key);
                switch (action) {
                    case 'set':
                        (await this._fetchPrimitive(affectedKey, true))
                            .map(val => this._localCache[affectedKey] = val);
                        break;
                    case 'hset':
                        (await this._fetchObject(affectedKey, true))
                            .map(val => this._localCache[affectedKey] = val);
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
        const FN = ['del', 'hmset', 'hgetall', 'get', 'set',
            'config', 'quit', 'subscribe', 'unsubscribe', 'scan'];
        for (const fn of FN) {
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
exports.RedisCacheProvider = RedisCacheProvider;
//# sourceMappingURL=RedisCacheProvider.js.map