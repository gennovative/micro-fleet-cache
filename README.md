# Micro Fleet - Backend Cache library

Belongs to Micro Fleet framework, provides utility class to read and write from/to local or remote cache service, as well as keep sync between them.

See more examples and usage guide in unit test.

## INSTALLATION

- Stable version: `npm i @micro-fleet/cache`
- Edge (development) version: `npm i git@github.com:gennovative/micro-fleet-cache.git`

## DEVELOPMENT

- Install packages in `peerDependencies` section with command `npm i --no-save {package name}@{version}`
- `npm run build` to transpile TypeScript then run unit tests (if any) (equiv. `npm run compile` + `npm run test` (if any)).
- `npm run compile`: To transpile TypeScript into JavaScript.
- `npm run watch`: To transpile without running unit tests, then watch for changes in *.ts files and re-transpile on save.
- `npm run test`: To run unit tests.
  * After tests finish, open file `/coverage/index.html` with a web browser to see the code coverage report which is mapped to TypeScript code.

## RELEASE

- `npm run release`: To transpile and create `app.d.ts` definition file.
- **Note:** Please commit transpiled code in folder `dist` and definition file `app.d.ts` relevant to the TypeScript version.