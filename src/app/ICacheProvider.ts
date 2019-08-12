import { Maybe, PrimitiveType } from '@micro-fleet/common'


export type CacheConnectionDetail = {
    /**
         * Address of remote cache service.
         */
    host?: string;

    /**
     * Port of remote cache service.
     */
    port?: number;
}


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

export type CacheDelOptions = {
    /**
     * If true, the key is not prepended with service slug, so we can
     * get value set by other CacheProvider instances in other services.
     *
     * Default is `false`.
     */
    isGlobal?: boolean,

    /**
     * If false, the exact key is matched to delete single record.
     *
     * If true, the key is a pattern to delete multiple records,
     * NOTE that in this case option `isGlobal` is ignored.
     * You have to deal with the prepended service slug YOURSELF.
     *
     * Default is `false`.
     */
    isPattern?: boolean,
}

/**
 * Provides methods to read and write data to cache.
 */
export interface ICacheProvider {

    /**
     * Clears all local cache and disconnects from remote cache service.
     */
    dispose(): Promise<void>

    /**
     * Removes a key from cache.
     */
    delete(key: string, opts?: CacheDelOptions): Promise<void>

    /**
     * Retrieves a string or number or boolean from cache.
     * @param {string} key The key to look up.
     */
    getPrimitive(key: string, opts?: CacheGetOptions): Promise<Maybe<PrimitiveType>>

    /**
     * Retrieves an array of strings or numbers or booleans from cache.
     * @param {string} key The key to look up.
     * @param {boolean} forceRemote Skip local cache and fetch from remote server. Default is `false`.
     */
    getArray(key: string, opts?: CacheGetOptions): Promise<Maybe<PrimitiveType[]>>

    /**
     * Retrieves an object from cache.
     * @param {string} key The key to look up.
     */
    getObject(key: string, opts?: CacheGetOptions): Promise<Maybe<object>>

    /**
     * Saves a string or number or boolean to cache.
     * @param {string} key The key for later look up.
     * @param {Primitive} value Primitive value to save.
     */
    setPrimitive(key: string, value: PrimitiveType, opts?: CacheSetOptions): Promise<void>

    /**
     * Saves an array to cache.
     * @param {string} key The key for later look up.
     * @param {PrimitiveType[] | object[] } arr Array of any type to save.
     */
    setArray(key: string, arr: any[], opts?: CacheSetOptions): Promise<void>

    /**
     * Saves an object to cache.
     * @param {string} key The key for later look up.
     * @param {object} value Object value to save.
     */
    setObject(key: string, value: object, opts?: CacheSetOptions): Promise<void>
}
