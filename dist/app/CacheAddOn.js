"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="debug" />
const debug = require('debug')('mcft:cache:CacheAddOn');
const common_1 = require("@micro-fleet/common");
const RedisCacheProvider_1 = require("./RedisCacheProvider");
const Types_1 = require("./Types");
const { Service: S, Cache: C } = common_1.constants;
const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 6379;
let CacheAddOn = class CacheAddOn {
    constructor(_configProvider, _depContainer) {
        this._configProvider = _configProvider;
        this._depContainer = _depContainer;
        this.name = 'CacheAddOn';
        common_1.Guard.assertArgDefined('_configProvider', _configProvider);
        common_1.Guard.assertArgDefined('_depContainer', _depContainer);
    }
    /**
     * @see IServiceAddOn.init
     */
    init() {
        const slugMaybe = this._configProvider.get(S.SERVICE_SLUG);
        if (slugMaybe.isNothing) {
            return Promise.reject(new common_1.CriticalException('The setting SERVICE_SLUG is required'));
        }
        const nConnMaybe = this._configProvider.get(C.CACHE_NUM_CONN);
        if (nConnMaybe.isNothing) {
            return Promise.reject(new common_1.CriticalException('The setting CACHE_NUM_CONN is required'));
        }
        const opts = this._buildConnOptions(slugMaybe.value, nConnMaybe.value);
        this._cacheProvider = new RedisCacheProvider_1.RedisCacheProvider(opts);
        this._depContainer.bindConstant(Types_1.Types.CACHE_PROVIDER, this._cacheProvider);
        return Promise.resolve();
    }
    /**
     * @see IServiceAddOn.deadLetter
     */
    deadLetter() {
        return Promise.resolve();
    }
    /**
     * @see IServiceAddOn.dispose
     */
    dispose() {
        return (this._cacheProvider) ? this._cacheProvider.dispose() : Promise.resolve();
    }
    _buildConnOptions(svcSlug, nConn) {
        const opts = {
            name: svcSlug,
        };
        if (nConn === 0) {
            return opts;
        }
        const hosts = this._getHosts(nConn);
        const ports = this._getPorts(nConn);
        const details = [];
        for (let i = 0; i < nConn; ++i) {
            details.push({
                host: hosts[i],
                port: ports[i],
            });
        }
        debug(`Cache with ${details.length} connections`);
        if (details.length > 1) {
            opts.cluster = details;
        }
        else {
            opts.single = details[0];
        }
        return opts;
    }
    _getHosts(nConn) {
        const address = this._configProvider.get(C.CACHE_HOST).tryGetValue(DEFAULT_HOST);
        // If number of connection is greater than number of given host addresses,
        // we use default address for the rest.
        if (Array.isArray(address) && address.length != nConn) {
            return this._padArray(address, nConn, DEFAULT_HOST);
        }
        // If there is only one address as string, we use it for all connections
        return this._padArray([], nConn, address);
    }
    _getPorts(nConn) {
        const port = this._configProvider.get(C.CACHE_PORT).tryGetValue(DEFAULT_PORT);
        // If number of connection is greater than number of given ports,
        // we use default port for the rest.
        if (Array.isArray(port) && port.length != nConn) {
            return this._padArray(port, nConn, DEFAULT_PORT);
        }
        // If there is only one port as number, we use it for all connections
        return this._padArray([], nConn, port);
    }
    /**
     * Keeps appending `value` to `arr` until the array reaches specified `newLength`.
     * Returns a new array instance.
     */
    _padArray(arr, newLength, value) {
        const newArr = [...arr];
        while (newArr.length < newLength) {
            newArr.push(value);
        }
        return newArr;
    }
};
CacheAddOn = __decorate([
    common_1.decorators.injectable(),
    __param(0, common_1.decorators.inject(common_1.Types.CONFIG_PROVIDER)),
    __param(1, common_1.decorators.inject(common_1.Types.DEPENDENCY_CONTAINER)),
    __metadata("design:paramtypes", [Object, Object])
], CacheAddOn);
exports.CacheAddOn = CacheAddOn;
//# sourceMappingURL=CacheAddOn.js.map