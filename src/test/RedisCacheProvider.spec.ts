import { expect } from 'chai'
import * as redis from 'redis'
import { Maybe, InvalidArgumentException, PrimitiveType } from '@micro-fleet/common'

import { RedisCacheProvider, CacheLevel } from '../app'


const FIRST_CACHE_NAME = 'firstcache',
    SECOND_CACHE_NAME = 'secondcache',
    LOCAL_CACHE_NAME = 'localcache',
    SUFFIX = '::unittest',
    KEY = 'TESTKEY' + SUFFIX,
    NON_EXIST_KEY = 'BLANK'

let cache: RedisCacheProvider

// tslint:disable: no-floating-promises

describe('CacheProvider (single)', function () {
    this.timeout(5000)
    // this.timeout(60000)

    beforeEach(() => {
        cache = new RedisCacheProvider({
            name: FIRST_CACHE_NAME,
            single: {
                host: 'localhost',
            },
        })
    })

    afterEach(async () => {
        await cache.delete(KEY)
        await cache.dispose()
        cache = null
    })

    describe('constructor', () => {
        it('should use local cache only if no option is provided', () => {
            // Act
            const testCache = new RedisCacheProvider()

            // Assert
            expect(testCache['_localCache']).to.exist
            expect(testCache['_engine']).not.to.exist
        })
    }) // describe 'constructor'

    describe('setPrimitive', () => {
        it('Should not allow null or undefined value', async () => {
            // Arrange
            const value: any = null
            let exception: any

            // Act
            try {
                await cache.setPrimitive(KEY, value)
            } catch (err) {
                exception = err
            }

            // Assert
            expect(exception).to.be.instanceOf(InvalidArgumentException)
            expect(cache['_localCache'][`${FIRST_CACHE_NAME}::${KEY}`]).not.to.exist
        })

        it('Should save a value locally only', async () => {
            // Arrange
            const valueOne = 'saved locally',
                valueTwo = 'saved remotely'
            const client = redis.createClient({
                host: 'localhost',
            })

            // Act
            await client['setAsync'](`${FIRST_CACHE_NAME}::${KEY}`, valueTwo)
            await cache.setPrimitive(KEY, valueOne, { level: CacheLevel.LOCAL })

            // Assert: Local value is different than remote value
            expect(cache['_localCache'][`${FIRST_CACHE_NAME}::${KEY}`]).to.equal(valueOne)

            const remote = await cache.getPrimitive(KEY, { forceRemote: true }) as Maybe<string> // Skip local cache
            expect(remote.isJust).to.be.true
            expect(remote.value).to.equal(valueTwo)

            // Clean up
            client.quit()
        })

        it('Should default to save a value locally only if no cache service is provided', async () => {
            // Arrange
            const testCache = new RedisCacheProvider({
                    name: LOCAL_CACHE_NAME,
                    /* No remote service */
                })
            const value = 'saved locally'

            // Act
            await testCache.setPrimitive(KEY, value)

            // Assert: Local value is different than remote value
            expect(testCache['_localCache'][`${LOCAL_CACHE_NAME}::${KEY}`]).to.equal(value)
        })

        it('Should save a value remote only', async () => {
            // Arrange
            const value = 'saved remotely'

            // Act
            await cache.setPrimitive(KEY, value, { level: CacheLevel.REMOTE })

            // Assert: Local value does not exist
            expect(cache['_localCache'][`${FIRST_CACHE_NAME}::${KEY}`]).not.to.exist
            expect(cache['_cacheExps'][`${FIRST_CACHE_NAME}::${KEY}`]).not.to.exist

            // Assert: Remote value exists
            const refetch = await cache.getPrimitive(KEY, { forceRemote: true }) as Maybe<string> // Skip local cache
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.equal(value)
        })

        it('Should save a value both remotely and locally', async () => {
            // Arrange
            const value = 'I am everywhere'

            // Act
            await cache.setPrimitive(KEY, value, { level: CacheLevel.BOTH })

            // Assert: Remote and local values are the same
            const remote = await cache.getPrimitive(KEY, { forceRemote: true }) as Maybe<string>, // Skip local cache
                local = cache['_localCache'][`${FIRST_CACHE_NAME}::${KEY}`]
            expect(remote.isJust).to.be.true
            expect(remote.value).to.equal(local)
        })

        it('Should save a value then expire locally', (done) => {
            // Arrange
            const value = 'a local string',
                SECONDS = 1

            // Act
            cache.setPrimitive(KEY, value, { duration: SECONDS, level: CacheLevel.LOCAL })
                .then(() => {
                    setTimeout(async () => {
                        // Assert
                        const refetch = await cache.getPrimitive(KEY, { forceRemote: false }) as Maybe<string>
                        if (refetch.isJust) {
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
            cache.setPrimitive(KEY, value, { duration: SECONDS, level: CacheLevel.REMOTE })
                .then(() => {
                    setTimeout(async () => {
                        // Assert
                        const refetch = await cache.getPrimitive(KEY, { forceRemote: true }) as Maybe<string>
                        if (refetch.isJust) {
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
            cache.setPrimitive(KEY, value, { duration: SECONDS, level: CacheLevel.BOTH })
                .then(() => {
                    setTimeout(async () => {
                        // Assert
                        const remote = await cache.getPrimitive(KEY, { forceRemote: true }) as Maybe<string>,
                            local = cache['_localCache'][`${FIRST_CACHE_NAME}::${KEY}`]

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
            const KEY_TWO = 'SECKEY' + SUFFIX
            const valueOne = 'a test string',
                valueOneNew = 'another string',
                valueTwo = 'the second string',
                valueTwoNew = 'the new second string',
                client = redis.createClient({
                    host: 'localhost',
                })

            // Act
            cache.setPrimitive(KEY, valueOne, { duration: 0, level: CacheLevel.BOTH })
                .then(() => {
                    return cache.setPrimitive(KEY_TWO, valueTwo, { duration: 0, level: CacheLevel.BOTH })
                })
                .then(async () => {
                    await Promise.all([
                        client['setAsync'](`${FIRST_CACHE_NAME}::${KEY}`, valueOneNew),
                        client['setAsync'](`${FIRST_CACHE_NAME}::${KEY_TWO}`, valueTwoNew),
                    ])
                    client.quit()
                })
                .then(() => {
                    setTimeout(() => {
                        // Assert
                        const refetchOne = cache['_localCache'][`${FIRST_CACHE_NAME}::${KEY}`]
                        const refetchTwo = cache['_localCache'][`${FIRST_CACHE_NAME}::${KEY_TWO}`]
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
            await cache.setPrimitive(KEY, value, {
                level: CacheLevel.REMOTE,
                isGlobal: true,
            })

            // Assert: Remote value exists
            const anotherCache = new RedisCacheProvider({
                name: SECOND_CACHE_NAME,
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
                await anotherCache.delete(KEY, { isGlobal: true })
                await anotherCache.dispose()
            }
        })

    }) // describe 'setPrimitive'


    describe('getPrimitive', () => {
        it('Should get string value (remote)', async () => {
            // Arrange
            const value = 'a test string'
            await cache.setPrimitive(KEY, value)

            // Act
            const refetch: Maybe<PrimitiveType> = await cache.getPrimitive(KEY, { forceRemote: true })

            // Assert
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.equal(value)
        })

        it('Should get string value (remote) from another cache provider instance', async () => {
            // Arrange
            const value = 'a test string'
            const anotherCache = new RedisCacheProvider({
                name: FIRST_CACHE_NAME,
                single: {
                    host: 'localhost',
                },
            })
            try {
                await anotherCache.setPrimitive(KEY, value)

                // Act
                const refetch: Maybe<PrimitiveType> = await cache.getPrimitive(KEY)

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
            await cache.setPrimitive(KEY, value)

            // Act
            const refetch: Maybe<PrimitiveType> = await cache.getPrimitive(KEY, {
                forceRemote: true,
                parseType: false,
            })

            // Assert
            expect(refetch.isJust).to.be.true
            expect(typeof refetch.value).to.equal('string')
            expect(refetch.value).to.equal(String(value))
        })

        it('Should get number value as number if parsing is enabled (remote)', async () => {
            // Arrange
            const value = 123
            await cache.setPrimitive(KEY, value)

            // Act
            const refetch: Maybe<PrimitiveType> = await cache.getPrimitive(KEY, {
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
            await cache.setPrimitive(KEY, value)

            // Act
            const refetch: Maybe<PrimitiveType> = await cache.getPrimitive(KEY, {
                forceRemote: true,
                parseType: false,
            })

            // Assert
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.equal(String(value))
            expect(typeof refetch.value).to.equal('string')
        })

        it('Should get boolean value as boolean if parsing is enabled (remote)', async () => {
            // Arrange
            const value = true
            await cache.setPrimitive(KEY, value)

            // Act
            const refetch = await cache.getPrimitive(KEY, {
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
            const testCache = new RedisCacheProvider({
                    name: LOCAL_CACHE_NAME,
                    /* No remote service */
                }),
                value = 'a test string'

            // Inject value to local cache
            testCache['_localCache'][`${LOCAL_CACHE_NAME}::${KEY}`] = value

            // Act
            const refetch: Maybe<PrimitiveType> = await testCache.getPrimitive(KEY)

            // Assert
            expect(refetch.isJust).to.be.true
            expect(typeof refetch.value).to.equal('string')
            expect(refetch.value).to.equal(value)
        })

        it('Should return empty Maybe if not found (remote)', async () => {
            // Act
            const refetch: Maybe<PrimitiveType> = await cache.getPrimitive(NON_EXIST_KEY)

            // Assert
            expect(refetch.isJust).to.be.false
        })

        it('Should return empty Maybe if not found (local)', async () => {
            // Arrange
            const localCache = new RedisCacheProvider({
                name: LOCAL_CACHE_NAME,
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
                await cache.setArray(KEY, value)
            } catch (err) {
                exception = err
            }

            // Assert
            expect(exception).to.be.instanceOf(InvalidArgumentException)
            expect(cache['_localCache'][`${FIRST_CACHE_NAME}::${KEY}`]).not.to.exist
        })

        it('Should save a primitive array', async () => {
            // Arrange
            const arr = [1, '2', false]

            // Act
            await cache.setArray(KEY, arr)

            // Assert
            const refetch = await cache.getArray(KEY, { forceRemote: true }) as Maybe<any> // Skip local cache
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
            await cache.setArray(KEY, arr)

            // Assert
            const refetch = await cache.getArray(KEY, { forceRemote: true }) as Maybe<any> // Skip local cache
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.deep.equal(arr)
        })

        it('Should save a value with global option', async () => {
            // Arrange
            const arr = [1, '2', false]

            // Act
            await cache.setArray(KEY, arr, {
                level: CacheLevel.REMOTE,
                isGlobal: true,
            })

            // Assert: Remote value exists
            const anotherCache = new RedisCacheProvider({
                name: SECOND_CACHE_NAME,
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
            await cache.setArray(KEY, arr)

            // Act
            const refetch: Maybe<PrimitiveType[]> = await cache.getArray(KEY, { forceRemote: true })

            // Assert
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.deep.equal(arr)
        })

        it('Should get a primitive array from another cache provider instance', async () => {
            // Arrange
            const arr = [1, '2', false]
            const anotherCache = new RedisCacheProvider({
                name: FIRST_CACHE_NAME,
                single: {
                    host: 'localhost',
                },
            })
            try {
                await anotherCache.setArray(KEY, arr)

                // Act
                const refetch: Maybe<PrimitiveType[]> = await cache.getArray(KEY)

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
            await cache.setArray(KEY, arr)

            // Act
            const refetch: Maybe<PrimitiveType[]> = await cache.getArray(KEY, { forceRemote: true })

            // Assert
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.deep.equal(arr)
        })

        it('Should get value locally if no cache service is provided', async () => {
            // Arrange
            const testCache = new RedisCacheProvider({
                    name: LOCAL_CACHE_NAME,
                    /* No remote service */
                }),
                arr = [1, '2', false]

            // await cache.setArray(KEY, arr)
            testCache['_localCache'][`${LOCAL_CACHE_NAME}::${KEY}`] = JSON.stringify(arr)

            // Act
            const refetch: Maybe<PrimitiveType[]> = await testCache.getArray(KEY)

            // Assert
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.deep.equal(arr)
        })

        it('Should return empty Maybe if not found (remote)', async () => {
            // Act
            const refetch: Maybe<PrimitiveType[]> = await cache.getArray(NON_EXIST_KEY)

            // Assert
            expect(refetch.isJust).to.be.false
        })

        it('Should return empty Maybe if not found (local)', async () => {
            // Arrange
            const localCache = new RedisCacheProvider({
                name: LOCAL_CACHE_NAME,
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
                await cache.setObject(KEY, obj)
            } catch (ex) {
                exception = ex
            }

            // Assert
            expect(cache['_localCache'][`${FIRST_CACHE_NAME}::${KEY}`]).not.to.exist
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
            await client['hmsetAsync'](`${FIRST_CACHE_NAME}::${KEY}`, objTwo)
            await cache.setObject(KEY, objOne, { level: CacheLevel.LOCAL })

            // Assert: Local value is different than remote value
            expect(cache['_localCache'][`${FIRST_CACHE_NAME}::${KEY}`]).to.deep.equal(objOne)

            const remote = await cache.getObject(KEY, { forceRemote: true }) as Maybe<any> // Skip local cache
            expect(remote.isJust).to.be.true
            expect(remote.value).to.deep.equal(objTwo)

            // Clean up
            client.quit()
        })

        it('Should default to save an object locally only if no cache service is provided', async () => {
            // Arrange
            const testCache = new RedisCacheProvider({
                    name: LOCAL_CACHE_NAME,
                    /* No remote service */
                }),
                obj = {
                    name: 'Local Gennova',
                    age: 55,
                }

            // Act
            await testCache.setObject(KEY, obj)

            // Assert: Local value is different than remote value
            expect(testCache['_localCache'][`${LOCAL_CACHE_NAME}::${KEY}`]).to.deep.equal(obj)
        })

        it('Should save an object remote only', async () => {
            // Arrange
            const obj = {
                    name: 'Remote Gennova',
                    age: 99,
                }

            // Act
            await cache.setObject(KEY, obj, { level: CacheLevel.REMOTE })

            // Assert: Local value does not exist
            expect(cache['_localCache'][`${FIRST_CACHE_NAME}::${KEY}`]).not.to.exist
            expect(cache['_cacheExps'][`${FIRST_CACHE_NAME}::${KEY}`]).not.to.exist

            // Assert: Remote value exists
            const refetch = await cache.getObject(KEY, { forceRemote: true }) as Maybe<any> // Skip local cache
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
            await cache.setObject(KEY, obj, { level: CacheLevel.BOTH })

            // Assert: Remote and local values are the same
            const remote = await cache.getObject(KEY, { forceRemote: true }) as Maybe<any> // Skip local cache
            const local = cache['_localCache'][`${FIRST_CACHE_NAME}::${KEY}`]
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
            cache.setObject(KEY, obj, { duration: SECONDS, level: CacheLevel.LOCAL })
                .then(() => {
                    setTimeout(async () => {
                        // Assert
                        const refetch = await cache.getObject(KEY, { forceRemote: false }) as Maybe<any>
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
            cache.setObject(KEY, obj, { duration: SECONDS, level: CacheLevel.REMOTE })
                .then(() => {
                    setTimeout(async () => {
                        // Assert
                        const refetch = await cache.getObject(KEY, { forceRemote: true }) as Maybe<any>
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
            cache.setObject(KEY, objOne, { level: CacheLevel.BOTH })
                .then(async () => {
                    await client.multi()
                        .del(`${FIRST_CACHE_NAME}::${KEY}`)
                        .hmset(`${FIRST_CACHE_NAME}::${KEY}`, objTwo)['execAsync']()
                    client.quit()
                })
                .then(() => {
                    setTimeout(() => {
                        // Assert
                        const refetch: any = cache['_localCache'][`${FIRST_CACHE_NAME}::${KEY}`]
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
            await cache.setObject(KEY, obj, {
                level: CacheLevel.REMOTE,
                isGlobal: true,
            })

            // Assert: Remote value exists
            const anotherCache = new RedisCacheProvider({
                name: SECOND_CACHE_NAME,
                single: {
                    host: 'localhost',
                },
            })
            try {
                const refetch = await cache.getObject(KEY, {
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
            await cache.setObject(KEY, obj)

            // Act
            const refetch: Maybe<object> = await cache.getObject(KEY, {
                forceRemote: true,
                parseType: false,
            })

            // Assert
            expect(refetch.isJust).to.be.true
            const val = refetch.value
            for (const p in val) {
                expect(val[p]).to.equal(String(obj[p]))
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
            const anotherCache = new RedisCacheProvider({
                name: FIRST_CACHE_NAME,
                single: {
                    host: 'localhost',
                },
            })
            try {
                await anotherCache.setObject(KEY, obj)

                // Act
                const refetch: Maybe<object> = await cache.getObject(KEY, {
                    forceRemote: true,
                    parseType: false,
                })

                // Assert
                expect(refetch.isJust).to.be.true
                const val = refetch.value
                for (const p in val) {
                    expect(val[p]).to.equal(String(obj[p]))
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
            await cache.setObject(KEY, obj)

            // Act
            const refetch: Maybe<object> = await cache.getObject(KEY, {
                forceRemote: true,
                parseType: true,
            })

            // Assert
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.deep.equal(obj)
        })

        it('Should get value locally if no cache service is provided', async () => {
            // Arrange
            const testCache = new RedisCacheProvider({
                    name: LOCAL_CACHE_NAME,
                    /* No remote service */
                }),
                obj = {
                    name: 'Local Gennova',
                    age: 55,
                    alive: true,
                }
            testCache['_localCache'][`${LOCAL_CACHE_NAME}::${KEY}`] = obj

            // Act
            const refetch: Maybe<object> = await testCache.getObject(KEY)

            // Assert
            expect(refetch.isJust).to.be.true
            expect(refetch.value).to.deep.equal(obj)
        })

        it('Should return empty Maybe if not found', async () => {
            // Act
            const refetch: Maybe<object> = await cache.getObject(NON_EXIST_KEY)

            // Assert
            expect(refetch.isJust).to.be.false
        })
    }) // describe 'getPrimitive'

    describe('delete', () => {
        it('Should delete LOCAL keys matching pattern', async () => {
            // Arrange
            const MOCK_COUNT = 10
            const testCache = new RedisCacheProvider({
                    name: LOCAL_CACHE_NAME,
                    /* No remote service */
                })
            const getKey = () => Object.keys(testCache['_localCache'])
            for (let i = 0; i < MOCK_COUNT; ++i) {
                await testCache.setPrimitive(`DEL-${i}${SUFFIX}-ME`, `VAL-${i}`, { level: CacheLevel.LOCAL })
            }

            for (let i = 0; i < MOCK_COUNT; ++i) {
                await testCache.setPrimitive(`REMOVE-${i}-ME-${i}`, `VAL-${i}`, { level: CacheLevel.LOCAL })
            }
            const FULL_COUNT = getKey().length
            expect(FULL_COUNT).to.equal(21)

            // Act 1
            const PATTERN_ONE = `*${SUFFIX}*`
            await testCache.delete(PATTERN_ONE, { isPattern: true })

            // Assert 1
            let keys = getKey()
            expect(keys.length).to.equal(FULL_COUNT - MOCK_COUNT) // Should remain 11

            // Act 2
            const PATTERN_TWO = '*REMOVE-?-ME-?' // Remember: cache key is prefixed with cache name
            await testCache.delete(PATTERN_TWO, { isPattern: true })

            // Assert 2
            keys = Object.keys(testCache['_localCache'])
            expect(keys.length).to.equal(1)
            expect(keys[0]).to.equal('@#!')
        })

        it('Should delete REMOTE keys matching pattern', async () => {
            // Arrange
            const MOCK_COUNT = 25
            for (let i = 0; i < MOCK_COUNT; ++i) {
                await cache.setPrimitive(`DEL-ME-${i}${SUFFIX}`, `VAL-${i}`, { level: CacheLevel.REMOTE })
            }

            // Act
            const PATTERN = `*${SUFFIX}`
            await cache.delete(PATTERN, { isPattern: true })

            // Assert
            const client = redis.createClient({
                host: 'localhost',
            })
            try {
                const result: [string, string[]] = await client['scanAsync']('',
                    'MATCH', PATTERN, 'COUNT', MOCK_COUNT * 2) // Double to MOCK_COUNT to search wider
                expect(result[0]).to.equal('0')
                expect(result[1].length).to.equal(0)
            }
            finally {
                // Clean up
                await client['quitAsync']()
            }
        })
    }) // describe 'delete'
})
