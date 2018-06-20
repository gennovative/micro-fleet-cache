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
const common_1 = require("@micro-fleet/common");
const CacheProvider_1 = require("./CacheProvider");
const Types_1 = require("./Types");
const { SvcSettingKeys: S, CacheSettingKeys: C } = common_1.constants;
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
        const svcSlug = this._configProvider.get(S.SERVICE_SLUG);
        if (!svcSlug.hasValue) {
            return Promise.reject(new common_1.CriticalException('SERVICE_SLUG_REQUIRED'));
        }
        const opts = {
            name: svcSlug.value
        };
        const result = this._buildConnDetails();
        if (result.hasValue) {
            const connDetails = result.value;
            if (connDetails.length == 1) {
                opts.single = connDetails[0];
            }
            else {
                opts.cluster = connDetails;
            }
        }
        this._cacheProvider = new CacheProvider_1.CacheProvider(opts);
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
    _buildConnDetails() {
        let provider = this._configProvider, nConn = provider.get(C.CACHE_NUM_CONN), details = [];
        if (!nConn.hasValue) {
            return new common_1.Maybe;
        }
        for (let i = 0; i < nConn.value; ++i) {
            const host = provider.get(C.CACHE_HOST + i);
            const port = provider.get(C.CACHE_PORT + i);
            if (!host.hasValue || !port.hasValue) {
                continue;
            }
            details.push({
                host: host.value,
                port: port.value
            });
        }
        return details.length ? new common_1.Maybe(details) : new common_1.Maybe;
    }
};
CacheAddOn = __decorate([
    common_1.injectable(),
    __param(0, common_1.inject(common_1.Types.CONFIG_PROVIDER)),
    __param(1, common_1.inject(common_1.Types.DEPENDENCY_CONTAINER)),
    __metadata("design:paramtypes", [Object, Object])
], CacheAddOn);
exports.CacheAddOn = CacheAddOn;
//# sourceMappingURL=CacheAddOn.js.map