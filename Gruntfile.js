/* global module */
module.exports = function (grunt) {
    //get target from command line, e.g. "grunt build-deploy --target=stage"; defaults to "dev" if not provided on command line
    var target = grunt.option('target') || 'dev';
    //get host from target; if not dev or stage, user is prompted for host (assuming you have Bill's modified version of the scp grunt task)
    var host = target === 'dev' ? 'prometheus.est.vpn' :
        target === 'devpoke' ? 'estlapp02.geoplan.ufl.edu' :
        target === 'stage' ? 'hyperion.est.vpn' : 
        target === 'stagepoke' ? 'estlapp03.geoplan.ufl.edu' :
        target === 'preprod' ? 'pandora.est.vpn' :
        target === 'preprodpoke' ? 'estlapp04.geoplan.ufl.edu' :
        target === 'prod' ? 'calypso.est.vpn' :
        target === 'prodpoke' ? 'estlapp05.geoplan.ufl.edu' : 
        target === 'filegen06' ? 'estlapp06.geoplan.ufl.edu' : 
        target === 'filegen07' ? 'estlapp07.geoplan.ufl.edu' : 
        null;

    grunt.log.writeln ("target: " + target);
    
    // middleware for grunt.connect
    var middleware = function (connect, options, middlewares) {
        // inject a custom middleware into the array of default middlewares for proxy page
        var bodyParser = require('body-parser');
        var proxypage = require('proxypage');
        var proxyRe = /\/proxy\/proxy.ashx/i;

        var enableCORS = function (req, res, next) {
            res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
            res.setHeader('Access-Control-Allow-Credentials', true);
            res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
            res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Origin, X-Requested-With, Content-Type, Accept');
            return next();
        };

        var proxyMiddleware = function (req, res, next) {
            if (!proxyRe.test(req.url)) {
                return next();
            }
            proxypage.proxy(req, res);
        };

        middlewares.unshift(proxyMiddleware);
        middlewares.unshift(enableCORS);
        middlewares.unshift(bodyParser.json()); //body parser, see https://github.com/senchalabs/connect/wiki/Connect-3.0
        middlewares.unshift(bodyParser.urlencoded({extended: true})); //body parser
        return middlewares;
    };

    // grunt task config
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        // exec: {
        //     llc: {
        //         command: './layerLoaderConfigurator/LayerLoaderConfigurator.exe ' + target + ' .\\viewer\\js\\config\\layerLoader.js',
        //         sync: false
        //     }
        // },
        scp: {
            options: {
                host: host,
                readyTimeout: 60000
                //host: 'prometheus.est.vpn',
                //username: 'bill'
            },
            your_target: {
                files: [{
                    cwd: 'dist',
                    src: '**/*',
                    filter: 'isFile',
                    // path on the server
                    dest: '/var/www/map'
                }]
            },
        },
        tag: {
            banner: '/*  <%= pkg.name %>\n' +
                ' *  version <%= pkg.version %>\n' +
                ' *  Project: <%= pkg.homepage %>\n' +
                ' */\n'
        },
        copy: {
            build: {
                cwd: 'viewer',
                src: ['**','!**/*.mp4'],
                dest: 'dist',
                expand: true
            }
        },
        clean: {
            build: {
                src: ['dist']
            }
        },
        postcss: {
            build: {
                expand: true,
                cwd: 'dist',
                src: ['**/*.css'],
                dest: 'dist'
            }
        },
        cssmin: {
            build: {
                expand: true,
                cwd: 'dist',
                src: ['**/*.css'],
                dest: 'dist'
            }
        },

        stylelint: {
            build: {
                src: ['viewer/**/*.css', '!viewer/css/theme/**/*.css']
            }
        },

        eslint: {
            build: {
                src: ['viewer/**/*.js'],
                options: {
                    eslintrc: '.eslintrc'
                }
            }
        },

        uglify: {
            build: {
                files: [{
                    expand: true,
                    cwd: 'dist',
                    src: ['**/*.js', '!**/config/**', '!**/MultiPartHelper.js'],
                    dest: 'dist',
                    ext: '.js'
                }],
                options: {
                    banner: '<%= tag.banner %>',
                    sourceMap: true,
                    sourceMapIncludeSources: true,
                    compress: {
                        'drop_console': true
                    }
                }
            }
        },
        watch: {
            dev: {
                files: ['viewer/**'],
                tasks: ['eslint', 'stylelint']
            },
            build: {
                files: ['dist/**'],
                tasks: ['eshint', 'stylelint']
            }
        },
        connect: {
            dev: {
                options: {
                    port: 3000,
                    base: 'viewer',
                    hostname: '*',
                    protocol: 'https',
                    keepalive: true,
                    middleware: middleware
                }
            },
            build: {
                options: {
                    port: 3001,
                    base: 'dist',
                    hostname: '*',
                    protocol: 'https',
                    keepalive: true,
                    middleware: middleware
                }
            }
        },
        open: {
            'dev_browser': {
                path: 'https://localhost:3000/index.html'
            },
            'build_browser': {
                path: 'https://localhost:3001/index.html'
            }
        },
        compress: {
            build: {
                options: {
                    archive: 'dist/cmv-app.zip'
                },
                files: [{
                    expand: true,
                    cwd: 'dist',
                    src: ['**', '!**/dijit.css']
                }]
            }
        }
    });

    // load the tasks
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-postcss');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-stylelint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-newer');
    grunt.loadNpmTasks('grunt-open');
    grunt.loadNpmTasks('grunt-contrib-compress');
    grunt.loadNpmTasks('grunt-scp');

    // define the tasks
    grunt.registerTask('default', 'Watches the project for changes, automatically builds them and runs a web server and opens default browser to preview.', ['eslint', 'stylelint', 'connect:dev', 'open:dev_browser', 'watch:dev']);
    //original version, with compress, which we're not doing during development: 
    //grunt.registerTask('build', 'Compiles all of the assets and copies the files to the build directory.', ['clean', 'copy', 'scripts', 'stylesheets', 'compress']);
    grunt.registerTask('build', 'Compiles all of the assets and copies the files to the build directory.', [/*'layerLoaderJs',*/'clean', 'copy', 'scripts', 'stylesheets']); // we don't want to zip it, 'compress']);
    grunt.registerTask('build-view', 'Compiles all of the assets and copies the files to the build directory starts a web server and opens browser to preview app.', ['clean', 'copy', 'scripts', 'stylesheets', 'compress', 'connect:build', 'open:build_browser', 'watch:build']);
    grunt.registerTask('scripts', 'Compiles the JavaScript files.', ['eslint', 'uglify']);
    grunt.registerTask('stylesheets', 'Auto prefixes css and compiles the stylesheets.', ['stylelint', 'postcss', 'cssmin']);
    grunt.registerTask('lint', 'Run eslint and stylelint.', ['eslint', 'stylelint']);
    grunt.registerTask('build-deploy', 'Compiles all of the assets and copies the files to the dist folder, then deploys it. User is prompted for username and password.', [/*'layerLoaderJs',*/'clean', 'copy', 'scripts', 'stylesheets','scp']);
    grunt.registerTask('deploy', 'Deploys the dist folder. User is prompted for host (destination server), username and password.', ['scp']);
};
