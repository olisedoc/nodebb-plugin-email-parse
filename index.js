'use strict'

var MarkdownIt = require('markdown-it');
var url = require('url');
var async = require('async');

var nconf = require.main.require('nconf');

var	parser;

var EmailParse = {
	config: {},
	onLoad: function () {
		EmailParse.init();
    },
    
    init: function () {
		// Load saved config
		var	_self = this;
		var defaults = {
			html: false,
			xhtmlOut: true,
			breaks: true,
			langPrefix: 'language-',
			linkify: true,
            typographer: false,
            externalBlank: true,
		};

        parser = new MarkdownIt(_self.config);
        EmailParse.updateParserRules(parser);
    },
    
    parsePost: function (data, callback) {
		async.waterfall([
			function (next) {
				if (data && data.postData && data.postData.content && parser) {
					data.postData.content = parser.render(data.postData.content);
				}
				next(null, data);
			},
			//async.apply(EmailParse.postParse),
		], callback);
    },
    
    updateParserRules: function (parser) {

		// Update renderer to add some classes to all images
		var renderImage = parser.renderer.rules.image || function (tokens, idx, options, env, self) {
			return self.renderToken.apply(self, arguments);
		};
		var renderLink = parser.renderer.rules.link_open || function (tokens, idx, options, env, self) {
			return self.renderToken.apply(self, arguments);
		};
		var renderTable = parser.renderer.rules.table_open || function (tokens, idx, options, env, self) {
			return self.renderToken.apply(self, arguments);
		};

		parser.renderer.rules.image = function (tokens, idx, options, env, self) {
			var classIdx = tokens[idx].attrIndex('class');
			var srcIdx = tokens[idx].attrIndex('src');

			// Validate the url
			if (!EmailParse.isUrlValid(tokens[idx].attrs[srcIdx][1])) { return ''; }

			if (classIdx < 0) {
				tokens[idx].attrPush(['class', 'img-responsive img-markdown']);
			} else {
				tokens[idx].attrs[classIdx][1] += ' img-responsive img-markdown';
			}

			return renderImage(tokens, idx, options, env, self);
		};

		parser.renderer.rules.link_open = function (tokens, idx, options, env, self) {
			// Add target="_blank" to all links
			var targetIdx = tokens[idx].attrIndex('target');
			var relIdx = tokens[idx].attrIndex('rel');
			var hrefIdx = tokens[idx].attrIndex('href');

			if (EmailParse.isExternalLink(tokens[idx].attrs[hrefIdx][1])) {
				if (EmailParse.config.externalBlank) {
					if (targetIdx < 0) {
						tokens[idx].attrPush(['target', '_blank']);
					} else {
						tokens[idx].attrs[targetIdx][1] = '_blank';
					}

					if (relIdx < 0) {
						tokens[idx].attrPush(['rel', 'noopener noreferrer']);
						relIdx = tokens[idx].attrIndex('rel');
					} else {
						tokens[idx].attrs[relIdx][1] = 'noopener noreferrer';
					}
				}
			}

			return renderLink(tokens, idx, options, env, self);
		};

		parser.renderer.rules.table_open = function (tokens, idx, options, env, self) {
			var classIdx = tokens[idx].attrIndex('class');

			if (classIdx < 0) {
				tokens[idx].attrPush(['class', 'table table-bordered table-striped']);
			} else {
				tokens[idx].attrs[classIdx][1] += ' table table-bordered table-striped';
			}

			return renderTable(tokens, idx, options, env, self);
		};

		plugins.fireHook('action:markdown.updateParserRules', parser);
	},

	isUrlValid: function (src) {
		/**
		 * Images linking to a relative path are only allowed from the root prefixes
		 * defined in allowedRoots. We allow both with and without relative_path
		 * even though upload_url should handle it, because sometimes installs
		 * migrate to (non-)subfolder and switch mid-way, but the uploads urls don't
		 * get updated.
		 */
		const allowedRoots = [nconf.get('upload_url'), '/uploads'];
		const allowed = pathname => allowedRoots.some(root => pathname.toString().startsWith(root) || pathname.toString().startsWith(nconf.get('relative_path') + root));

		try {
			var urlObj = url.parse(src, false, true);
			return !(urlObj.host === null && !allowed(urlObj.pathname));
		} catch (e) {
			return false;
		}
	},

	isExternalLink: function (urlString) {
		var urlObj;
		var baseUrlObj;
		try {
			urlObj = url.parse(urlString);
			baseUrlObj = url.parse(nconf.get('url'));
		} catch (err) {
			return false;
		}

		if (
			urlObj.host === null	// Relative paths are always internal links...
			|| (urlObj.host === baseUrlObj.host && urlObj.protocol === baseUrlObj.protocol	// Otherwise need to check that protocol and host match
			&& (nconf.get('relative_path').length > 0 ? urlObj.pathname.indexOf(nconf.get('relative_path')) === 0 : true))	// Subfolder installs need this additional check
		) {
			return false;
		}
		return true;
	},
};

module.exports = EmailParse;
