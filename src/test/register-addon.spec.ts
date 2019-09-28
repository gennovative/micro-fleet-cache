import * as chai from 'chai'
import * as spies from 'chai-spies'
chai.use(spies)
const expect = chai.expect
import { IDependencyContainer, DependencyContainer, serviceContext } from '@micro-fleet/common'

import { registerCacheAddOn, CacheAddOn, Types as T } from '../app'


describe('registerDbAddOn', function () {
    // this.timeout(60000) // For debuging

    let depCon: IDependencyContainer

    beforeEach(() => {
        depCon = new DependencyContainer()
        serviceContext.setDependencyContainer(depCon)
    })

    afterEach(() => {
        depCon.dispose()
        depCon = null
    })

    it('Should register dependencies if not already', () => {
        // Act
        registerCacheAddOn()

        // Assert
        expect(depCon.isBound(T.CACHE_ADDON)).to.be.true
    })

    it('Should not register dependencies if already registered', () => {
        // Arrange
        depCon.bindConstructor<CacheAddOn>(T.CACHE_ADDON, CacheAddOn)
        chai.spy.on(depCon, 'bindConstructor')

        // Act
        registerCacheAddOn()

        // Assert
        expect(depCon.bindConstructor).not.to.be.called
    })
}) // describe
