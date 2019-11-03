'use strict'

var md = require('markdown-it');
var emoji = require('markdown-it-emoji');
var url = require('url');
var async = require('async');

var nconf = require.main.require('nconf');
var winston = module.parent.require('winston');

var	parser;

var EmailParse = {
	config: {},
	onLoad: function (params, callback) {
        EmailParse.init();
        callback();
	},
	
	urlRegex : {
		regex: /href="([^"]+)"/g,
		length: 6,
	},

	imgRegex : {
		regex: /src="([^"]+)"/g,
		length: 5,
	},

	emojiRegex : {
		regex: /(:[\w_-]+: ?)/g
	},
    
    init: function () {
		// Load saved config
		var defaults = {
			html: false,
			xhtmlOut: true,
			breaks: true,
			langPrefix: 'language-',
			linkify: true,
            typographer: false,
            externalBlank: true,
		};

		parser = new md(defaults);
		parser.use(emoji)
    },
    
    parsePost: function (data, callback) {
		async.waterfall([
			function (next) {
				if (data && data.params && data.params.notification && parser) {
					data.params.body = parser.render(data.params.body);
				};
				next(null, data);
			},
			function (results, next) {
				if (results && results.params && results.params.notification && parser) {
					results.params.body = EmailParse.removeEmojiMarkup(results.params.body, EmailParse.emojiRegex);
				};
				next(null, results)
			},
			function (results, next) {
				if (results && results.params && results.params.notification && parser) {
					results.params.body = EmailParse.relativeToAbsolute(results.params.body, EmailParse.urlRegex);
				};
				next(null, results)
			},
			function (results, next) {
				if (results && results.params && results.params.notification && parser) {
					results.params.body = EmailParse.relativeToAbsolute(results.params.body, EmailParse.imgRegex);
				};
				next(null, results)
			}
		], callback);

	},

	relativeToAbsolute: function (content, regex) {
		// Turns relative links in post body to absolute urls
		var parsed;
		var current = regex.regex.exec(content);
		var absolute;
		while (current !== null) {
			if (current[1]) {
				try {
					parsed = url.parse(current[1]);
					if (!parsed.protocol) {
						if (current[1].startsWith('/')) {
							// Internal link
							absolute = nconf.get('base_url') + current[1];
						} else {
							// External link
							absolute = '//' + current[1];
						}

						content = content.slice(0, current.index + regex.length) + absolute + content.slice(current.index + regex.length + current[1].length);
					}
				} catch (err) {
					winston.verbose(err.messsage);
				}
			}
			current = regex.regex.exec(content);
		}

		return content;
	},

	removeEmojiMarkup: function (content, regex) {
		// removes emojis markup for looks
		var current = regex.regex.exec(content);
		if (content && current) {
			content = content.replace(regex.regex, '')
		}
	
		return content;
	}
};

module.exports = EmailParse;
