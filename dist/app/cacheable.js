"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="debug" />
const debug = require('debug')('mcft:cache:cacheable');
const cache_1 = require("@micro-fleet/cache");
const common_1 = require("@micro-fleet/common");
/**
 * Used to add filter to controller class and controller action.
 * @param {class} FilterClass Filter class whose name must end with "Filter".
 * @param {FilterPriority} priority Filters with greater priority run before ones with less priority.
 */
exports.cacheable = function (keyOrOptions) {
    return function (proto, fnName, propDesc) {
        // proto === TargetClass.prototype
        // fnName === "targetMethodName"
        // propDesc === Object.getOwnPropertyDescriptor(TargetClass.prototype, "targetMethodName")
        keyOrOptions = (typeof keyOrOptions === 'object')
            ? keyOrOptions
            : { cacheKey: keyOrOptions };
        const opts = Object.assign({
            cacheKeyBuilder,
            cacheLevel: cache_1.CacheLevel.REMOTE,
            isGlobal: false,
            argsSerializer,
            resultSerializer,
            resultRebuilder,
        }, keyOrOptions);
        const originalFn = propDesc.value;
        propDesc.value = async function (...args) {
            const container = common_1.serviceContext.dependencyContainer;
            const cacheProd = container.resolve(cache_1.Types.CACHE_PROVIDER);
            // Convert list of arguments to string
            const serializedArgs = opts.argsSerializer(args);
            const cacheKey = cacheKeyBuilder(opts.cacheKey, serializedArgs);
            const maybe = (await cacheProd.getObject(cacheKey, {
                isGlobal: opts.isGlobal,
                parseType: false,
            }))
                .map(opts.resultRebuilder);
            if (maybe.isJust) {
                debug('From cache');
                return maybe.value;
            }
            // Invoke original function and get its return value
            const result = originalFn.apply(this, args);
            if (!isPromise(result)) {
                throw new common_1.MinorException('Decorator @cache only supports async methods');
            }
            try {
                // convert result to string
                const toCache = opts.resultSerializer(await result);
                const setOpts = {
                    isGlobal: opts.isGlobal,
                    level: opts.cacheLevel,
                    duration: opts.duration,
                };
                if (Array.isArray(toCache)) {
                    await cacheProd.setArray(cacheKey, toCache, setOpts);
                }
                else if (typeof toCache === 'object') {
                    await cacheProd.setObject(cacheKey, toCache, setOpts);
                }
                else {
                    await cacheProd.setPrimitive(cacheKey, toCache, setOpts);
                }
            }
            catch {
                return result;
            }
            debug('From original invocation');
            // Return the result of invoking the method
            return result;
        };
        return propDesc;
    };
};
function cacheKeyBuilder(cacheKey, serializedArgs) {
    return `${cacheKey}:${serializedArgs}`;
}
exports.cacheKeyBuilder = cacheKeyBuilder;
function argsSerializer(args) {
    return args
        .map(arg => Object.entries(arg)
        .map(([prop, val]) => [prop, removeNestedQuote(serialize(val))].join(':'))
        .join(':'))
        .join(':');
    // return args.map(a => serialize(a)).join()
}
exports.argsSerializer = argsSerializer;
function resultSerializer(toCache) {
    if (isPagedData(toCache)) {
        // Don't check with "instanceOf" because we are not sure this is "PagedData"
        // from @micro-fleet/common or @micro-fleet/common-browser.
        return {
            'type': '@cache__PagedData',
            'value': `${toCache.total}__${JSON.stringify(toCache.items.map(resultSerializer))}`,
        };
        // Example paged array: { total: 10, data: [1,2,3,4,5]}
        // Expected value: `10__1,2,3,4,5`
    }
    else if (Array.isArray(toCache)) {
        return {
            'type': '@cache__Array',
            'value': JSON.stringify(toCache.map(resultSerializer)),
        };
    }
    else if (common_1.Maybe.isMaybe(toCache)) {
        return {
            'type': '@cache__Maybe',
            'value': toCache.isJust
                ? JSON.stringify(resultSerializer(toCache.value))
                : '__Maybe.Nothing__',
        };
    }
    else if (typeof toCache === 'object') {
        return {
            'type': '@cache__object',
            'value': serialize(toCache),
        };
    }
    else {
        return {
            'type': '@cache__other',
            'value': JSON.stringify(toCache),
        };
    }
}
exports.resultSerializer = resultSerializer;
function resultRebuilder(fromCache) {
    if (!isInternalObj(fromCache)) {
        return fromCache;
    }
    switch (fromCache.type) {
        case '@cache__PagedData':
            // Expected value: `10__1,2,3,4,5`
            const delimiterPos = fromCache.value.indexOf('__');
            const total = parseInt(fromCache.value.substr(0, delimiterPos + 1));
            const dataStr = fromCache.value.substr(delimiterPos + 2);
            const pagedArr = new common_1.PagedData(JSON.parse(dataStr).map(resultRebuilder), total);
            return pagedArr;
        case '@cache__Array':
            return JSON.parse(fromCache.value).map(resultRebuilder);
        case '@cache__Maybe':
            if (fromCache.value === '__Maybe.Nothing__') {
                return common_1.Maybe.Nothing();
            }
            return common_1.Maybe.Just(resultRebuilder(JSON.parse(fromCache.value)));
        default: // '@cache__object' || '@cache__other'
            return resultRebuilder(JSON.parse(fromCache.value));
    }
}
exports.resultRebuilder = resultRebuilder;
/**
 * Checks if target is a Promise, either is native or Bluebird or other libraries.
 */
function isPromise(target) {
    return (typeof target.then === 'function') && (typeof target.catch === 'function');
}
function isInternalObj(target) {
    return (typeof target.type === 'string') && target.type.startsWith('@cache__');
}
function isPagedData(target) {
    return (target.constructor && target.constructor.name === 'PagedData');
}
function removeNestedQuote(source) {
    return (typeof source === 'string')
        ? source.replace(/"/g, '')
        : source;
}
/**
 * Checks if the object implements interface `ISerializable`
 */
function isSerializable(target) {
    return (target && typeof target['toJSON'] === 'function');
}
/**
 * Converts object to string
 */
function serialize(target) {
    return isSerializable(target)
        ? JSON.stringify(target.toJSON())
        : JSON.stringify(target);
}
//# sourceMappingURL=cacheable.js.map