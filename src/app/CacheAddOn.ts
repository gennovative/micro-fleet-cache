import { injectable, inject, Guard, IDependencyContainer, Types as CmT, Maybe,
	IConfigurationProvider, CacheConnectionDetail, CriticalException,
	constants } from '@micro-fleet/common';

import { CacheProvider, CacheProviderConstructorOpts } from './CacheProvider';
import { Types as T } from './Types';

const { SvcSettingKeys: S, CacheSettingKeys: C } = constants;


@injectable()
export class CacheAddOn implements IServiceAddOn {
	public readonly name: string = 'CacheAddOn';
	
	private _cacheProvider: CacheProvider;

	constructor(
		@inject(CmT.CONFIG_PROVIDER) private _configProvider: IConfigurationProvider,
		@inject(CmT.DEPENDENCY_CONTAINER) private _depContainer: IDependencyContainer,
	) {
		Guard.assertArgDefined('_configProvider', _configProvider);
		Guard.assertArgDefined('_depContainer', _depContainer);
	}

	/**
	 * @see IServiceAddOn.init
	 */
	public init(): Promise<void> {
		const svcSlug = this._configProvider.get(S.SERVICE_SLUG);
		if (!svcSlug.hasValue) {
			return Promise.reject(new CriticalException('SERVICE_SLUG_REQUIRED'));
		}
		const opts: CacheProviderConstructorOpts = {
				name: svcSlug.value as string
			};

		const result = this._buildConnDetails();
		if (result.hasValue) {
			const connDetails = result.value;
			if (connDetails.length == 1) {
				opts.single = connDetails[0];
			} else {
				opts.cluster = connDetails;
			}
		}

		this._cacheProvider = new CacheProvider(opts);
		this._depContainer.bindConstant<CacheProvider>(T.CACHE_PROVIDER, this._cacheProvider);
		return Promise.resolve();
	}

	/**
	 * @see IServiceAddOn.deadLetter
	 */
	public deadLetter(): Promise<void> {
		return Promise.resolve();
	}

	/**
	 * @see IServiceAddOn.dispose
	 */
	public dispose(): Promise<void> {
		return (this._cacheProvider) ? this._cacheProvider.dispose() : Promise.resolve();
	}

	private _buildConnDetails(): Maybe<CacheConnectionDetail[]> {
		const provider = this._configProvider,
			nConn = provider.get(C.CACHE_NUM_CONN) as Maybe<number>,
			details: CacheConnectionDetail[] = [];

		if (!nConn.hasValue) { return new Maybe; }
		for (let i = 0; i < nConn.value; ++i) {
			const host = provider.get(C.CACHE_HOST + i) as Maybe<string>;
			const port = provider.get(C.CACHE_PORT + i) as Maybe<number>;

			if (!host.hasValue || !port.hasValue) { continue; }
			details.push({
				host: host.value,
				port: port.value
			});
		}
		return details.length ? new Maybe(details) : new Maybe;
	}
}