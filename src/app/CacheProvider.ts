import * as util from 'util'
import * as redis from 'redis'
import * as RedisClustr from 'redis-clustr'
redis.Multi.prototype.execAsync = util.promisify(redis.Multi.prototype.exec)

import { CacheConnectionDetail, Maybe, Guard } from '@micro-fleet/common'


type CacheLockChain = Promise<void>[]

interface RedisClient extends redis.RedisClient {
    [x: string]: any
}

interface MultiAsync extends redis.Multi {
    [x: string]: any
}

const EVENT_PREFIX = '__keyspace@0__:'

export enum CacheLevel {
    /**
     * Only caches in local memory.
     */
    LOCAL = 1, // Binary: 01

    /**
     * Only caches in remote service.
     */
    REMOTE = 2, // Binary: 10

    /**
     * Caches in remote service and keeps sync with local memory.
     */
    BOTH = 3, // Binary: 11
}

export type CacheProviderConstructorOpts = {
    /**
     * Is prepended in cache key to avoid key collision between cache instances.
     */
    name: string,

    /**
     * Credentials to connect to a single cache service.
     */
    single?: CacheConnectionDetail,

    /**
     * Credentials to connect to a cluster of cache services.
     * This option overrides `single`.
     */
    cluster?: CacheConnectionDetail[]
}

export type CacheSetOptions = {
    /**
     * Expiration time in seconds. Default is to never expire.
     */
    duration?: number,

    /**
     * Whether to save in local cache only, or remote only, or both.
     * If both, then local cache is kept in sync with remote value even when
     * this value is updated in remote service by another app process.
     */
    level?: CacheLevel,

    /**
     * If true, the key is not prepended with service slug, and is accessible
     * by other CacheProvider instances from other services.
     * Default is `false`.
     */
    isGlobal?: boolean,
}

export type CacheGetOptions = {
    /**
     * Skip local cache and fetch from remote server.
     * Default is `false`.
     */
    forceRemote?: boolean,

    /**
     * (Only takes effect when `forceRemote=true`)
     * If true, try to parse value to nearest possible primitive data type.
     * If false, always return string. Default is `true`. Set to `false` to save some performance.
     * Default is `true`.
     */
    parseType?: boolean,

    /**
     * If true, the key is not prepended with service slug, so we can
     * get value set by other CacheProvider instances in other services.
     * Default is `false`.
     */
    isGlobal?: boolean,
}

/**
 * Provides methods to read and write data to cache.
 */
export class CacheProvider {

    private _engine: RedisClient
    private _engineSub: RedisClient
    private _localCache: { [x: string]: PrimitiveType | PrimitiveFlatJson }
    private _cacheLocks: { [x: string]: CacheLockChain }
    private _keyRegrex: RegExp


    /**
     * Stores setTimeout token of each key.
     */
    private _cacheExps: { [x: string]: NodeJS.Timer }


    constructor(private _options: CacheProviderConstructorOpts) {
        this._localCache = {
            '@#!': null, // Activate hash mode (vs. V8's hidden class mode)
        }
        this._cacheExps = {}
        this._cacheLocks = {}

        if (_options.cluster) {
            this._promisify(RedisClustr.prototype)
            this._engine = new RedisClustr({
                servers: _options.cluster,
            })
        } else {
            this._promisify(redis.RedisClient.prototype)
            this._engine = this._connectSingle()
        }
    }

    private get _hasEngine(): boolean {
        return (this._engine != null)
    }

    /**
     * Clears all local cache and disconnects from remote cache service.
     */
    public async dispose(): Promise<void> {
        const tasks = []
        if (this._engine) {
            tasks.push(this._engine.quitAsync())
        }
        if (this._engineSub) {
            tasks.push(this._engineSub.quitAsync())
            this._engineSub = null
        }
        await Promise.all(tasks)
        this._engine = this._localCache = this._cacheExps = null
    }

    /**
     * Removes a key from cache.
     */
    public async delete(key: string, isGlobal: boolean = false): Promise<void> {
        key = isGlobal ? key : this._realKey(key)
        Guard.assertArgDefined('key', key)
        this._deleteLocal(key)
        await this._syncOff(key)
        await this._engine.delAsync(key)
    }

    /**
     * Retrieves a string or number or boolean from cache.
     * @param {string} key The key to look up.
     */
    public getPrimitive(key: string, opts: CacheGetOptions = {}): Promise<Maybe<PrimitiveType>> {
        Guard.assertArgDefined('key', key)
        key = opts.isGlobal ? key : this._realKey(key)
        const parseType = (opts.parseType != null) ? opts.parseType : true

        if (opts.forceRemote && this._hasEngine) {
            return this._fetchPrimitive(key, parseType)
        }
        else if (this._localCache.hasOwnProperty(key)) {
            return Promise.resolve(new Maybe<any>(this._localCache[key]))
        }
        else if (this._hasEngine) {
            return this._fetchPrimitive(key, parseType)
        }

        return Promise.resolve(new Maybe)
    }
    /**
     * Retrieves an array of strings or numbers or booleans from cache.
     * @param {string} key The key to look up.
     * @param {boolean} forceRemote Skip local cache and fetch from remote server. Default is `false`.
     */
    public async getArray(key: string, opts: CacheGetOptions = {}): Promise<Maybe<PrimitiveType[]>> {
        Guard.assertArgDefined('key', key)
        key = opts.isGlobal ? key : this._realKey(key)
        const emptyMaybe = new Maybe<any[]>()
        let stringified: string

        if (opts.forceRemote && this._hasEngine) {
            stringified = (await this._fetchPrimitive(key, false)).TryGetValue(null)
        }
        else if (this._localCache.hasOwnProperty(key)) {
            stringified = this._localCache[key] as string
        }
        else if (this._hasEngine) {
            stringified = (await this._fetchPrimitive(key, false)).TryGetValue(null)
        }

        if ((typeof stringified === 'string')) {
            return Promise.resolve(
                new Maybe(JSON.parse(stringified))
            )
        }
        return Promise.resolve(emptyMaybe)
    }

    /**
     * Retrieves an object from cache.
     * @param {string} key The key to look up.
     */
    public getObject(key: string, opts: CacheGetOptions = {}): Promise<Maybe<PrimitiveFlatJson>> {
        Guard.assertArgDefined('key', key)
        key = opts.isGlobal ? key : this._realKey(key)
        const parseType = (opts.parseType != null) ? opts.parseType : true

        if (opts.forceRemote && this._hasEngine) {
            return this._fetchObject(key, parseType)
        }
        else if (this._localCache.hasOwnProperty(key)) {
            return Promise.resolve(new Maybe<any>(this._localCache[key]))
        }
        return this._fetchObject(key, parseType)
    }

    /**
     * Saves a string or number or boolean to cache.
     * @param {string} key The key for later look up.
     * @param {Primitive} value Primitive value to save.
     */
    public async setPrimitive(key: string, value: PrimitiveType, opts: CacheSetOptions = {}): Promise<void> {
        Guard.assertArgDefined('key', key)
        Guard.assertArgDefined('value', value)

        let multi: MultiAsync
        const level = this._defaultLevel(opts.level)
        const duration = opts.duration || 0
        key = opts.isGlobal ? key : this._realKey(key)

        if (this._includeBit(level, CacheLevel.LOCAL)) {
            this._localCache[key] = value
            this._setLocalExp(key, duration)
        }

        if (this._hasEngine && this._includeBit(level, CacheLevel.REMOTE)) {
            multi = this._engine.multi()
            multi.del(key)
            multi.set(key, <any>value)
            if (duration > 0) {
                multi.expire(key, duration)
            }

            await multi.execAsync()
        }

        if (this._hasEngine && this._includeBit(level, CacheLevel.BOTH)) {
            await this._syncOn(key)
        }
    }

    /**
     * Saves an array to cache.
     * @param {string} key The key for later look up.
     * @param {PrimitiveType[] | PrimitiveFlatJson[] } arr Array of any type to save.
     */
    public setArray(key: string, arr: any[], opts: CacheSetOptions = {}): Promise<void> {
        Guard.assertArgDefined('key', key)
        Guard.assertArgDefined('arr', arr)

        const stringified = JSON.stringify(arr)
        const promise = this.setPrimitive(key, stringified, opts)
        return promise
    }

    /**
     * Saves an object to cache.
     * @param {string} key The key for later look up.
     * @param {PrimitiveFlatJson} value Object value to save.
     */
    public async setObject(key: string, value: PrimitiveFlatJson, opts: CacheSetOptions = {}): Promise<void> {
        Guard.assertArgDefined('key', key)
        Guard.assertArgDefined('value', value)
        let multi: MultiAsync
        const level = this._defaultLevel(opts.level)
        const duration = opts.duration || 0
        key = opts.isGlobal ? key : this._realKey(key)

        if (this._includeBit(level, CacheLevel.LOCAL)) {
            this._localCache[key] = value
            this._setLocalExp(key, duration)
        }

        if (this._hasEngine && this._includeBit(level, CacheLevel.REMOTE)) {
            multi = this._engine.multi()
            multi.del(key)
            multi.hmset(key, <any>value)
            if (duration > 0) {
                multi.expire(key, duration)
            }
            await multi.execAsync()
        }

        if (this._hasEngine && this._includeBit(level, CacheLevel.BOTH)) {
            await this._syncOn(key)
        }
    }


    private _connectSingle(): redis.RedisClient {
        const opts = this._options.single
        if (!opts) { return null }

        return redis.createClient({
            host: opts.host,
            port: opts.port,
        })
    }

    private _defaultLevel(level: CacheLevel): CacheLevel {
        return (level)
            ? level
            : (this._hasEngine) ? CacheLevel.REMOTE : CacheLevel.LOCAL
    }

    private _deleteLocal(key: string) {
        delete this._localCache[key]
        clearTimeout(this._cacheExps[key])
        delete this._cacheExps[key]
    }

    private _extractKey(channel: string): string {
        const result = this._keyRegrex.exec(channel)
        return result[1]
    }

    private async _fetchObject(key: string, parseType: boolean): Promise<Maybe<any>> {
        const response = await this._engine.hgetallAsync(key)
        const data = (parseType ? this._parseObjectType(response) : response)
        return (data == null) ? new Maybe : new Maybe(data)
    }

    private async _fetchPrimitive(key: string, parseType: boolean): Promise<Maybe<any>> {
        const response = await this._engine.getAsync(key)
        const data = (parseType ? this._parsePrimitiveType(response) : response)
        return (data == null) ? new Maybe : new Maybe(data)
    }

    private _createLockChain(): CacheLockChain {
        return []
    }

    /**
     * Removes the last lock from lock queue then returns it.
     */
    private _popLock(key: string): Promise<void> {
        const lockChain: CacheLockChain = this._cacheLocks[key],
            lock = lockChain.pop()
        if (!lockChain.length) {
            delete this._cacheLocks[key]
        }
        return lock
    }

    /**
     * Gets the first lock in queue.
     */
    private _peekLock(key: string): Promise<void> {
        return (this._cacheLocks[key]) ? this._cacheLocks[key][0] : null
    }

    /**
     * Adds a new lock at the beginning of lock queue.
     */
    private _pushLock(key: string): void {
        let lockChain: CacheLockChain = this._cacheLocks[key]
        let releaseFn

        // Note: The callback inside Promise constructor
        //        is invoked SYNCHRONOUSLY
        const lock = new Promise<void>(resolve => releaseFn = resolve)
        lock['release'] = releaseFn

        if (!lockChain) {
            lockChain = this._cacheLocks[key] = this._createLockChain()
        }
        lockChain.unshift(lock)
    }

    private _lockKey(key: string): Promise<void> {
        const lock = this._peekLock(key)

        // Put my lock here
        this._pushLock(key)

        // If I'm the first one, I don't need to wait.
        if (!lock) {
            return Promise.resolve()
        }

        // If this key is already locked, then wait...
        return lock
    }

    private _releaseKey(key: string): void {
        const lock = this._popLock(key)
        lock && lock['release']()
    }

    private async _syncOn(key: string): Promise<void> {
        let sub = this._engineSub

        if (!sub) {
            this._keyRegrex = new RegExp(`${EVENT_PREFIX}(.*)`)
            if (!this._options.cluster) {
                sub = this._engineSub = this._connectSingle()
            } else {
                // Redis-clusr can handle bi-directional commands.
                sub = this._engineSub = this._engine
            }

            // TODO: This config should be in Redis conf
            await this._engine.config('SET', 'notify-keyspace-events', 'KEA')
            sub.on('message', async (channel, action) => {
                const affectedKey = this._extractKey(channel)
                let fromRemote: Maybe<any>

                await this._lockKey(key)

                switch (action) {
                    case 'set':
                        fromRemote = await this._fetchPrimitive(affectedKey, true)
                        if (fromRemote.hasValue) {
                            this._localCache[affectedKey] = fromRemote.value
                        }
                        break
                    case 'hset':
                        fromRemote = await this._fetchObject(affectedKey, true)
                        if (fromRemote.hasValue) {
                            this._localCache[affectedKey] = fromRemote.value
                        }
                        break
                    case 'del':
                        this._deleteLocal(affectedKey)
                        break
                }
                this._releaseKey(key)
            })
        }

        // Listens to changes of this key.
        await sub.subscribeAsync(`${EVENT_PREFIX}${key}`)
    }

    private async _syncOff(key: string): Promise<void> {
        const sub = this._engineSub
        if (!sub) { return }
        await sub.unsubscribeAsync(`${EVENT_PREFIX}${key}`)
    }

    private _includeBit(source: CacheLevel, target: CacheLevel): boolean {
        return ((source & target) == target)
    }

    private _parsePrimitiveType(val: string): any {
        try {
            // Try parsing to number or boolean
            return JSON.parse(val)
        } catch {
            return val
        }
    }

    private _parseObjectType(obj: {[x: string]: string}): any {
        for (const p in obj) {
            /* istanbul ignore else */
            if (obj.hasOwnProperty(p)) {
                obj[p] = this._parsePrimitiveType(obj[p])
            }
        }
        return obj
    }

    private _promisify(prototype: any): void {
        for (const fn of ['del', 'hmset', 'hgetall', 'get', 'set', 'config', 'quit', 'subscribe', 'unsubscribe']) {
            prototype[`${fn}Async`] = util.promisify(prototype[fn])
        }
        prototype['__promisified'] = true
    }

    private _setLocalExp(key: string, duration: number): void {
        if (duration > 0) {
            this._cacheExps[key] = setTimeout(() => this._deleteLocal(key), duration * 1000)
        }
    }

    private _realKey(key: string): string {
        return `${this._options.name}::${key}`
    }
}
