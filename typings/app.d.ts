/// <reference path="./global.d.ts" />

declare module 'back-cache-provider/dist/app/CacheProvider' {
	export type Primitive = string | number | boolean;
	export type PrimitiveFlatJson = {
	    [x: string]: Primitive;
	};
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
	     * Cache in remote service and keeps sync with local memory.
	     */
	    BOTH = 3,
	}
	export type CacheProviderConstructorOpts = {
	    /**
	     * Credentials to connect to a single cache service.
	     */
	    single?: {
	        /**
	         * Address of remote cache service.
	         */
	        host?: string;
	        /**
	         * Port of remote cache service.
	         */
	        port?: number;
	        /**
	         * Password to login remote cache service.
	         */
	        password?: string;
	    };
	    /**
	     * Credentials to connect to a cluster of cache services.
	     * This option overrides `single`.
	     */
	    cluster?: {
	        /**
	         * Address of remote cache service.
	         */
	        host?: string;
	        /**
	         * Port of remote cache service.
	         */
	        port?: number;
	        /**
	         * Password to login remote cache service.
	         */
	        password?: string;
	    }[];
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
	    	    constructor(_options?: CacheProviderConstructorOpts);
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
	     * @param {boolean} parseType (Only takes effect when `forceRemote=true`) If true, try to parse value to nearest possible primitive data type.
	     * 		If false, always return string. Default is `true`. Set to `false` to save some performance.
	     */
	    getPrimitive(key: string, forceRemote?: boolean, parseType?: boolean): Promise<Primitive>;
	    /**
	     * Retrieves an array of strings or numbers or booleans from cache.
	     * @param {string} key The key to look up.
	     * @param {boolean} forceRemote Skip local cache and fetch from remote server. Default is `false`.
	     */
	    getArray(key: string, forceRemote?: boolean): Promise<Primitive[]>;
	    /**
	     * Retrieves an object from cache.
	     * @param {string} key The key to look up.
	     * @param {boolean} forceRemote Skip local cache and fetch from remote server. Default is `false`.
	     * @param {boolean} parseType (Only takes effect when `forceRemote=true`) If true, try to parse every property value to nearest possible primitive data type.
	     * 		If false, always return an object with string properties.
	     * 		Default is `true`. Set to `false` to save some performance.
	     */
	    getObject(key: string, forceRemote?: boolean, parseType?: boolean): Promise<PrimitiveFlatJson>;
	    /**
	     * Saves a string or number or boolean to cache.
	     * @param {string} key The key for later look up.
	     * @param {Primitive} value Primitive value to save.
	     * @param {number} duration Expiration time in seconds.
	     * @param {CacheLevel} level Whether to save in local cache only, or remote only, or both.
	     * 		If both, then local cache is kept in sync with remote value even when
	     * 		this value is updated in remote service from another app process.
	     */
	    setPrimitive(key: string, value: Primitive, duration?: number, level?: CacheLevel): Promise<void>;
	    /**
	     * Saves an array to cache.
	     * @param {string} key The key for later look up.
	     * @param {Primitive[]} arr Primitive array to save.
	     * @param {number} duration Expiration time in seconds.
	     * @param {CacheLevel} level Whether to save in local cache only, or remote only, or both.
	     * 		If both, then local cache is kept in sync with remote value even when
	     * 		this value is updated in remote service from another app process.
	     */
	    setArray(key: string, arr: any[], duration?: number, level?: CacheLevel): Promise<void>;
	    /**
	     * Saves an object to cache.
	     * @param {string} key The key for later look up.
	     * @param {PrimitiveFlatJson} value Object value to save.
	     * @param {number} duration Expiration time in seconds.
	     * @param {CacheLevel} level Whether to save in local cache only, or remote only, or both.
	     * 		If both, then local cache is kept in sync with remote value even when
	     * 		this value is updated in remote service from another app process.
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
declare module 'back-cache-provider/dist/app/Types' {
	export class Types {
	    static readonly CACHE_PROVIDER: string;
	}

}
declare module 'back-cache-provider' {
	import 'back-lib-common-util/dist/app/bluebirdify';
	export * from 'back-cache-provider/dist/app/CacheProvider';
	export * from 'back-cache-provider/dist/app/Types';

}
