import { expect } from 'chai'

import { constants } from '@micro-fleet/common'

import { CacheConnectionDetail, CacheSettings } from '../app'

const { Cache: C } = constants

describe('CacheSettings', () => {
    describe('constructor', () => {
        it('Should create an instance with one setting', () => {
            // Act
            const target = new CacheSettings()

            // Assert
            expect(Number.isInteger(target.total)).to.be.true
            expect(target.total).to.equal(0)
            expect(target[0].name).to.equal(C.CACHE_NUM_CONN)
            expect(target[0].value).to.equal('0')
        })
    })

    describe('pushConnection', () => {
        it('Should add setting items', () => {
            // Arrange
            const connOne: CacheConnectionDetail = {
                    host: 'localhost',
                    port: 6379,
                },
                connTwo: CacheConnectionDetail = {
                    host: 'firstidea.vn',
                    port: 6380,
                }

            // Act
            const target = new CacheSettings()
            target.pushServer(connOne)
            target.pushServer(connTwo)

            // Assert
            expect(Number.isInteger(target.total)).to.be.true
            expect(target.total).to.equal(2)
            expect(target[0].name).to.equal(C.CACHE_NUM_CONN)
            expect(target[0].value).to.equal('2')
            expect(target[1].name).to.equal(C.CACHE_HOST + '0')
            expect(target[1].value).to.equal('localhost')
            expect(target[2].name).to.equal(C.CACHE_PORT + '0')
            expect(target[2].value).to.equal('6379')
            expect(target[3].name).to.equal(C.CACHE_HOST + '1')
            expect(target[3].value).to.equal('firstidea.vn')
            expect(target[4].name).to.equal(C.CACHE_PORT + '1')
            expect(target[4].value).to.equal('6380')
        })
    }) // END describe 'pushConnection'
})
