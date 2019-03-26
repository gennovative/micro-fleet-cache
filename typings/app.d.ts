/// <reference path="./global.d.ts" />
declare module '@micro-fleet/cache/dist/app/CacheProvider' {
	import { CacheConnectionDetail, Maybe } from '@micro-fleet/common';
	export enum CacheLevel {
	    /**
	     * Only caches in local memory.
	     */
	    LOCAL = 1,
	    /**
	     * Only caches in remote service.
	     */
	    REMOTE = 2,
	    /**
	     * Caches in remote service and keeps sync with local memory.
	     */
	    BOTH = 3
	}
	export type CacheProviderConstructorOpts = {
	    /**
	     * Is prepended in cache key to avoid key collision between cache instances.
	     */
	    name: string;
	    /**
	     * Credentials to connect to a single cache service.
	     */
	    single?: CacheConnectionDetail;
	    /**
	     * Credentials to connect to a cluster of cache services.
	     * This option overrides `single`.
	     */
	    cluster?: CacheConnectionDetail[];
	};
	/**
	 * Provides methods to read and write data to cache.
	 */
	export class CacheProvider {
	    	    	    	    	    	    	    /**
	     * Stores cache type (primitive, object) of each key.
	     */
	    	    /**
	     * Stores setTimeout token of each key.
	     */
	    	    constructor(_options: CacheProviderConstructorOpts);
	    	    /**
	     * Clears all local cache and disconnects from remote cache service.
	     */
	    dispose(): Promise<void>;
	    /**
	     * Removes a key from cache.
	     */
	    delete(key: string): Promise<void>;
	    /**
	     * Retrieves a string or number or boolean from cache.
	     * @param {string} key The key to look up.
	     * @param {boolean} forceRemote Skip local cache and fetch from remote server. Default is `false`.
	     * @param {boolean} parseType (Only takes effect when `forceRemote=true`)
	     *      If true, try to parse value to nearest possible primitive data type.
	     *      If false, always return string. Default is `true`. Set to `false` to save some performance.
	     */
	    getPrimitive(key: string, forceRemote?: boolean, parseType?: boolean): Promise<Maybe<PrimitiveType>>;
	    /**
	     * Retrieves an array of strings or numbers or booleans from cache.
	     * @param {string} key The key to look up.
	     * @param {boolean} forceRemote Skip local cache and fetch from remote server. Default is `false`.
	     */
	    getArray(key: string, forceRemote?: boolean): Promise<Maybe<PrimitiveType[]>>;
	    /**
	     * Retrieves an object from cache.
	     * @param {string} key The key to look up.
	     * @param {boolean} forceRemote Skip local cache and fetch from remote server. Default is `false`.
	     * @param {boolean} parseType (Only takes effect when `forceRemote=true`)
	     *      If true, try to parse every property value to nearest possible primitive data type.
	     *      If false, always return an object with string properties.
	     *      Default is `true`. Set to `false` to save some performance.
	     */
	    getObject(key: string, forceRemote?: boolean, parseType?: boolean): Promise<Maybe<PrimitiveFlatJson>>;
	    /**
	     * Saves a string or number or boolean to cache.
	     * @param {string} key The key for later look up.
	     * @param {Primitive} value Primitive value to save.
	     * @param {number} duration Expiration time in seconds.
	     * @param {CacheLevel} level Whether to save in local cache only, or remote only, or both.
	     *         If both, then local cache is kept in sync with remote value even when
	     *         this value is updated in remote service by another app process.
	     */
	    setPrimitive(key: string, value: PrimitiveType, duration?: number, level?: CacheLevel): Promise<void>;
	    /**
	     * Saves an array to cache.
	     * @param {string} key The key for later look up.
	     * @param {PrimitiveType[] | PrimitiveFlatJson[] } arr Array of any type to save.
	     * @param {number} duration Expiration time in seconds.
	     * @param {CacheLevel} level Whether to save in local cache only, or remote only, or both.
	     *         If both, then local cache is kept in sync with remote value even when
	     *         this value is updated in remote service by another app process.
	     */
	    setArray(key: string, arr: any[], duration?: number, level?: CacheLevel): Promise<void>;
	    /**
	     * Saves an object to cache.
	     * @param {string} key The key for later look up.
	     * @param {PrimitiveFlatJson} value Object value to save.
	     * @param {number} duration Expiration time in seconds.
	     * @param {CacheLevel} level Whether to save in local cache only, or remote only, or both.
	     *         If both, then local cache is kept in sync with remote value even when
	     *         this value is updated in remote service by another app process.
	     */
	    setObject(key: string, value: PrimitiveFlatJson, duration?: number, level?: CacheLevel): Promise<void>;
	    	    	    	    	    	    	    	    /**
	     * Removes the last lock from lock queue then returns it.
	     */
	    	    /**
	     * Gets the first lock in queue.
	     */
	    	    /**
	     * Adds a new lock at the beginning of lock queue.
	     */
	    	    	    	    	    	    	    	    	    	    	    	}

}
declare module '@micro-fleet/cache/dist/app/Types' {
	export class Types {
	    static readonly CACHE_PROVIDER = "cache-provider.CacheProvider";
	    static readonly CACHE_ADDON = "cache-provider.CacheAddOn";
	}

}
declare module '@micro-fleet/cache/dist/app/CacheAddOn' {
	import { IDependencyContainer, IConfigurationProvider } from '@micro-fleet/common';
	export class CacheAddOn implements IServiceAddOn {
	    	    	    readonly name: string;
	    	    constructor(_configProvider: IConfigurationProvider, _depContainer: IDependencyContainer);
	    /**
	     * @see IServiceAddOn.init
	     */
	    init(): Promise<void>;
	    /**
	     * @see IServiceAddOn.deadLetter
	     */
	    deadLetter(): Promise<void>;
	    /**
	     * @see IServiceAddOn.dispose
	     */
	    dispose(): Promise<void>;
	    	}

}
declare module '@micro-fleet/cache' {
	export * from '@micro-fleet/cache/dist/app/CacheAddOn';
	export * from '@micro-fleet/cache/dist/app/CacheProvider';
	export * from '@micro-fleet/cache/dist/app/Types';

}
