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
	export type CacheSetOptions = {
	    /**
	     * Expiration time in seconds. Default is to never expire.
	     */
	    duration?: number;
	    /**
	     * Whether to save in local cache only, or remote only, or both.
	     * If both, then local cache is kept in sync with remote value even when
	     * this value is updated in remote service by another app process.
	     */
	    level?: CacheLevel;
	    /**
	     * If true, the key is not prepended with service slug, and is accessible
	     * by other CacheProvider instances from other services.
	     * Default is `false`.
	     */
	    isGlobal?: boolean;
	};
	export type CacheGetOptions = {
	    /**
	     * Skip local cache and fetch from remote server.
	     * Default is `false`.
	     */
	    forceRemote?: boolean;
	    /**
	     * (Only takes effect when `forceRemote=true`)
	     * If true, try to parse value to nearest possible primitive data type.
	     * If false, always return string. Default is `true`. Set to `false` to save some performance.
	     * Default is `true`.
	     */
	    parseType?: boolean;
	    /**
	     * If true, the key is not prepended with service slug, so we can
	     * get value set by other CacheProvider instances in other services.
	     * Default is `false`.
	     */
	    isGlobal?: boolean;
	};
	/**
	 * Provides methods to read and write data to cache.
	 */
	export class CacheProvider {
	    	    	    	    	    	    	    /**
	     * Stores setTimeout token of each key.
	     */
	    	    constructor(_options?: CacheProviderConstructorOpts);
	    	    /**
	     * Clears all local cache and disconnects from remote cache service.
	     */
	    dispose(): Promise<void>;
	    /**
	     * Removes a key from cache.
	     */
	    delete(key: string, isGlobal?: boolean): Promise<void>;
	    /**
	     * Retrieves a string or number or boolean from cache.
	     * @param {string} key The key to look up.
	     */
	    getPrimitive(key: string, opts?: CacheGetOptions): Promise<Maybe<PrimitiveType>>;
	    /**
	     * Retrieves an array of strings or numbers or booleans from cache.
	     * @param {string} key The key to look up.
	     * @param {boolean} forceRemote Skip local cache and fetch from remote server. Default is `false`.
	     */
	    getArray(key: string, opts?: CacheGetOptions): Promise<Maybe<PrimitiveType[]>>;
	    /**
	     * Retrieves an object from cache.
	     * @param {string} key The key to look up.
	     */
	    getObject(key: string, opts?: CacheGetOptions): Promise<Maybe<PrimitiveFlatJson>>;
	    /**
	     * Saves a string or number or boolean to cache.
	     * @param {string} key The key for later look up.
	     * @param {Primitive} value Primitive value to save.
	     */
	    setPrimitive(key: string, value: PrimitiveType, opts?: CacheSetOptions): Promise<void>;
	    /**
	     * Saves an array to cache.
	     * @param {string} key The key for later look up.
	     * @param {PrimitiveType[] | PrimitiveFlatJson[] } arr Array of any type to save.
	     */
	    setArray(key: string, arr: any[], opts?: CacheSetOptions): Promise<void>;
	    /**
	     * Saves an object to cache.
	     * @param {string} key The key for later look up.
	     * @param {PrimitiveFlatJson} value Object value to save.
	     */
	    setObject(key: string, value: PrimitiveFlatJson, opts?: CacheSetOptions): Promise<void>;
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
	    static readonly CACHE_PROVIDER = "cache.CacheProvider";
	    static readonly CACHE_ADDON = "cache.CacheAddOn";
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
	    	    	    	    /**
	     * Keeps appending `value` to `arr` until the array reaches specified `newLength`.
	     * Returns a new array instance.
	     */
	    	}

}
declare module '@micro-fleet/cache/dist/app/register-addon' {
	import { CacheAddOn } from '@micro-fleet/cache/dist/app/CacheAddOn';
	export function registerCacheAddOn(): CacheAddOn;

}
declare module '@micro-fleet/cache' {
	export * from '@micro-fleet/cache/dist/app/CacheAddOn';
	export * from '@micro-fleet/cache/dist/app/CacheProvider';
	export * from '@micro-fleet/cache/dist/app/Types';
	export * from '@micro-fleet/cache/dist/app/register-addon';

}
