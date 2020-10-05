import alias from '@rollup/plugin-alias'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import babel from '@rollup/plugin-babel'
import { terser } from 'rollup-plugin-terser'

const path = require('path')

const plugins = [
  alias({
    entries: [
      {
        find: '~',
        replacement: path.resolve(__dirname, 'src')
      }
    ]
  }),
  resolve(),
  commonjs()
]

const baseConfig = {
  input: 'src/index.js'
}

export default [
  // EMS Module
  {
    ...baseConfig,
    output: [{
      format: 'es',
      file: 'dist/dom-factory.esm.js'
    }],
    plugins
  },

  // SSR build.
  {
    ...baseConfig,
    output: {
      format: 'cjs',
      file: 'dist/dom-factory.common.js'
    },
    plugins
  },

  // UMD Browser
  {
    ...baseConfig,
    output: {
      format: 'umd',
      name: 'domFactory',
      file: 'dist/dom-factory.js'
    },
    plugins: [
      ...plugins,
      babel({
        babelHelpers: 'bundled',
        skipPreflightCheck: true,
        exclude: 'node_modules/**'
      }),
      terser()
    ]
  }
]