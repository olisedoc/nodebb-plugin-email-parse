'use strict'

var md = require('markdown-it');
var emoji = require('markdown-it-emoji');
var url = require('url');
var async = require('async');
var htmlToText = require('html-to-text');
var _ = require('lodash');

var nconf = require.main.require('nconf');
var winston = module.parent.require('winston');
var translator = require.main.require('./public/src/modules/translator');

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

	htmlRegex : {
		regex: /<(br|basefont|hr|input|source|frame|param|area|meta|!--|col|link|option|base|img|wbr|!DOCTYPE).*?>|<(a|abbr|acronym|address|applet|article|aside|audio|b|bdi|bdo|big|blockquote|body|button|canvas|caption|center|cite|code|colgroup|command|datalist|dd|del|details|dfn|dialog|dir|div|dl|dt|em|embed|fieldset|figcaption|figure|font|footer|form|frameset|head|header|hgroup|h1|h2|h3|h4|h5|h6|html|i|iframe|ins|kbd|keygen|label|legend|li|map|mark|menu|meter|nav|noframes|noscript|object|ol|optgroup|output|p|pre|progress|q|rp|rt|ruby|s|samp|script|section|select|small|span|strike|strong|style|sub|summary|sup|table|tbody|td|textarea|tfoot|th|thead|time|title|tr|track|tt|u|ul|var|video).*?<\/\2>/g
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
		parser.use(emoji);
    },
    
    parsePost: function (data, callback) {
		async.waterfall([
			function (next) {
				if (data && data.params && data.params.notification && parser && !isHtmlParsed) {
					var isHtmlParsed = EmailParse.htmlRegex.regex.test(data.params.body);
					if (!isHtmlParsed) {
						data.params.body = parser.render(data.params.body);
					};
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

	modifySubject: function (data, callback) {
		async.waterfall([
			function (next) {
				if (data && data._raw.notification && data._raw.notification.bodyShort) {
					translator.translate(data._raw.notification.bodyShort, function (translated) {
						next(null, translated);
					});
				} else {
					next(null, false)
				}
			},
			function (results, next) {
				if (data && results) {
					data.subject = results;
				};
				next(null, data);
			},
			function (results, next) {
				if (results && results.subject) {
					results.subject = _.unescape(results.subject)
					results.subject = htmlToText.fromString(results.subject, {
						ignoreImage: true,
					});
				};
				next(null, results);
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
