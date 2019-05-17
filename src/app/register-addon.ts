import { IDependencyContainer, serviceContext } from '@micro-fleet/common'

import { CacheAddOn } from './CacheAddOn'
import { Types as T } from './Types'


export function registerCacheAddOn(): CacheAddOn {
    const depCon: IDependencyContainer = serviceContext.dependencyContainer

    /*
     * Don't bind CacheProvider here, as CacheAddOn.init() will do that.
     */

    if (!depCon.isBound(T.CACHE_ADDON)) {
        depCon.bind<CacheAddOn>(T.CACHE_ADDON, CacheAddOn).asSingleton()
    }
    const addon = depCon.resolve<CacheAddOn>(T.CACHE_ADDON)
    return addon
}
