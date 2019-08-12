/// <reference types="debug" />
const debug: debug.IDebugger = require('debug')('mcft:cache:cacheable')

import { Types as cT, ICacheProvider, CacheSetOptions, CacheLevel } from '@micro-fleet/cache'
import { Maybe, serviceContext, MinorException, PagedData, PrimitiveType, ISerializable } from '@micro-fleet/common'


export type CacheDecoratorOptions = {
    /**
     * The key to identify cached value and to fetch it later.
     */
    cacheKey: string,

    /**
     * Whether to save in local cache only, or remote only, or both.
     * If both, then local cache is kept in sync with remote value even when
     * this value is updated in remote service by another app process.
     *
     * Default: CacheLevel.REMOTE
     */
    cacheLevel?: CacheLevel,

    /**
     * Expiration time in seconds.
     *
     * Default: never expire.
     */
    duration?: number,

    /**
     * If true, the key is not prepended with service slug, and is accessible
     * by other CacheProvider instances from other services.
     * Default is `false`.
     */
    isGlobal?: boolean,

    /**
     * Skips local cache and fetch from remote server.
     * Default is `true`.
     */
    forceRemote?: boolean,

    /**
     * A function that produces a final cache key.
     *
     * As default, the final cache key is: `${cacheKey}:${serializedArgs}`
     */
    cacheKeyBuilder?: (cacheKey: string, serializedArgs: string) => string,

    /**
     * A function that accepts an array of the arguments of target function,
     * and produces a string to pass to `cacheKeyBuilder`.
     */
    argsSerializer?: (args: any[]) => string,

    /**
     * A function that accepts the return value of target function,
     * and produces a JSON object or a string to store in cache.
     */
    resultSerializer?: (toCache: any) => string | object,

    /**
     * A function that accepts the value retrieved from cache,
     * and rebuilds it to match the return type of target function.
     */
    resultRebuilder?: (fromCache: any) => any,
}

export interface CacheDecorator {
    (cacheKey: string): Function
    // tslint:disable-next-line: unified-signatures
    (options: CacheDecoratorOptions): Function
}

/**
 * Used to add filter to controller class and controller action.
 * @param {class} FilterClass Filter class whose name must end with "Filter".
 * @param {FilterPriority} priority Filters with greater priority run before ones with less priority.
 */
export const cacheable: CacheDecorator = function(keyOrOptions: string | CacheDecoratorOptions): Function {
    return function (proto: any, fnName: string, propDesc: PropertyDescriptor): PropertyDescriptor {
        // proto === TargetClass.prototype
        // fnName === "targetMethodName"
        // propDesc === Object.getOwnPropertyDescriptor(TargetClass.prototype, "targetMethodName")
        keyOrOptions = (typeof keyOrOptions === 'object')
            ? keyOrOptions
            : { cacheKey: keyOrOptions }

        const opts: CacheDecoratorOptions = Object.assign(<CacheDecoratorOptions>{
            cacheKeyBuilder,
            cacheLevel: CacheLevel.REMOTE,
            isGlobal: false,
            argsSerializer,
            resultSerializer,
            resultRebuilder,
        }, keyOrOptions)
        const originalFn = propDesc.value

        propDesc.value = async function (...args: any[]) {
            const container = serviceContext.dependencyContainer
            const cacheProd = container.resolve<ICacheProvider>(cT.CACHE_PROVIDER)

            // Convert list of arguments to string
            const serializedArgs = opts.argsSerializer(args)
            const cacheKey = cacheKeyBuilder(opts.cacheKey, serializedArgs)
            const maybe = (await cacheProd.getObject(cacheKey, {
                    isGlobal: opts.isGlobal,
                    parseType: false,
                }))
                .map(opts.resultRebuilder)

            if (maybe.isJust) {
                debug('From cache')
                return maybe.value
            }

            // Invoke original function and get its return value
            const result = originalFn.apply(this, args)
            if (!isPromise(result)) {
                throw new MinorException('Decorator @cache only supports async methods')
            }

            try {
                // convert result to string
                const toCache = opts.resultSerializer(await result)
                const setOpts: CacheSetOptions = {
                    isGlobal: opts.isGlobal,
                    level: opts.cacheLevel,
                    duration: opts.duration,
                }
                if (Array.isArray(toCache)) {
                    await cacheProd.setArray(cacheKey, toCache as PrimitiveType[], setOpts)
                }
                else if (typeof toCache === 'object') {
                    await cacheProd.setObject(cacheKey, toCache, setOpts)
                }
                else {
                    await cacheProd.setPrimitive(cacheKey, toCache, setOpts)
                }
            }
            catch {
                return result
            }

            debug('From original invocation')
            // Return the result of invoking the method
            return result
        }
        return propDesc
    }
}

export function cacheKeyBuilder(cacheKey: string, serializedArgs: string): string {
    return `${cacheKey}:${serializedArgs}`
}

export function argsSerializer(args: any[]): string {
    return args
        .map(arg => Object.entries(arg)
            .map(([prop, val]) => [prop, removeNestedQuote(serialize(val))].join(':'))
            .join(':')
        )
        .join(':')
        // return args.map(a => serialize(a)).join()
}

type CachedObj = {
    type: string,
    value: string,
}

export function resultSerializer(toCache: any): string | PrimitiveType[] | object {
    if (isPagedData(toCache)) {
        // Don't check with "instanceOf" because we are not sure this is "PagedData"
        // from @micro-fleet/common or @micro-fleet/common-browser.
        return {
            'type': '@cache__PagedData',
            'value': `${toCache.total}__${JSON.stringify(toCache.items.map(resultSerializer))}`,
        } as object
        // Example paged array: { total: 10, data: [1,2,3,4,5]}
        // Expected value: `10__1,2,3,4,5`
    }
    else if (Array.isArray(toCache)) {
        return {
            'type': '@cache__Array',
            'value': JSON.stringify(toCache.map(resultSerializer)),
        } as object
    }
    else if (Maybe.isMaybe(toCache)) {
        return {
            'type': '@cache__Maybe',
            'value': toCache.isJust
                ? JSON.stringify(resultSerializer(toCache.value))
                : '__Maybe.Nothing__',
        } as object
    } else if (typeof toCache === 'object') {
        return {
            'type': '@cache__object',
            'value': serialize(toCache),
        } as object
    }
    else {
        return {
            'type': '@cache__other',
            'value': JSON.stringify(toCache),
        } as object
    }
}

export function resultRebuilder(fromCache: any): any {
    if (!isInternalObj(fromCache)) {
        return fromCache
    }

    switch (fromCache.type) {
        case '@cache__PagedData':
            // Expected value: `10__1,2,3,4,5`
            const delimiterPos = fromCache.value.indexOf('__')
            const total = parseInt(
                fromCache.value.substr(
                    0,
                    delimiterPos + 1,
                )
            )
            const dataStr = fromCache.value.substr(delimiterPos + 2)
            const pagedArr = new PagedData(
                (JSON.parse(dataStr) as any[]).map(resultRebuilder),
                total,
            )
            return pagedArr

        case '@cache__Array':
            return (JSON.parse(fromCache.value) as any[]).map(resultRebuilder)

        case '@cache__Maybe':
            if (fromCache.value === '__Maybe.Nothing__') {
                return Maybe.Nothing()
            }
            return Maybe.Just(resultRebuilder(JSON.parse(fromCache.value)))

        default: // '@cache__object' || '@cache__other'
            return resultRebuilder(JSON.parse(fromCache.value))
    }
}


/**
 * Checks if target is a Promise, either is native or Bluebird or other libraries.
 */
function isPromise(target: any): target is Promise<any> {
    return (typeof target.then === 'function') && (typeof target.catch === 'function')
}

function isInternalObj(target: any): target is CachedObj {
    return (typeof target.type === 'string') && target.type.startsWith('@cache__')
}

function isPagedData(target: object): target is PagedData<any> {
    return (target.constructor && target.constructor.name === 'PagedData')
}

function removeNestedQuote(source: string): string {
    return (typeof source === 'string')
        ? source.replace(/"/g, '')
        : source
}


/**
 * Checks if the object implements interface `ISerializable`
 */
function isSerializable(target: object): target is ISerializable {
    return (target && typeof target['toJSON'] === 'function')
}

/**
 * Converts object to string
 */
function serialize(target: any) {
    return isSerializable(target)
        ? JSON.stringify(target.toJSON())
        : JSON.stringify(target)
}
