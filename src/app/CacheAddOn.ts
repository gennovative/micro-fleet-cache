/// <reference types="debug" />
const debug: debug.IDebugger = require('debug')('mcft:cache:CacheAddOn')

import { Guard, IDependencyContainer, Types as CmT, Maybe, decorators as d,
    IConfigurationProvider, CriticalException, constants, IServiceAddOn} from '@micro-fleet/common'

import { RedisCacheProvider, CacheProviderConstructorOpts } from './RedisCacheProvider'
import { Types as T } from './Types'
import { CacheConnectionDetail } from './ICacheProvider'


const { Service: S, Cache: C } = constants
const DEFAULT_HOST = 'localhost'
const DEFAULT_PORT = 6379

@d.injectable()
export class CacheAddOn implements IServiceAddOn {
    public readonly name: string = 'CacheAddOn'

    private _cacheProvider: RedisCacheProvider

    constructor(
        @d.inject(CmT.CONFIG_PROVIDER) private _configProvider: IConfigurationProvider,
        @d.inject(CmT.DEPENDENCY_CONTAINER) private _depContainer: IDependencyContainer,
    ) {
        Guard.assertArgDefined('_configProvider', _configProvider)
        Guard.assertArgDefined('_depContainer', _depContainer)
    }

    /**
     * @see IServiceAddOn.init
     */
    public init(): Promise<void> {
        const slugMaybe = (this._configProvider.get(S.SERVICE_SLUG) as Maybe<string>)
        if (slugMaybe.isNothing) {
            return Promise.reject(new CriticalException('The setting SERVICE_SLUG is required'))
        }

        const nConnMaybe = (this._configProvider.get(C.CACHE_NUM_CONN) as Maybe<number>)
        if (nConnMaybe.isNothing) {
            return Promise.reject(new CriticalException('The setting CACHE_NUM_CONN is required'))
        }
        const opts = this._buildConnOptions(slugMaybe.value, nConnMaybe.value)
        this._cacheProvider = new RedisCacheProvider(opts)
        this._depContainer.bindConstant<RedisCacheProvider>(T.CACHE_PROVIDER, this._cacheProvider)
        return Promise.resolve()
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

    private _buildConnOptions(svcSlug: string, nConn: number): CacheProviderConstructorOpts {
        const opts: CacheProviderConstructorOpts = {
            name: svcSlug,
        }
        if (nConn === 0) { return opts }

        const hosts: string[] = this._getHosts(nConn)
        const ports: number[] = this._getPorts(nConn)
        const details: CacheConnectionDetail[] = []

        for (let i = 0; i < nConn; ++i) {
            details.push({
                host: hosts[i],
                port: ports[i],
            })
        }

        debug(`Cache with ${details.length} connections`)

        if (details.length > 1) {
            opts.cluster = details
        }
        else {
            opts.single = details[0]
        }
        return opts
    }

    private _getHosts(nConn: number): string[] {
        const address = this._configProvider.get(C.CACHE_HOST).tryGetValue(DEFAULT_HOST)
        // If number of connection is greater than number of given host addresses,
        // we use default address for the rest.
        if (Array.isArray(address) && address.length != nConn) {
            return this._padArray(address, nConn, DEFAULT_HOST) as string[]
        }
        // If there is only one address as string, we use it for all connections
        return this._padArray([], nConn, address) as string[]
    }

    private _getPorts(nConn: number): number[] {
        const port = this._configProvider.get(C.CACHE_PORT).tryGetValue(DEFAULT_PORT)
        // If number of connection is greater than number of given ports,
        // we use default port for the rest.
        if (Array.isArray(port) && port.length != nConn) {
            return this._padArray(port, nConn, DEFAULT_PORT) as number[]
        }
        // If there is only one port as number, we use it for all connections
        return this._padArray([], nConn, port) as number[]
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
