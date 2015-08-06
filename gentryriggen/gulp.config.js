module.exports = function() {
	var bower = {
            json: require('./bower.json'),
            directory: 'bower_components',
            ignorePath: '../..'
        },
        indexPath = './',
		client = 'client',
        src = client + '/app',
		styles = src + '/styles',
		temp = client + '/.tmp',
		dist = client + '/dist';
	
	var config = {
		allJs: [
			src + '/**/*.js',
        	client +'/*.js'
		],
        bower: bower,
		dist: dist,
		css: [
			styles + '/**/*.css'
		],
		htmlTemplates: src + '/**/*.html',
		indexPath: indexPath,
		indexTemplate: indexPath + '/index-template.cshtml',
		index: indexPath + '/index.cshtml',
		js: [
			src + '/app.js',
            src + '/app.config.js',
			src + '/**/*.js'
		],
		sass: styles + '/*.scss',
		src: src,
		styles: styles,
		temp: temp,
		templateCache: {
			file: 'templates.js',
			options: {
				module: 'partyUp',
				standAlone: false
			}
		}
	};
	
	config.getWiredepDefaultOptions = function() {
		var options = {
			bowerJson: config.bower.json,
            directory: config.bower.directory,
            ignorePath: config.bower.ignorePath
		};
		return options;
	};
	
	return config;
};