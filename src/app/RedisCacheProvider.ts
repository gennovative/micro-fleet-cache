import * as util from 'util'
import * as redis from 'redis'
import * as RedisClustr from 'redis-clustr'
redis.Multi.prototype.execAsync = util.promisify(redis.Multi.prototype.exec)
import { Maybe, Guard, PrimitiveType } from '@micro-fleet/common'

import { ICacheProvider, CacheGetOptions, CacheSetOptions,
    CacheLevel, CacheConnectionDetail, CacheDelOptions } from './ICacheProvider'


type CacheLockChain = Promise<void>[]

// tslint:disable-next-line: interface-name
interface RedisClient extends redis.RedisClient {
    [x: string]: any
}

// tslint:disable-next-line: interface-name
interface MultiAsync extends redis.Multi {
    [x: string]: any
}

type ScanResult = { cursor: string, keys: string[] }

const EVENT_PREFIX = '__keyspace@0__:'

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

/**
 * Provides methods to read and write data to cache.
 */
export class RedisCacheProvider implements ICacheProvider {

    private _engine: RedisClient
    private _engineSub: RedisClient
    private _localCache: { [x: string]: PrimitiveType | object }
    private _cacheLocks: { [x: string]: CacheLockChain }
    private _keyRegrex: RegExp


    /**
     * Stores setTimeout token of each key.
     */
    private _cacheExps: { [x: string]: NodeJS.Timer }


    constructor(private _options?: CacheProviderConstructorOpts) {
        this._localCache = {
            '@#!': null, // Activate hash mode (vs. V8's hidden class mode)
        }
        this._cacheExps = {}
        this._cacheLocks = {}

        if (!_options) { return }

        if (_options.cluster) {
            this._promisify(RedisClustr.prototype)
            this._engine = new RedisClustr({
                servers: _options.cluster,
            })
        } else if (_options.single) {
            this._promisify(redis.RedisClient.prototype)
            this._engine = this._connectSingle(_options.single)
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
     * Removes an exact key or multiple matched keys from cache.
     */
    public async delete(key: string, opts: CacheDelOptions = {}): Promise<void> {
        if (opts.isPattern) {
            return this._deletePattern(key)
        }
        key = opts.isGlobal ? key : this._realKey(key)
        Guard.assertArgDefined('key', key)
        this._deleteLocal(key)
        await this._syncOff(key)
        await this._engine.delAsync(key)
    }

    private async _deletePattern(pattern: string): Promise<void> {
        this._deleteLocalPattern(pattern)
        if (!this._engine) { return }

        // Scan all remote keys
        // Delete all of them

        const END_CURSOR = '0'
        let result: ScanResult = {
            cursor: '',
            keys: [],
        }
        const keySet = new Set<string>()
        do {
            result = await this._scanRemoteKeys(pattern, result.cursor)
            // Redis SCAN may return duplicate items
            // Adding to a Set to avoid duplication
            result.keys.forEach(k => keySet.add(k))
        } while (result.cursor != END_CURSOR)

        return (result.keys.length > 0)
            ? this._engine.delAsync(...keySet)
            : Promise.resolve()
    }

    private _deleteLocalPattern(pattern: string): void {
        // Replace with Regexp syntax
        pattern = pattern.replace(/\*/g, '(.*)').replace(/\?/g, '(.?)')
        const regex = new RegExp(`^${pattern}$`)
        this._localCache = Object.entries(this._localCache)
            .reduce((prev, [key, val]) => {
                if (!key.match(regex)) {
                    prev[key] = val
                }
                return prev
            }, {})
    }

    /**
     * @see https://redis.io/commands/scan
     */
    private async _scanRemoteKeys(pattern: string, fromCursor: string): Promise<ScanResult> {
        const ITEMS_PER_ITERATION = 10
        const result: [string, string[]] = await this._engine.scanAsync(fromCursor, 'MATCH', pattern, 'COUNT', ITEMS_PER_ITERATION)
        return {
            cursor: result[0],
            keys: result[1],
        }
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
            return Promise.resolve(Maybe.Just<any>(this._localCache[key]))
        }
        else if (this._hasEngine) {
            return this._fetchPrimitive(key, parseType)
        }

        return Promise.resolve(Maybe.Nothing())
    }
    /**
     * Retrieves an array of strings or numbers or booleans from cache.
     * @param {string} key The key to look up.
     * @param {boolean} forceRemote Skip local cache and fetch from remote server. Default is `false`.
     */
    public async getArray(key: string, opts: CacheGetOptions = {}): Promise<Maybe<PrimitiveType[]>> {
        Guard.assertArgDefined('key', key)
        key = opts.isGlobal ? key : this._realKey(key)
        let stringified: Maybe<string>

        if (opts.forceRemote && this._hasEngine) {
            stringified = (await this._fetchPrimitive(key, false))
        }
        else if (this._localCache.hasOwnProperty(key)) {
            stringified = Maybe.Just(this._localCache[key] as string)
        }
        else if (this._hasEngine) {
            stringified = (await this._fetchPrimitive(key, false))
        } else {
            stringified = Maybe.Nothing()
        }

        return Promise.resolve(stringified.map(JSON.parse))
    }

    /**
     * Retrieves an object from cache.
     * @param {string} key The key to look up.
     */
    public getObject(key: string, opts: CacheGetOptions = {}): Promise<Maybe<object>> {
        Guard.assertArgDefined('key', key)
        key = opts.isGlobal ? key : this._realKey(key)
        const parseType = (opts.parseType != null) ? opts.parseType : true

        if (opts.forceRemote && this._hasEngine) {
            return this._fetchObject(key, parseType)
        }
        else if (this._localCache.hasOwnProperty(key)) {
            return Promise.resolve(Maybe.Just<any>(this._localCache[key]))
        }
        else if (this._hasEngine) {
            return this._fetchObject(key, parseType)
        }

        return Promise.resolve(Maybe.Nothing())
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
     * @param {PrimitiveType[] | object[] } arr Array of any type to save.
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
     * @param {object} value Object value to save.
     */
    public async setObject(key: string, value: object, opts: CacheSetOptions = {}): Promise<void> {
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


    private _connectSingle({ host, port }: CacheConnectionDetail): redis.RedisClient {
        return redis.createClient({ host, port })
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
        return (data == null) ? Maybe.Nothing() : Maybe.Just(data)
    }

    private async _fetchPrimitive(key: string, parseType: boolean): Promise<Maybe<any>> {
        const response = await this._engine.getAsync(key)
        const data = (parseType ? this._parsePrimitiveType(response) : response)
        return (data == null) ? Maybe.Nothing() : Maybe.Just(data)
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
            if (this._options.cluster) {
                // Redis-clusr can handle bi-directional commands.
                sub = this._engineSub = this._engine
            } else {
                sub = this._engineSub = this._connectSingle(this._options.single)
            }

            // TODO: This config should be in Redis conf
            await this._engine.config('SET', 'notify-keyspace-events', 'KEA')
            sub.on('message', async (channel, action) => {
                const affectedKey = this._extractKey(channel)

                await this._lockKey(key)

                switch (action) {
                    case 'set':
                        (await this._fetchPrimitive(affectedKey, true))
                            .map(val => this._localCache[affectedKey] = val)
                        break
                    case 'hset':
                        (await this._fetchObject(affectedKey, true))
                            .map(val => this._localCache[affectedKey] = val)
                        break
                    case 'del':
                        this._deleteLocal(affectedKey)
                        break
                    default:
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
        const FN = ['del', 'hmset', 'hgetall', 'get', 'set',
            'config', 'quit', 'subscribe', 'unsubscribe', 'scan']
        for (const fn of FN) {
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
