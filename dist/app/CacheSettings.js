"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@micro-fleet/common");
const { Cache: C } = common_1.constants;
/**
 * Represents an array of cache settings.
 */
class CacheSettings extends Array {
    constructor() {
        super();
        this._numSetting = common_1.SettingItem.from({
            name: C.CACHE_NUM_CONN,
            dataType: common_1.SettingItemDataType.Number,
            value: '0',
        });
        this.push(this._numSetting);
    }
    /**
     * Gets number of connection settings.
     */
    get total() {
        return parseInt(this._numSetting.value);
    }
    /**
     * Parses then adds a server detail to setting item array.
     */
    pushServer(detail) {
        const newIdx = parseInt(this._numSetting.value);
        this.push(common_1.SettingItem.from({
            name: C.CACHE_HOST + newIdx,
            dataType: common_1.SettingItemDataType.String,
            value: detail.host,
        }));
        this.push(common_1.SettingItem.from({
            name: C.CACHE_PORT + newIdx,
            dataType: common_1.SettingItemDataType.Number,
            value: detail.port + '',
        }));
        const setting = this._numSetting;
        setting.value = (newIdx + 1) + '';
    }
}
exports.CacheSettings = CacheSettings;
//# sourceMappingURL=CacheSettings.js.map