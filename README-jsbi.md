# BigDecimal.js (JSBI port)

```sh
# wrap every `bigint` expression by `__BIGINT__` call so that following codemod can idententify them syntactically
node -r esbuild-register misc/codemod-label-bigint.ts src/bigdecimal.ts src/bigdecimal-label-bigint.ts

# replace bigint with JSBI
node -r esbuild-register misc/codemod-jsbi.ts src/bigdecimal-label-bigint.ts src/bigdecimal-jsbi.ts

# bundle with jsbi
pnpm compile:jsbi

# test (sqrt.js/pow.js are significantly slow)
npx mocha --parallel --timeout 0 --require source-map-support/register 'test/**/*.js' -g 'TAG_SLOW' --invert
```

## references

- https://github.com/GoogleChromeLabs/jsbi
- https://github.com/facebook/jscodeshift
- https://astexplorer.net/
