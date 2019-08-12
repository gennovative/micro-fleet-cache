import * as chai from 'chai'
import * as spies from 'chai-spies'
import { DependencyContainer, IConfigurationProvider, Maybe,
    constants } from '@micro-fleet/common'

import { CacheAddOn, RedisCacheProvider, Types as T } from '../app'


chai.use(spies)
const expect = chai.expect
const { CacheSettingKeys: C, SvcSettingKeys: SvS } = constants

enum Mode {
    NoServiceSlug = 'noSlug',
    LocalCache = 'local',
    Single = 'single',
    Cluster = 'cluster',
    ZeroConnection = 'zeroConn',
}

class MockConfigAddOn implements IConfigurationProvider {
    public readonly name: string = 'MockConfigAddOn'
    public configFilePath: string

    constructor(private _mode: Mode) {

    }

    get enableRemote(): boolean {
        return true
    }

    public get(key: string): Maybe<number | boolean | string | any[]> {
        if (this._mode === Mode.LocalCache) {
            switch (key) {
                case C.CACHE_NUM_CONN: return Maybe.Just(0)
                case SvS.SERVICE_SLUG: return Maybe.Just('TestCacheSvc')
                default: return Maybe.Nothing()
            }
        }
        else if (this._mode === Mode.ZeroConnection) {
            switch (key) {
                // Number of connection = 0
                // This case happens during development when a developer's machine doesn't have Redis.
                // Set NUM_CONN=0 is a quick workaround.
                case C.CACHE_NUM_CONN: return Maybe.Just(0)
                case C.CACHE_HOST: return Maybe.Just('localhost') // Will be ignored
                case C.CACHE_PORT: return Maybe.Just(6379) // Will be ignored
                case SvS.SERVICE_SLUG: return Maybe.Just('TestCacheSvc') // Will be ignored
            }
        }
        else if (this._mode === Mode.Single) {
            switch (key) {
                case C.CACHE_NUM_CONN: return Maybe.Just(1)
                case C.CACHE_HOST: return Maybe.Just('localhost')
                case C.CACHE_PORT: return Maybe.Just(6379)
                case SvS.SERVICE_SLUG: return Maybe.Just('TestCacheSvc')
            }
        }
        else if (this._mode === Mode.Cluster) {
            switch (key) {
                case C.CACHE_NUM_CONN: return Maybe.Just(2)
                case C.CACHE_HOST: return Maybe.Just(['127.0.0.1'])
                case C.CACHE_PORT: return Maybe.Just([6379, 6380])
                case SvS.SERVICE_SLUG: return Maybe.Just('TestCacheSvc')
            }
        }
        return Maybe.Nothing()
    }

    public deadLetter(): Promise<void> {
        return Promise.resolve()
    }

    public fetch(): Promise<boolean> {
        return Promise.resolve(true)
    }

    public init(): Promise<void> {
        return Promise.resolve()
    }

    public dispose(): Promise<void> {
        return Promise.resolve()
    }

    public onUpdate(listener: (delta: string[]) => void) {
        // Empty
    }
}


let depContainer: DependencyContainer

describe('CacheAddOn', function () {
    // this.timeout(60000)

    beforeEach(() => {
        depContainer = new DependencyContainer()
    })

    afterEach(() => {
        depContainer.dispose()
    })


    describe('init', () => {
        let cacheAddOn: CacheAddOn

        afterEach(() => {
            return cacheAddOn.dispose()
        })

        it('should reject init if no service slug is provided', async () => {
            // Arrange
            cacheAddOn = new CacheAddOn(new MockConfigAddOn(Mode.NoServiceSlug), depContainer)

            // Act
            let exception
            try {
                await cacheAddOn.init()
            }
            catch (err) {
                exception = err
            }

            // Assert
            expect(exception).to.exist
            expect(exception.message).to.equal('The setting SERVICE_SLUG is required')
            expect(cacheAddOn['_cacheProvider']).not.to.exist
        })

        it('should use local cache only if no server is provided', async () => {
            // Arrange
            cacheAddOn = new CacheAddOn(new MockConfigAddOn(Mode.LocalCache), depContainer)

            // Act
            await cacheAddOn.init()

            // Assert
            expect(cacheAddOn['_cacheProvider']).to.exist
            expect(cacheAddOn['_cacheProvider']['_engine']).not.to.exist
        })

        it('should use local cache only if connection count is zero', async () => {
            // Arrange
            cacheAddOn = new CacheAddOn(new MockConfigAddOn(Mode.ZeroConnection), depContainer)

            // Act
            await cacheAddOn.init()

            // Assert
            expect(cacheAddOn['_cacheProvider']).to.exist
            expect(cacheAddOn['_cacheProvider']['_engine']).not.to.exist
        })

        it('should connect to single server', async () => {
            // Arrange
            cacheAddOn = new CacheAddOn(new MockConfigAddOn(Mode.Single), depContainer)

            // Act
            await cacheAddOn.init()

            // Assert
            const cacheProvider = depContainer.resolve<RedisCacheProvider>(T.CACHE_PROVIDER)
            expect(cacheProvider['_options'].single).to.exist
            expect(cacheProvider['_options'].single.host).to.equal('localhost')
            expect(cacheProvider['_options'].single.port).to.equal(6379)
            expect(cacheProvider['_options'].cluster).not.to.exist
        })

        // it('should connect to cluster of servers', async () => {
        //     // Arrange
        //     cacheAddOn = new CacheAddOn(new MockConfigAddOn('cluster'), depContainer)

        //     // Act
        //     await cacheAddOn.init()

        //     // Assert
        //     const cacheProvider = depContainer.resolve<CacheProvider>(T.CACHE_PROVIDER)
        //     expect(cacheProvider['_options'].cluster).to.exist
        //     expect(cacheProvider['_options'].cluster.length).to.be.equal(2)
        //     expect(cacheProvider['_options'].single).not.to.exist
        // })
    }) // END describe 'init'


    describe('dispose', () => {
        it('should call cacheProvider.dispose', async () => {
            // Arrange
            const cacheAddOn = new CacheAddOn(new MockConfigAddOn(Mode.Single), depContainer)

            await cacheAddOn.init()
            const disconnectSpy = chai.spy.on(cacheAddOn['_cacheProvider'], 'dispose')

            // Act
            await cacheAddOn.dispose()

            // Assert
            expect(disconnectSpy).to.be.spy
            expect(disconnectSpy).to.have.been.called.once
        })
    }) // END describe 'dispose'


    describe('deadLetter', () => {
        it('should resolve (for now)', async () => {
            // Arrange
            const cacheAddOn = new CacheAddOn(new MockConfigAddOn(Mode.Single), depContainer)

            // Act
            await cacheAddOn.deadLetter()
        })
    }) // END describe 'deadLetter'
})
