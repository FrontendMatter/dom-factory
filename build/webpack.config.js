var path = require('path')
var WebpackConfig = require('webpack-config-api')
var config = new WebpackConfig()
	.addFileExtension('js')
	.register('babel', require('webpack-config-api/extensions/babel')).use('babel')
	.register('eslint', require('webpack-config-api/extensions/eslint')).use('eslint')
	.withStandaloneEntry('dom-factory')
	.withLibrary('domFactory')

module.exports = config