"use strict";
// import { SettingItem, SettingItemDataType, constants } from '@micro-fleet/common'
// import { CacheConnectionDetail } from './ICacheProvider'
// const { Cache: C } = constants
// /**
//  * Represents an array of cache settings.
//  */
// export class CacheSettings
//     extends Array<SettingItem> {
//     private _numSetting: SettingItem
//     constructor() {
//         super()
//         this._numSetting = SettingItem.from({
//             name: C.CACHE_NUM_CONN,
//             dataType: SettingItemDataType.Number,
//             value: '0',
//         })
//         this.push(this._numSetting)
//     }
//     /**
//      * Gets number of connection settings.
//      */
//     public get total(): number {
//         return parseInt(this._numSetting.value)
//     }
//     /**
//      * Parses then adds a server detail to setting item array.
//      */
//     public pushServer(detail: CacheConnectionDetail) {
//         const newIdx = parseInt(this._numSetting.value)
//         this.push(SettingItem.from({
//                 name: C.CACHE_HOST + newIdx,
//                 dataType: SettingItemDataType.String,
//                 value: detail.host,
//             }))
//         this.push(SettingItem.from({
//                 name: C.CACHE_PORT + newIdx,
//                 dataType: SettingItemDataType.Number,
//                 value: detail.port + '',
//             }))
//         const setting: any = this._numSetting
//         setting.value = (newIdx + 1) + ''
//     }
// }
//# sourceMappingURL=CacheSettings.js.map