## VERSIONS

### 1.1.5
- Removed script "postinstall" from `package.json`.

### 1.1.4
- Upgraded dependencies.
- Improved lint rules.

### 1.1.3
- Fixed node engine version in package.json.
- Refactor to replace `let` with `const`.
- Replace `Bluebird's Promise.promisify` with native `util.promisify`.

### 1.1.0
  - Added **CacheAddOn**.

### 1.0.0
* **CacheProvider** can:
  - Only works with single cache server (cluster coming soon).
  - Read/write primitive values (string, number, boolean).
  - Read/write flat objects (no nested properties).
  - Read/write arrays of arbitrary types and structures (including nested objects).