import * as chai from 'chai';
import * as spies from 'chai-spies';
import { DependencyContainer, IConfigurationProvider, Maybe,
	constants } from '@micro-fleet/common';

import { CacheAddOn, CacheProvider, Types as T } from '../app';


chai.use(spies);
const expect = chai.expect;
const { CacheSettingKeys: C, SvcSettingKeys: SvS } = constants;

class MockConfigAddOn implements IConfigurationProvider {
	public readonly name: string = 'MockConfigAddOn';

	constructor(private _mode: string) {
		
	}

	get enableRemote(): boolean {
		return true;
	}

	public get(key: string): Maybe<number | boolean | string> {
		if (!this._mode) { 
			switch (key) {
				case SvS.SERVICE_SLUG: return new Maybe('TestCacheSvc');
				default: return new Maybe;
			}
		}

		switch (key) {
			case C.CACHE_NUM_CONN: return new Maybe(this._mode == 'single' ? 1 : 2);
			case C.CACHE_HOST + '0': return new Maybe('localhost');
			case C.CACHE_PORT + '0': return new Maybe('6379');
			case C.CACHE_HOST + '1': return new Maybe('firstidea.vn');
			case C.CACHE_PORT + '1': return new Maybe('6380');
			case SvS.SERVICE_SLUG: return new Maybe('TestCacheSvc');
		}
		return new Maybe;
	}

	public deadLetter(): Promise<void> {
		return Promise.resolve();
	}

	public fetch(): Promise<boolean> {
		return Promise.resolve(true);
	}

	public init(): Promise<void> {
		return Promise.resolve();
	}

	public dispose(): Promise<void> {
		return Promise.resolve();
	}

	public onUpdate(listener: (delta: string[]) => void) {
	}
}


let depContainer: DependencyContainer;

describe('CacheAddOn', function () {
	// this.timeout(60000);

	beforeEach(() => {
		depContainer = new DependencyContainer();
	});

	afterEach(() => {
		depContainer.dispose();
	});


	describe('init', () => {
		it('should use local cache only if no server is provided', async () => {
			// Arrange
			const cacheAddOn = new CacheAddOn(new MockConfigAddOn(null), depContainer);

			// Act
			await cacheAddOn.init();

			// Assert
			expect(cacheAddOn['_cacheProvider']).to.exist;
			expect(cacheAddOn['_cacheProvider']['_engine']).not.to.exist;

			// Clean up
			await cacheAddOn.dispose();
		});

		it('should connect to single server', async () => {
			// Arrange
			let cacheAddOn = new CacheAddOn(new MockConfigAddOn('single'), depContainer);

			// Act
			await cacheAddOn.init();

			// Assert
			let cacheProvider = depContainer.resolve<CacheProvider>(T.CACHE_PROVIDER);
			expect(cacheProvider['_options'].single).to.exist;
			expect(cacheProvider['_options'].single.host).to.equal('localhost');
			expect(cacheProvider['_options'].single.port).to.equal('6379');
			expect(cacheProvider['_options'].cluster).not.to.exist;

			// Clean up
			await cacheAddOn.dispose();
		});
		
		// it('should connect to cluster of servers', async () => {
		// 	// Arrange
		// 	let cacheAddOn = new CacheAddOn(new MockConfigAddOn('cluster'), depContainer);

		// 	// Act
		// 	await cacheAddOn.init();

		// 	// Assert
		// 	let cacheProvider = depContainer.resolve<CacheProvider>(T.CACHE_PROVIDER);
		// 	expect(cacheProvider['_options'].cluster).to.exist;
		// 	expect(cacheProvider['_options'].cluster.length).to.be.equal(2);
		// 	expect(cacheProvider['_options'].single).not.to.exist;

		// 	// Clean up
		// 	await cacheAddOn.dispose();
		// });
	}); // END describe 'init'


	describe('dispose', () => {
		it('should call cacheProvider.dispose', async () => {
			// Arrange
			let cacheAddOn = new CacheAddOn(new MockConfigAddOn('single'), depContainer);
			
			await cacheAddOn.init();
			let disconnectSpy = chai.spy.on(cacheAddOn['_cacheProvider'], 'dispose');

			// Act
			await cacheAddOn.dispose();

			// Assert
			expect(disconnectSpy).to.be.spy;
			expect(disconnectSpy).to.have.been.called.once;
		});
	}); // END describe 'dispose'


	describe('deadLetter', () => {
		it('should resolve (for now)', async () => {
			// Arrange
			let cacheAddOn = new CacheAddOn(new MockConfigAddOn('single'), depContainer);

			// Act
			await cacheAddOn.deadLetter();
		});
	}); // END describe 'deadLetter'
});