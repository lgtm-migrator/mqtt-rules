const read_directory = require('read-directory')
const EventEmitter = require('events')
const watch = require('watch')
const yaml = require('js-yaml')
const logging = require('homeautomation-js-lib/logging.js')
const _ = require('lodash')

var configs = []
var config_path = null

module.exports = new EventEmitter()

module.exports.load_path = function(in_path) {
	config_path = in_path
	// Watch Path
	watch.watchTree(config_path, function(f, curr, prev) {
		load_rule_config()
	})
}

module.exports.get_configs = function() {
	return configs
}

module.exports.set_override_configs = function(overrideConfigs) {
	configs = overrideConfigs
}

module.exports.ruleIterator = function(callback) {
	if (_.isNil(configs)) { 
		return
	}

	configs.forEach(function(config_item) {
		if (_.isNil(config_item)) {
			return 
		}

		Object.keys(config_item).forEach(function(key) {
			try {
				return callback(key, config_item[key])
			} catch (error) {
				logging.error('Failed callback for rule: ' + key)
			}
		}, this)
	}, this)
}

const print_rule_config = function() {
	if (_.isNil(configs)) { 
		return
	}

	configs.forEach(function(config_item) {
		if (_.isNil(config_item)) { 
			return 
		}

		Object.keys(config_item).forEach(function(key) {
			logging.debug(' Rule [' + key + ']')
		}, this)
	}, this)
}

const _load_rule_config = function() {
	logging.info(' => Really updating rules')
	read_directory(config_path, function(err, files) {
		configs = []

		logging.info('Loading rules at path: ' + config_path)
		if (err) {
			throw err
		}

		const fileNames = Object.keys(files)

		fileNames.forEach(file => {
			if (file.includes('._')) {
				return
			}
			if (file.includes('.yml') || file.includes('.yaml')) {
				logging.info(' - Loading: ' + file)
				const doc = yaml.safeLoad(files[file])
				const category_name = file.split('.')[0] + '_'
				if ( !_.isNil(doc)) {
					var namespacedRules = {}
					Object.keys(doc).forEach(rule_key => {
						const namespaced_key = category_name + rule_key
						namespacedRules[namespaced_key] = doc[rule_key]	
					})
					configs.push(namespacedRules)
				}
			} else {
				logging.info(' - Skipping: ' + file)
			}
		})

		logging.info('...done loading rules')
		print_rule_config()
		module.exports.emit('rules-loaded')
	})
}


const secondsToDefer = 5
var delayedUpdate = null
const load_rule_config = function() {
	logging.info('Updating rules (deferring for ' + secondsToDefer + ' seconds)')
	if ( !_.isNil(delayedUpdate)) {
		clearTimeout(delayedUpdate)
		delayedUpdate = null
	}
	delayedUpdate = _.delay(_load_rule_config, secondsToDefer * 1000)
}
