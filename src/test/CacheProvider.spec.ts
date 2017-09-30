import { expect } from 'chai';
import * as redis from 'redis';

import { CacheProvider, CacheLevel } from '../app';


const KEY = 'TESTKEY';

let cache: CacheProvider;

describe('CacheProvider (single)', function () {
	this.timeout(10000);

	beforeEach(() => {
		cache = new CacheProvider({
			single: {
				host: 'localhost'
			}
		});
	});

	afterEach(async () => {
		await cache.delete(KEY);
		await cache.dispose();
		cache = null;
	});

	describe('setPrimitive', () => {
		it('Should save a value locally only', async () => {
			// Arrange
			let valueOne = 'saved locally',
				valueTwo = 'saved remotely',
				client = redis.createClient({
					host: 'localhost'
				});

			// Act
			await client['setAsync'](KEY, valueTwo);
			await cache.setPrimitive(KEY, valueOne, null, CacheLevel.LOCAL);

			// Assert: Local value is different than remote value
			expect(cache['_localCache'][KEY]).to.equal(valueOne);
			expect(cache['_cacheTypes'][KEY]).to.exist;

			let remote = await cache.getPrimitive(KEY, true); // Skip local cache
			expect(remote).to.equal(valueTwo);

			// Clean up
			client.quit();
		});

		it('Should save a value remote only', async () => {
			// Arrange
			let value = 'saved remotely';

			// Act
			await cache.setPrimitive(KEY, value, null, CacheLevel.REMOTE);

			// Assert: Local value does not exist
			expect(cache['_localCache'][KEY]).not.to.exist;
			expect(cache['_cacheExps'][KEY]).not.to.exist;
			expect(cache['_cacheTypes'][KEY]).to.exist;
			
			// Assert: Remote value exists
			let refetch = await cache.getPrimitive(KEY, true); // Skip local cache
			expect(refetch).to.equal(value);
		});

		it('Should save a value both remotely and locally', async () => {
			// Arrange
			let value = 'I am everywhere';

			// Act
			await cache.setPrimitive(KEY, value, null, CacheLevel.BOTH);

			// Assert: Remote and local values are the same
			let remote = await cache.getPrimitive(KEY, true), // Skip local cache
				local = cache['_localCache'][KEY];
			expect(remote).to.equal(local);
			expect(cache['_cacheTypes'][KEY]).to.exist;
		});

		it('Should save a value then expire locally', (done) => {
			// Arrange
			let value = 'a local string',
				SECONDS = 1;

			// Act
			cache.setPrimitive(KEY, value, SECONDS, CacheLevel.LOCAL)
				.then(() => {
					setTimeout(async () => {
						// Assert
						let refetch = await cache.getPrimitive(KEY, false);
						if (refetch) {
							console.log('Refetch:', refetch);
						}
						expect(refetch).not.to.exist;
						done();
					}, 1100); // Wait until key expires
				});

		});

		it('Should save a value then expire remotely', (done) => {
			// Arrange
			let value = 'a local string',
				SECONDS = 1;

			// Act
			cache.setPrimitive(KEY, value, SECONDS, CacheLevel.REMOTE)
				.then(() => {
					setTimeout(async () => {
						// Assert
						let refetch = await cache.getPrimitive(KEY, true);
						if (refetch) {
							console.log('Refetch:', refetch);
						}
						expect(refetch).not.to.exist;
						done();
					}, 1100); // Wait until key expires
				});

		});

		it('Should save a value then expire both locally and remotely', (done) => {
			// Arrange
			let value = 'a local string',
				SECONDS = 1;

			// Act
			cache.setPrimitive(KEY, value, SECONDS, CacheLevel.BOTH)
				.then(() => {
					setTimeout(async () => {
						// Assert
						let remote = await cache.getPrimitive(KEY, true),
							local = cache['_localCache'][KEY];
						if (remote || local) {
							console.log('Remote:', remote);
							console.log('Local:', local);
						}
						expect(remote).not.to.exist;
						expect(local).not.to.exist;
						done();
					}, 1100); // Wait until key expires
				});

		});

		it('Should save a value then keep sync', (done) => {
			// Arrange
			let valueOne = 'a test string',
				valueTwo = 'another string',
				client = redis.createClient({
					host: 'localhost'
				});

			// Act
			cache.setPrimitive(KEY, valueOne, 0, CacheLevel.BOTH)
				.then(async () => {
					await client['setAsync'](KEY, valueTwo);
					client.quit();
				})
				.then(() => {
					setTimeout(async () => {
						// Assert
						let refetch = cache['_localCache'][KEY];
						expect(refetch).to.equal(valueTwo);
						done();
					}, 1000); // Wait a bit then check again.
				});
		});
	}); // describe 'setPrimitive'


	describe('getPrimitive', () => {
		it('Should get string value', async () => {
			// Arrange
			let value = 'a test string';
			await cache.setPrimitive(KEY, value);

			// Act
			let refetch = await cache.getPrimitive(KEY, true, true);

			// Assert
			expect(refetch).to.equal(value);
			expect(typeof refetch).to.equal('string');
		});

		it('Should get number value as string', async () => {
			// Arrange
			let value = 123;
			await cache.setPrimitive(KEY, value);

			// Act
			const PARSE = false;
			let refetch = await cache.getPrimitive(KEY, true, PARSE);

			// Assert
			expect(refetch).to.equal(value + '');
			expect(typeof refetch).to.equal('string');
		});

		it('Should get number value as number', async () => {
			// Arrange
			let value = 123;
			await cache.setPrimitive(KEY, value);

			// Act
			const PARSE = true;
			let refetch = await cache.getPrimitive(KEY, true, PARSE);

			// Assert
			expect(refetch).to.equal(value);
			expect(typeof refetch).to.equal('number');
		});

		it('Should get boolean value as string', async () => {
			// Arrange
			let value = true;
			await cache.setPrimitive(KEY, value);

			// Act
			const PARSE = false;
			let refetch = await cache.getPrimitive(KEY, true, PARSE);

			// Assert
			expect(refetch).to.equal(value + '');
			expect(typeof refetch).to.equal('string');
		});

		it('Should get boolean value as boolean', async () => {
			// Arrange
			let value = true;
			await cache.setPrimitive(KEY, value);

			// Act
			const PARSE = true;
			let refetch = await cache.getPrimitive(KEY, true, PARSE);

			// Assert
			expect(refetch).to.equal(value);
			expect(typeof refetch).to.equal('boolean');
		});
	}); // describe 'getPrimitive'


	describe('setObject', () => {
		it('Should save an object locally only', async () => {
			// Arrange
			let objOne = {
					name: 'Local Gennova',
					age: 55
				},
				objTwo = {
					address: 'A remote galaxy',
					since: 2017
				},
				client = redis.createClient({
					host: 'localhost'
				});

			// Act
			await client['hmsetAsync'](KEY, objTwo);
			await cache.setObject(KEY, objOne, null, CacheLevel.LOCAL);

			// Assert: Local value is different than remote value
			expect(cache['_localCache'][KEY]).to.deep.equal(objOne);
			expect(cache['_cacheTypes'][KEY]).to.exist;

			let remote = await cache.getObject(KEY, true); // Skip local cache
			expect(remote).to.deep.equal(objTwo);

			// Clean up
			client.quit();
		});

		it('Should save an object remote only', async () => {
			// Arrange
			let obj = {
					name: 'Remote Gennova',
					age: 99
				};

			// Act
			await cache.setObject(KEY, obj, null, CacheLevel.REMOTE);

			// Assert: Local value does not exist
			expect(cache['_localCache'][KEY]).not.to.exist;
			expect(cache['_cacheExps'][KEY]).not.to.exist;
			expect(cache['_cacheTypes'][KEY]).to.exist;

			// Assert: Remote value exists
			let refetch = await cache.getObject(KEY, true); // Skip local cache
			expect(refetch).to.deep.equal(obj);
		});

		it('Should save an object both remotely and locally', async () => {
			// Arrange
			let obj = {
					name: 'Gennova everywhere',
					age: 124
				};

			// Act
			await cache.setObject(KEY, obj, null, CacheLevel.BOTH);

			// Assert: Remote and local values are the same
			let remote = await cache.getObject(KEY, true), // Skip local cache
				local = cache['_localCache'][KEY];
			expect(remote).to.deep.equal(local);
			expect(cache['_cacheTypes'][KEY]).to.exist;
		});

		it('Should save an object then keep sync', (done) => {

			// Arrange
			let objOne = {
					name: 'Sync Gennova',
					age: 987
				},
				objTwo = {
					address: 'The middle of nowhere',
					since: 2017
				},
				client = redis.createClient({
					host: 'localhost'
				});

			// Act
			cache.setObject(KEY, objOne, null, CacheLevel.BOTH)
				.then(async () => {
					await client.multi().del(KEY).hmset(KEY, objTwo)['execAsync']();
					client.quit();
				})
				.then(() => {
					setTimeout(async () => {
						// Assert
						let refetch: any = cache['_localCache'][KEY];
						expect(refetch.name).not.to.exist;
						expect(refetch.age).not.to.exist;
						expect(refetch).to.deep.equal(objTwo);
						done();
					}, 1000); // Wait a bit then check again.
				});
		});
	}); // describe 'setObject'
});