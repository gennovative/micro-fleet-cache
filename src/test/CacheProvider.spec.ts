import { expect } from 'chai'
import * as redis from 'redis'
import { Maybe, InvalidArgumentException } from '@micro-fleet/common'

import { CacheProvider, CacheLevel } from '../app'


const FIRST_CACHE = 'firstcache',
    SECOND_CACHE = 'secondcache',
    LOCAL_CACHE = 'localcache',
    KEY = 'TESTKEY',
    NON_EXIST_KEY = 'BLANK'

let globalCache: CacheProvider

describe('CacheProvider (single)', function () {
    this.timeout(5000)
    // this.timeout(60000)

    beforeEach(() => {
        globalCache = new CacheProvider({
            name: FIRST_CACHE,
            single: {
                host: 'localhost',
            },
        })
    })

    afterEach(async () => {
        await globalCache.delete(KEY)
        await globalCache.dispose()
        globalCache = null
    })

    describe('constructor', () => {
        it('should use local cache only if no option is provided', () => {
            // Act
            const cache = new CacheProvider()

            // Assert
            expect(cache['_localCache']).to.exist
            expect(cache['_engine']).not.to.exist
        })
    }) // describe 'constructor'

    describe('setPrimitive', () => {
        it('Should not allow null or undefined value', async () => {
            // Arrange
            const value: any = null
            let exception: any

            // Act
            try {
                await globalCache.setPrimitive(KEY, value)
            } catch (err) {
                exception = err
            }

            // Assert
            expect(exception).to.be.instanceOf(InvalidArgumentException)
            expect(globalCache['_localCache'][`${FIRST_CACHE}::${KEY}`]).not.to.exist
        })

        it('Should save a value locally only', async () => {
            // Arrange
            const valueOne = 'saved locally',
                valueTwo = 'saved remotely'
            const client = redis.createClient({
                host: 'localhost',
            })

            // Act
            await client['setAsync'](`${FIRST_CACHE}::${KEY}`, valueTwo)
            await globalCache.setPrimitive(KEY, valueOne, { level: CacheLevel.LOCAL })

            // Assert: Local value is different than remote value
            expect(globalCache['_localCache'][`${FIRST_CACHE}::${KEY}`]).to.equal(valueOne)

            const remote = await globalCache.getPrimitive(KEY, { forceRemote: true }) as Maybe<string> // Skip local cache
            expect(remote.isJust).to.be.true
            expect(remote.value).to.equal(valueTwo)

            // Clean up
            client.quit()
        })

        it('Should default to save a value locally only if no cache service is provided', async () => {
            // Arrange
            const cache = new CacheProvider({
                    name: LOCAL_CACHE,
                    /* No remote service */
                })
            const value = 'saved locally'

            // Act
            await cache.setPrimitive(KEY, value)

            // Assert: Local value is different than remote value
            expect(cache['_localCache'][`${LOCAL_CACHE}::${KEY}`]).to.equal(value)
        })

        it('Should save a value remote only', async () => {
            // Arrange
            const value = 'saved remotely'

            // Act
            await globalCache.setPrimitive(KEY, value, { level: CacheLevel.REMOTE })

            // Assert: Local value does not exist
            expect(globalCache['_localCache'][`${FIRST_CACHE}::${KEY}`]).not.to.exist
            expect(globalCache['_cacheExps'][`${FIRST_CACHE}::${KEY}`]).not.to.exist

            // Assert: Remote value exists
            const refetch = await globalCache.getPrimitive(KEY, { forceRemote: true }) as Maybe<string> // Skip local cache
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.equal(value)
        })

        it('Should save a value both remotely and locally', async () => {
            // Arrange
            const value = 'I am everywhere'

            // Act
            await globalCache.setPrimitive(KEY, value, { level: CacheLevel.BOTH })

            // Assert: Remote and local values are the same
            const remote = await globalCache.getPrimitive(KEY, { forceRemote: true }) as Maybe<string>, // Skip local cache
                local = globalCache['_localCache'][`${FIRST_CACHE}::${KEY}`]
            expect(remote.isJust).to.be.true
            expect(remote.value).to.equal(local)
        })

        it('Should save a value then expire locally', (done) => {
            // Arrange
            const value = 'a local string',
                SECONDS = 1

            // Act
            globalCache.setPrimitive(KEY, value, { duration: SECONDS, level: CacheLevel.LOCAL })
                .then(() => {
                    setTimeout(async () => {
                        // Assert
                        const refetch = await globalCache.getPrimitive(KEY, { forceRemote: false }) as Maybe<string>
                        if (refetch) {
                            console.log('Refetch:', refetch)
                        }
                        expect(refetch.isJust).to.be.false
                        done()
                    }, 1100) // Wait until key expires
                })

        })

        it('Should save a value then expire remotely', (done) => {
            // Arrange
            const value = 'a local string',
                SECONDS = 1

            // Act
            globalCache.setPrimitive(KEY, value, { duration: SECONDS, level: CacheLevel.REMOTE })
                .then(() => {
                    setTimeout(async () => {
                        // Assert
                        const refetch = await globalCache.getPrimitive(KEY, { forceRemote: true }) as Maybe<string>
                        if (refetch) {
                            console.log('Refetch:', refetch)
                        }
                        expect(refetch.isJust).to.be.false
                        done()
                    }, 1100) // Wait until key expires
                })

        })

        it('Should save a value then expire both locally and remotely', (done) => {
            // Arrange
            const value = 'a local string',
                SECONDS = 1

            // Act
            globalCache.setPrimitive(KEY, value, { duration: SECONDS, level: CacheLevel.BOTH })
                .then(() => {
                    setTimeout(async () => {
                        // Assert
                        const remote = await globalCache.getPrimitive(KEY, { forceRemote: true }) as Maybe<string>,
                            local = globalCache['_localCache'][`${FIRST_CACHE}::${KEY}`]

                        remote.isJust && console.log('Remote:', remote.value)
                        local && console.log('Local:', local)

                        expect(remote.isJust).to.be.false
                        expect(local).not.to.exist
                        done()
                    }, 1100) // Wait until key expires
                })

        })

        it('Should save a value then keep sync', (done) => {
            // Arrange
            const KEY_TWO = 'SECKEY'
            const valueOne = 'a test string',
                valueOneNew = 'another string',
                valueTwo = 'the second string',
                valueTwoNew = 'the new second string',
                client = redis.createClient({
                    host: 'localhost',
                })

            // Act
            globalCache.setPrimitive(KEY, valueOne, { duration: 0, level: CacheLevel.BOTH })
                .then(() => {
                    return globalCache.setPrimitive(KEY_TWO, valueTwo, { duration: 0, level: CacheLevel.BOTH })
                })
                .then(async () => {
                    await Promise.all([
                        client['setAsync'](`${FIRST_CACHE}::${KEY}`, valueOneNew),
                        client['setAsync'](`${FIRST_CACHE}::${KEY_TWO}`, valueTwoNew),
                    ])
                    client.quit()
                })
                .then(() => {
                    setTimeout(async () => {
                        // Assert
                        const refetchOne = globalCache['_localCache'][`${FIRST_CACHE}::${KEY}`]
                        const refetchTwo = globalCache['_localCache'][`${FIRST_CACHE}::${KEY_TWO}`]
                        expect(refetchOne).to.equal(valueOneNew)
                        expect(refetchTwo).to.equal(valueTwoNew)
                        done()
                    }, 1000) // Wait a bit then check again.
                })
        })

        it('Should save a value with global option', async () => {
            // Arrange
            const value = 'saved globally'

            // Act
            await globalCache.setPrimitive(KEY, value, {
                level: CacheLevel.REMOTE,
                isGlobal: true,
            })

            // Assert: Remote value exists
            const anotherCache = new CacheProvider({
                name: SECOND_CACHE,
                single: {
                    host: 'localhost',
                },
            })
            try {
                const refetch = await anotherCache.getPrimitive(KEY, {
                    forceRemote: true,
                    isGlobal: true,
                })
                expect(refetch.isJust).to.be.true
                expect(refetch.value).to.equal(value)
            }
            finally {
                await anotherCache.delete(KEY, true)
                await anotherCache.dispose()
            }
        })

    }) // describe 'setPrimitive'


    describe('getPrimitive', () => {
        it('Should get string value (remote)', async () => {
            // Arrange
            const value = 'a test string'
            await globalCache.setPrimitive(KEY, value)

            // Act
            const refetch: Maybe<PrimitiveType> = await globalCache.getPrimitive(KEY, { forceRemote: true })

            // Assert
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.equal(value)
        })

        it('Should get string value (remote) from another cache provider instance', async () => {
            // Arrange
            const value = 'a test string'
            const anotherCache = new CacheProvider({
                name: FIRST_CACHE,
                single: {
                    host: 'localhost',
                },
            })
            try {
                await anotherCache.setPrimitive(KEY, value)

                // Act
                const refetch: Maybe<PrimitiveType> = await globalCache.getPrimitive(KEY)

                // Assert
                expect(refetch.isJust).to.be.true
                expect(refetch.value).to.equal(value)
            }
            finally {
                await anotherCache.dispose()
            }
        })

        it('Should get number value as string if no parsing (remote)', async () => {
            // Arrange
            const value = 123
            await globalCache.setPrimitive(KEY, value)

            // Act
            const refetch: Maybe<PrimitiveType> = await globalCache.getPrimitive(KEY, {
                forceRemote: true,
                parseType: false,
            })

            // Assert
            expect(refetch.isJust).to.be.true
            expect(typeof refetch.value).to.equal('string')
            expect(refetch.value).to.equal(value + '')
        })

        it('Should get number value as number if parsing is enabled (remote)', async () => {
            // Arrange
            const value = 123
            await globalCache.setPrimitive(KEY, value)

            // Act
            const refetch: Maybe<PrimitiveType> = await globalCache.getPrimitive(KEY, {
                forceRemote: true,
                parseType: true,
            })

            // Assert
            expect(refetch.isJust).to.be.true
            expect(typeof refetch.value).to.equal('number')
            expect(refetch.value).to.equal(value)
        })

        it('Should get boolean value as string if no parsing (remote)', async () => {
            // Arrange
            const value = true
            await globalCache.setPrimitive(KEY, value)

            // Act
            const refetch: Maybe<PrimitiveType> = await globalCache.getPrimitive(KEY, {
                forceRemote: true,
                parseType: false,
            })

            // Assert
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.equal(value + '')
            expect(typeof refetch.value).to.equal('string')
        })

        it('Should get boolean value as boolean if parsing is enabled (remote)', async () => {
            // Arrange
            const value = true
            await globalCache.setPrimitive(KEY, value)

            // Act
            const refetch = await globalCache.getPrimitive(KEY, {
                forceRemote: true,
                parseType: true,
            })

            // Assert
            expect(refetch.isJust).to.be.true
            expect(typeof refetch.value).to.equal('boolean')
            expect(refetch.value).to.equal(value)
        })

        it('Should get value locally if no cache service is provided', async () => {
            // Arrange
            const cache = new CacheProvider({
                    name: LOCAL_CACHE,
                    /* No remote service */
                }),
                value = 'a test string'

            // Inject value to local cache
            cache['_localCache'][`${LOCAL_CACHE}::${KEY}`] = value

            // Act
            const refetch: Maybe<PrimitiveType> = await cache.getPrimitive(KEY)

            // Assert
            expect(refetch.isJust).to.be.true
            expect(typeof refetch.value).to.equal('string')
            expect(refetch.value).to.equal(value)
        })

        it('Should return empty Maybe if not found (remote)', async () => {
            // Act
            const refetch: Maybe<PrimitiveType> = await globalCache.getPrimitive(NON_EXIST_KEY)

            // Assert
            expect(refetch.isJust).to.be.false
        })

        it('Should return empty Maybe if not found (local)', async () => {
            // Arrange
            const localCache = new CacheProvider({
                name: LOCAL_CACHE,
                /* No remote service */
            })

            // Act
            const refetch: Maybe<PrimitiveType> = await localCache.getPrimitive(NON_EXIST_KEY)

            // Assert
            expect(refetch.isJust).to.be.false
        })
    }) // describe 'getPrimitive'


    describe('setArray', () => {
        it('Should not allow null or undefined value', async () => {
            // Arrange
            const value: any = null
            let exception: any

            // Act
            try {
                await globalCache.setArray(KEY, value)
            } catch (err) {
                exception = err
            }

            // Assert
            expect(exception).to.be.instanceOf(InvalidArgumentException)
            expect(globalCache['_localCache'][`${FIRST_CACHE}::${KEY}`]).not.to.exist
        })

        it('Should save a primitive array', async () => {
            // Arrange
            const arr = [1, '2', false]

            // Act
            await globalCache.setArray(KEY, arr)

            // Assert
            const refetch = await globalCache.getArray(KEY, { forceRemote: true }) as Maybe<any> // Skip local cache
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.deep.equal(arr)
        })

        it('Should save an object array', async () => {
            // Arrange
            const arr = [
                {
                    name: 'Local Gennova',
                    age: 55,
                },
                {
                    address: 'A remote galaxy',
                    since: 2017,
                },
            ]

            // Act
            await globalCache.setArray(KEY, arr)

            // Assert
            const refetch = await globalCache.getArray(KEY, { forceRemote: true }) as Maybe<any> // Skip local cache
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.deep.equal(arr)
        })

        it('Should save a value with global option', async () => {
            // Arrange
            const arr = [1, '2', false]

            // Act
            await globalCache.setArray(KEY, arr, {
                level: CacheLevel.REMOTE,
                isGlobal: true,
            })

            // Assert: Remote value exists
            const anotherCache = new CacheProvider({
                name: SECOND_CACHE,
                single: {
                    host: 'localhost',
                },
            })
            try {
                const refetch = await anotherCache.getArray(KEY, {
                    forceRemote: true,
                    isGlobal: true,
                })
                expect(refetch.isJust).to.be.true
                expect(refetch.value).to.deep.equal(arr)
            }
            finally {
                await anotherCache.dispose()
            }
        })
    }) // describe 'setArray'


    describe('getArray', () => {
        it('Should get a primitive array', async () => {
            // Arrange
            const arr = [1, '2', false]
            await globalCache.setArray(KEY, arr)

            // Act
            const refetch: Maybe<PrimitiveType[]> = await globalCache.getArray(KEY, { forceRemote: true })

            // Assert
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.deep.equal(arr)
        })

        it('Should get a primitive array from another cache provider instance', async () => {
            // Arrange
            const arr = [1, '2', false]
            const anotherCache = new CacheProvider({
                name: FIRST_CACHE,
                single: {
                    host: 'localhost',
                },
            })
            try {
                await anotherCache.setArray(KEY, arr)

                // Act
                const refetch: Maybe<PrimitiveType[]> = await globalCache.getArray(KEY)

                // Assert
                expect(refetch.isJust).to.be.true
                expect(refetch.value).to.deep.equal(arr)
            }
            finally {
                await anotherCache.dispose()
            }
        })

        it('Should get an object array', async () => {
            // Arrange
            const arr = [
                {
                    name: 'Local Gennova',
                    age: 55,
                    alive: true,
                },
                {
                    address: 'A remote galaxy',
                    since: 2017,
                },
            ]
            await globalCache.setArray(KEY, arr)

            // Act
            const refetch: Maybe<PrimitiveType[]> = await globalCache.getArray(KEY, { forceRemote: true })

            // Assert
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.deep.equal(arr)
        })

        it('Should get value locally if no cache service is provided', async () => {
            // Arrange
            const cache = new CacheProvider({
                    name: LOCAL_CACHE,
                    /* No remote service */
                }),
                arr = [1, '2', false]

            // await cache.setArray(KEY, arr)
            cache['_localCache'][`${LOCAL_CACHE}::${KEY}`] = JSON.stringify(arr)

            // Act
            const refetch: Maybe<PrimitiveType[]> = await cache.getArray(KEY)

            // Assert
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.deep.equal(arr)
        })

        it('Should return empty Maybe if not found (remote)', async () => {
            // Act
            const refetch: Maybe<PrimitiveType[]> = await globalCache.getArray(NON_EXIST_KEY)

            // Assert
            expect(refetch.isJust).to.be.false
        })

        it('Should return empty Maybe if not found (local)', async () => {
            // Arrange
            const localCache = new CacheProvider({
                name: LOCAL_CACHE,
                /* No remote service */
            })

            // Act
            const refetch: Maybe<PrimitiveType[]> = await localCache.getArray(NON_EXIST_KEY)

            // Assert
            expect(refetch.isJust).to.be.false
        })

    }) // describe 'getArray'


    describe('setObject', () => {
        it('Should throw exception if value is null of undefined', async () => {
            // Arrange
            const obj: any = null
            let exception: InvalidArgumentException

            // Act
            try {
                await globalCache.setObject(KEY, obj)
            } catch (ex) {
                exception = ex
            }

            // Assert
            expect(globalCache['_localCache'][`${FIRST_CACHE}::${KEY}`]).not.to.exist
            expect(exception).to.exist
            expect(exception).to.be.instanceOf(InvalidArgumentException)
        })

        it('Should save an object locally only', async () => {
            // Arrange
            const objOne = {
                    name: 'Local Gennova',
                    age: 55,
                },
                objTwo = {
                    address: 'A remote galaxy',
                    since: 2017,
                },
                client = redis.createClient({
                    host: 'localhost',
                })

            // Act
            await client['hmsetAsync'](`${FIRST_CACHE}::${KEY}`, objTwo)
            await globalCache.setObject(KEY, objOne, { level: CacheLevel.LOCAL })

            // Assert: Local value is different than remote value
            expect(globalCache['_localCache'][`${FIRST_CACHE}::${KEY}`]).to.deep.equal(objOne)

            const remote = await globalCache.getObject(KEY, { forceRemote: true }) as Maybe<any> // Skip local cache
            expect(remote.isJust).to.be.true
            expect(remote.value).to.deep.equal(objTwo)

            // Clean up
            client.quit()
        })

        it('Should default to save an object locally only if no cache service is provided', async () => {
            // Arrange
            const cache = new CacheProvider({
                    name: LOCAL_CACHE,
                    /* No remote service */
                }),
                obj = {
                    name: 'Local Gennova',
                    age: 55,
                }

            // Act
            await cache.setObject(KEY, obj)

            // Assert: Local value is different than remote value
            expect(cache['_localCache'][`${LOCAL_CACHE}::${KEY}`]).to.deep.equal(obj)
        })

        it('Should save an object remote only', async () => {
            // Arrange
            const obj = {
                    name: 'Remote Gennova',
                    age: 99,
                }

            // Act
            await globalCache.setObject(KEY, obj, { level: CacheLevel.REMOTE })

            // Assert: Local value does not exist
            expect(globalCache['_localCache'][`${FIRST_CACHE}::${KEY}`]).not.to.exist
            expect(globalCache['_cacheExps'][`${FIRST_CACHE}::${KEY}`]).not.to.exist

            // Assert: Remote value exists
            const refetch = await globalCache.getObject(KEY, { forceRemote: true }) as Maybe<any> // Skip local cache
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.deep.equal(obj)
        })

        it('Should save an object both remotely and locally', async () => {
            // Arrange
            const obj = {
                    name: 'Gennova everywhere',
                    age: 124,
                }

            // Act
            await globalCache.setObject(KEY, obj, { level: CacheLevel.BOTH })

            // Assert: Remote and local values are the same
            const remote = await globalCache.getObject(KEY, { forceRemote: true }) as Maybe<any> // Skip local cache
            const local = globalCache['_localCache'][`${FIRST_CACHE}::${KEY}`]
            expect(remote.isJust).to.be.true
            expect(remote.value).to.deep.equal(local)
        })

        it('Should save an object then expire locally', (done) => {
            // Arrange
            const obj = {
                    name: 'Gennova everywhere',
                    age: 124,
                },
                SECONDS = 1

            // Act
            globalCache.setObject(KEY, obj, { duration: SECONDS, level: CacheLevel.LOCAL })
                .then(() => {
                    setTimeout(async () => {
                        // Assert
                        const refetch = await globalCache.getObject(KEY, { forceRemote: false }) as Maybe<any>
                        if (refetch.isJust) {
                            console.log('Refetch:', refetch)
                        }
                        expect(refetch.isJust).to.be.false
                        done()
                    }, 1100) // Wait until key expires
                })
        })

        it('Should save an object then expire remotely', (done) => {
            // Arrange
            const obj = {
                    name: 'Gennova everywhere',
                    age: 124,
                },
                SECONDS = 1

            // Act
            globalCache.setObject(KEY, obj, { duration: SECONDS, level: CacheLevel.REMOTE })
                .then(() => {
                    setTimeout(async () => {
                        // Assert
                        const refetch = await globalCache.getObject(KEY, { forceRemote: true }) as Maybe<any>
                        if (refetch.isJust) {
                            console.log('Refetch:', refetch)
                        }
                        expect(refetch.isJust).to.be.false
                        done()
                    }, 1100) // Wait until key expires
                })

        })

        it('Should save an object then keep sync', (done) => {
            // Arrange
            const objOne = {
                    name: 'Sync Gennova',
                    age: 987,
                },
                objTwo = {
                    address: 'The middle of nowhere',
                    since: 2017,
                },
                client = redis.createClient({
                    host: 'localhost',
                })

            // Act
            globalCache.setObject(KEY, objOne, { level: CacheLevel.BOTH })
                .then(async () => {
                    await client.multi()
                        .del(`${FIRST_CACHE}::${KEY}`)
                        .hmset(`${FIRST_CACHE}::${KEY}`, objTwo)['execAsync']()
                    client.quit()
                })
                .then(() => {
                    setTimeout(async () => {
                        // Assert
                        const refetch: any = globalCache['_localCache'][`${FIRST_CACHE}::${KEY}`]
                        expect(refetch).to.exist
                        expect(refetch.name).not.to.exist
                        expect(refetch.age).not.to.exist
                        expect(refetch).to.deep.equal(objTwo)
                        done()
                    }, 1000) // Wait a bit then check again.
                })
        })

        it('Should save a value with global option', async () => {
            // Arrange
            const obj = {
                    name: 'Remote Gennova',
                    age: 99,
                }

            // Act
            await globalCache.setObject(KEY, obj, {
                level: CacheLevel.REMOTE,
                isGlobal: true,
            })

            // Assert: Remote value exists
            const anotherCache = new CacheProvider({
                name: SECOND_CACHE,
                single: {
                    host: 'localhost',
                },
            })
            try {
                const refetch = await globalCache.getObject(KEY, {
                    forceRemote: true,
                    isGlobal: true,
                })
                expect(refetch.isJust).to.be.true
                expect(refetch.value).to.deep.equal(obj)
            }
            finally {
                await anotherCache.dispose()
            }
        })
    }) // describe 'setObject'


    describe('getObject', () => {
        it('Should get object with all string properties', async () => {
            // Arrange
            const obj = {
                    name: 'Local Gennova',
                    age: 55,
                    alive: true,
                }
            await globalCache.setObject(KEY, obj)

            // Act
            const refetch: Maybe<PrimitiveFlatJson> = await globalCache.getObject(KEY, {
                forceRemote: true,
                parseType: false,
            })

            // Assert
            expect(refetch.isJust).to.be.true
            const val = refetch.value
            for (const p in val) {
                expect(val[p]).to.equal(obj[p] + '')
                expect(typeof val[p]).to.equal('string')
            }
        })

        it('Should get object from another cache provider instance', async () => {
            // Arrange
            const obj = {
                    name: 'Local Gennova',
                    age: 55,
                    alive: true,
                }
            const anotherCache = new CacheProvider({
                name: FIRST_CACHE,
                single: {
                    host: 'localhost',
                },
            })
            try {
                await anotherCache.setObject(KEY, obj)

                // Act
                const refetch: Maybe<PrimitiveFlatJson> = await globalCache.getObject(KEY, {
                    forceRemote: true,
                    parseType: false,
                })

                // Assert
                expect(refetch.isJust).to.be.true
                const val = refetch.value
                for (const p in val) {
                    expect(val[p]).to.equal(obj[p] + '')
                    expect(typeof val[p]).to.equal('string')
                }
            }
            finally {
                await anotherCache.dispose()
            }
        })

        it('Should get object with properties of their original type', async () => {
            // Arrange
            const obj = {
                    name: 'Local Gennova',
                    age: 55,
                    alive: true,
                }
            await globalCache.setObject(KEY, obj)

            // Act
            const refetch: Maybe<PrimitiveFlatJson> = await globalCache.getObject(KEY, {
                forceRemote: true,
                parseType: true,
            })

            // Assert
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.deep.equal(obj)
        })

        it('Should get value locally if no cache service is provided', async () => {
            // Arrange
            const cache = new CacheProvider({
                    name: LOCAL_CACHE,
                    /* No remote service */
                }),
                obj = {
                    name: 'Local Gennova',
                    age: 55,
                    alive: true,
                }
            cache['_localCache'][`${LOCAL_CACHE}::${KEY}`] = obj

            // Act
            const refetch: Maybe<PrimitiveFlatJson> = await cache.getObject(KEY)

            // Assert
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.deep.equal(obj)
        })

        it('Should return empty Maybe if not found', async () => {
            // Act
            const refetch: Maybe<PrimitiveFlatJson> = await globalCache.getObject(NON_EXIST_KEY)

            // Assert
            expect(refetch.isJust).to.be.false
        })
    }) // describe 'getPrimitive'

})
