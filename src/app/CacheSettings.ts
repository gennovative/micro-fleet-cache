import { SettingItem, SettingItemDataType, constants } from '@micro-fleet/common'
import { CacheConnectionDetail } from './ICacheProvider'

const { CacheSettingKeys: S } = constants

/**
 * Represents an array of cache settings.
 */
export class CacheSettings
    extends Array<SettingItem> {

    private _numSetting: SettingItem

    constructor() {
        super()
        this._numSetting = SettingItem.translator.whole({
            name: S.CACHE_NUM_CONN,
            dataType: SettingItemDataType.Number,
            value: '0',
        }) as SettingItem

        this.push(this._numSetting)
    }


    /**
     * Gets number of connection settings.
     */
    public get total(): number {
        return parseInt(this._numSetting.value)
    }

    /**
     * Parses then adds a server detail to setting item array.
     */
    public pushServer(detail: CacheConnectionDetail) {
        const newIdx = parseInt(this._numSetting.value)

        this.push(SettingItem.translator.whole({
                name: S.CACHE_HOST + newIdx,
                dataType: SettingItemDataType.String,
                value: detail.host,
            }) as SettingItem)
        this.push(SettingItem.translator.whole({
                name: S.CACHE_PORT + newIdx,
                dataType: SettingItemDataType.Number,
                value: detail.port + '',
            }) as SettingItem)

        const setting: any = this._numSetting
        setting.value = (newIdx + 1) + ''
    }
}
