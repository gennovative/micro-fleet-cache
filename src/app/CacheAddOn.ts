/// <reference types="debug" />
const debug: debug.IDebugger = require('debug')('mcft:cache:CacheAddOn')


import { injectable, inject, Guard, IDependencyContainer, Types as CmT, Maybe,
    IConfigurationProvider, CriticalException, constants, IServiceAddOn} from '@micro-fleet/common'

import { RedisCacheProvider, CacheProviderConstructorOpts } from './RedisCacheProvider'
import { Types as T } from './Types'
import { CacheConnectionDetail } from './ICacheProvider'


const { SvcSettingKeys: S, CacheSettingKeys: C } = constants
const DEFAULT_HOST = 'localhost'
const DEFAULT_PORT = 6379

@injectable()
export class CacheAddOn implements IServiceAddOn {
    public readonly name: string = 'CacheAddOn'

    private _cacheProvider: RedisCacheProvider

    constructor(
        @inject(CmT.CONFIG_PROVIDER) private _configProvider: IConfigurationProvider,
        @inject(CmT.DEPENDENCY_CONTAINER) private _depContainer: IDependencyContainer,
    ) {
        Guard.assertArgDefined('_configProvider', _configProvider)
        Guard.assertArgDefined('_depContainer', _depContainer)
    }

    /**
     * @see IServiceAddOn.init
     */
    public init(): Promise<void> {
        return (this._configProvider.get(S.SERVICE_SLUG) as Maybe<string>)
            .chain(svcSlug => {
                return this._buildConnDetails()
                    .map<[string, CacheConnectionDetail[]]>(details => [svcSlug, details])
                    .mapElse(() => [svcSlug, null])
            })
            .map(([svcSlug, details]) => {
                const opts: CacheProviderConstructorOpts = {
                    name: svcSlug as string,
                }

                if (details && details.length > 1) {
                    opts.cluster = details
                }
                else if (details) {
                    opts.single = details[0]
                }

                return Promise.resolve(opts)
            })
            .mapElse(
                () => Promise.reject(new CriticalException('SERVICE_SLUG_REQUIRED'))
            )
            .value
            .then((opts) => {
                this._cacheProvider = new RedisCacheProvider(opts)
                this._depContainer.bindConstant<RedisCacheProvider>(T.CACHE_PROVIDER, this._cacheProvider)
            })
    }

    /**
     * @see IServiceAddOn.deadLetter
     */
    public deadLetter(): Promise<void> {
        return Promise.resolve()
    }

    /**
     * @see IServiceAddOn.dispose
     */
    public dispose(): Promise<void> {
        return (this._cacheProvider) ? this._cacheProvider.dispose() : Promise.resolve()
    }

    private _buildConnDetails(): Maybe<CacheConnectionDetail[]> {
        return (this._configProvider.get(C.CACHE_NUM_CONN) as Maybe<number>)
            .chain((nConn) => {
                const hosts: string[] = this._getHosts(nConn)
                const ports: number[] = this._getPorts(nConn)
                const details: CacheConnectionDetail[] = []

                for (let i = 0; i < nConn; ++i) {
                    details.push({
                        host: hosts[i],
                        port: ports[i],
                    })
                }

                if (details.length) {
                    debug(`Cache with ${details.length} connections`)
                    return Maybe.Just(details)
                }
                else {
                    debug('No cache connection')
                    return Maybe.Nothing()
                }
            })
    }

    private _getHosts(nConn: number): string[] {
        return this._configProvider.get(C.CACHE_HOST)
            .map((value) => {
                // If number of connection is greater than number of given host addresses,
                // we use default address for the rest.
                if (Array.isArray(value) && value.length != nConn) {
                    return this._padArray(value, nConn, DEFAULT_HOST) as string[]
                }
                // If there is only one address as string, we use it for all connections
                return this._padArray([], nConn, value) as string[]
            })
            .value
    }

    private _getPorts(nConn: number): number[] {
        return this._configProvider.get(C.CACHE_PORT)
            .map((value) => {
                // If number of connection is greater than number of given ports,
                // we use default port for the rest.
                if (Array.isArray(value) && value.length != nConn) {
                    return this._padArray(value, nConn, DEFAULT_PORT) as number[]
                }
                // If there is only one address as number, we use it for all connections
                return this._padArray([], nConn, value) as number[]
            })
            .value
    }

    /**
     * Keeps appending `value` to `arr` until the array reaches specified `newLength`.
     * Returns a new array instance.
     */
    private _padArray(arr: any[], newLength: number, value: any): any[] {
        const newArr = [...arr]
        while (newArr.length < newLength) {
            newArr.push(value)
        }
        return newArr
    }
}
