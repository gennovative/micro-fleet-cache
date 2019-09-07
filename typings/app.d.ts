/// <reference path="./global.d.ts" />
declare module '@micro-fleet/cache/dist/app/ICacheProvider' {
    import { Maybe, PrimitiveType } from '@micro-fleet/common';
    export type CacheConnectionDetail = {
        /**
             * Address of remote cache service.
             */
        host?: string;
        /**
         * Port of remote cache service.
         */
        port?: number;
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
         * Caches in remote service and keeps sync with local memory.
         */
        BOTH = 3
    }
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
    export type CacheDelOptions = {
        /**
         * If true, the key is not prepended with service slug, so we can
         * get value set by other CacheProvider instances in other services.
         *
         * Default is `false`.
         */
        isGlobal?: boolean;
        /**
         * If false, the exact key is matched to delete single record.
         *
         * If true, the key is a pattern to delete multiple records,
         * NOTE that in this case option `isGlobal` is ignored.
         * You have to deal with the prepended service slug YOURSELF.
         *
         * Default is `false`.
         */
        isPattern?: boolean;
    };
    /**
     * Provides methods to read and write data to cache.
     */
    export interface ICacheProvider {
        /**
         * Clears all local cache and disconnects from remote cache service.
         */
        dispose(): Promise<void>;
        /**
         * Removes a key from cache.
         */
        delete(key: string, opts?: CacheDelOptions): Promise<void>;
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
        getObject(key: string, opts?: CacheGetOptions): Promise<Maybe<object>>;
        /**
         * Saves a string or number or boolean to cache.
         * @param {string} key The key for later look up.
         * @param {Primitive} value Primitive value to save.
         */
        setPrimitive(key: string, value: PrimitiveType, opts?: CacheSetOptions): Promise<void>;
        /**
         * Saves an array to cache.
         * @param {string} key The key for later look up.
         * @param {PrimitiveType[] | object[] } arr Array of any type to save.
         */
        setArray(key: string, arr: any[], opts?: CacheSetOptions): Promise<void>;
        /**
         * Saves an object to cache.
         * @param {string} key The key for later look up.
         * @param {object} value Object value to save.
         */
        setObject(key: string, value: object, opts?: CacheSetOptions): Promise<void>;
    }

}
declare module '@micro-fleet/cache/dist/app/RedisCacheProvider' {
    import { Maybe, PrimitiveType } from '@micro-fleet/common';
    import { ICacheProvider, CacheGetOptions, CacheSetOptions, CacheConnectionDetail, CacheDelOptions } from '@micro-fleet/cache/dist/app/ICacheProvider';
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
    export class RedisCacheProvider implements ICacheProvider {
                                                        /**
         * Stores setTimeout token of each key.
         */
                constructor(_options?: CacheProviderConstructorOpts);
                /**
         * Clears all local cache and disconnects from remote cache service.
         */
        dispose(): Promise<void>;
        /**
         * Removes an exact key or multiple matched keys from cache.
         */
        delete(key: string, opts?: CacheDelOptions): Promise<void>;
                        /**
         * @see https://redis.io/commands/scan
         */
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
        getObject(key: string, opts?: CacheGetOptions): Promise<Maybe<object>>;
        /**
         * Saves a string or number or boolean to cache.
         * @param {string} key The key for later look up.
         * @param {Primitive} value Primitive value to save.
         */
        setPrimitive(key: string, value: PrimitiveType, opts?: CacheSetOptions): Promise<void>;
        /**
         * Saves an array to cache.
         * @param {string} key The key for later look up.
         * @param {PrimitiveType[] | object[] } arr Array of any type to save.
         */
        setArray(key: string, arr: any[], opts?: CacheSetOptions): Promise<void>;
        /**
         * Saves an object to cache.
         * @param {string} key The key for later look up.
         * @param {object} value Object value to save.
         */
        setObject(key: string, value: object, opts?: CacheSetOptions): Promise<void>;
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
    import { IDependencyContainer, IConfigurationProvider, IServiceAddOn } from '@micro-fleet/common';
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
declare module '@micro-fleet/cache/dist/app/CacheSettings' {
    import { SettingItem } from '@micro-fleet/common';
    import { CacheConnectionDetail } from '@micro-fleet/cache/dist/app/ICacheProvider';
    /**
     * Represents an array of cache settings.
     */
    export class CacheSettings extends Array<SettingItem> {
                constructor();
        /**
         * Gets number of connection settings.
         */
        readonly total: number;
        /**
         * Parses then adds a server detail to setting item array.
         */
        pushServer(detail: CacheConnectionDetail): void;
    }

}
declare module '@micro-fleet/cache/dist/app/cacheable' {
    import { CacheLevel } from '@micro-fleet/cache';
    import { PrimitiveType } from '@micro-fleet/common';
    export type CacheDecoratorOptions = {
        /**
         * The key to identify cached value and to fetch it later.
         */
        cacheKey: string;
        /**
         * Whether to save in local cache only, or remote only, or both.
         * If both, then local cache is kept in sync with remote value even when
         * this value is updated in remote service by another app process.
         *
         * Default: CacheLevel.REMOTE
         */
        cacheLevel?: CacheLevel;
        /**
         * Expiration time in seconds.
         *
         * Default: never expire.
         */
        duration?: number;
        /**
         * If true, the key is not prepended with service slug, and is accessible
         * by other CacheProvider instances from other services.
         * Default is `false`.
         */
        isGlobal?: boolean;
        /**
         * Skips local cache and fetch from remote server.
         * Default is `true`.
         */
        forceRemote?: boolean;
        /**
         * A function that produces a final cache key.
         *
         * As default, the final cache key is: `${cacheKey}:${serializedArgs}`
         */
        cacheKeyBuilder?: (cacheKey: string, serializedArgs: string) => string;
        /**
         * A function that accepts an array of the arguments of target function,
         * and produces a string to pass to `cacheKeyBuilder`.
         */
        argsSerializer?: (args: any[]) => string;
        /**
         * A function that accepts the return value of target function,
         * and produces a JSON object or a string to store in cache.
         */
        resultSerializer?: (toCache: any) => string | object;
        /**
         * A function that accepts the value retrieved from cache,
         * and rebuilds it to match the return type of target function.
         */
        resultRebuilder?: (fromCache: any) => any;
    };
    export interface CacheDecorator {
        (cacheKey: string): Function;
        (options: CacheDecoratorOptions): Function;
    }
    /**
     * Used to add filter to controller class and controller action.
     * @param {class} FilterClass Filter class whose name must end with "Filter".
     * @param {FilterPriority} priority Filters with greater priority run before ones with less priority.
     */
    export const cacheable: CacheDecorator;
    export function cacheKeyBuilder(cacheKey: string, serializedArgs: string): string;
    export function argsSerializer(args: any[]): string;
    export function resultSerializer(toCache: any): string | PrimitiveType[] | object;
    export function resultRebuilder(fromCache: any): any;

}
declare module '@micro-fleet/cache/dist/app/register-addon' {
    import { CacheAddOn } from '@micro-fleet/cache/dist/app/CacheAddOn';
    export function registerCacheAddOn(): CacheAddOn;

}
declare module '@micro-fleet/cache' {
    export * from '@micro-fleet/cache/dist/app/cacheable';
    export * from '@micro-fleet/cache/dist/app/CacheAddOn';
    export * from '@micro-fleet/cache/dist/app/RedisCacheProvider';
    export * from '@micro-fleet/cache/dist/app/CacheSettings';
    export * from '@micro-fleet/cache/dist/app/ICacheProvider';
    export * from '@micro-fleet/cache/dist/app/Types';
    export * from '@micro-fleet/cache/dist/app/register-addon';

}
