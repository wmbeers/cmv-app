/* global module */
module.exports = function (grunt) {
    //get target from command line, e.g. "grunt build-deploy --target=stage"; defaults to "dev" if not provided on command line
    var target = grunt.option('target') || 'dev';
    //get host from target; if not dev or stage, user is prompted for host (assuming you have Bill's modified version of the scp grunt task)
    var host = target === 'dev' ? 'prometheus.est.vpn' :
        target === 'stage' ? 'hyperion.est.vpn' : 
        target === 'preprod' ? 'pandora.est.vpn' :
        target === 'prod' ? 'calypso.est.vpn' : null;
    //get operationalLayers based on target
    //in our source it should always be dev (https://gemini.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Previously_Reviewed_Dev/MapServer and 
    //https://gemini.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_ETAT_Review_Dev/MapServer)
    //which will be replaced with the stage or prod version
    var previouslyReviewed = 
        (target === 'stage' || target === 'preprod') ? 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Previously_Reviewed_Stage/MapServer' :
        target === 'prod' ? 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Previously_Reviewed_Prod/MapServer' : null;
    var currentlyInReview = 
        (target === 'stage' || target === 'preprod') ? 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_ETAT_Review_Stage/MapServer' :
        target === 'prod' ? 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_ETAT_Review_Prod/MapServer' : null;
    var queryLayer = 
        (target === 'stage' || target === 'preprod') ? 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Query_MMA_Stage/MapServer/0' :
        target === 'prod' ? 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Query_MMA_Prod/MapServer/0' : null;

    grunt.log.writeln ("target: " + target);
    grunt.log.writeln ("previouslyReviewed: " + previouslyReviewed);
    grunt.log.writeln ("currentlyInReview: " + currentlyInReview);
    
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
                host: host
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
        'string-replace': {
            operationalLayers: {
                files: {
                    'dist/js/config/viewer.js': 'viewer/js/config/viewer.js',
                    'dist/js/config/projects.js': 'viewer/js/config/projects.js'
                },
                options: {
                    replacements: [
                        {
                            pattern: 'https://gemini.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Previously_Reviewed_Dev/MapServer',
                            replacement: previouslyReviewed
                        },
                        {
                            pattern: 'https://gemini.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_ETAT_Review_Dev/MapServer',
                            replacement: currentlyInReview
                        },
                        {
                            pattern: 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Query_MMA_Dev/MapServer/0',
                            replacement: queryLayer
                        }
                    ]
                }
            }
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
                src: ['**'],
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
                    src: ['**/*.js', '!**/config/**'],
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
    grunt.loadNpmTasks('grunt-string-replace');
    //grunt.loadNpmTasks('grunt-exec');

    // define the tasks
    //grunt.registerTask('layerLoaderJs','exec');
    grunt.registerTask('default', 'Watches the project for changes, automatically builds them and runs a web server and opens default browser to preview.', ['eslint', 'stylelint', 'connect:dev', 'open:dev_browser', 'watch:dev']);
    grunt.registerTask('build', 'Compiles all of the assets and copies the files to the build directory.', [/*'layerLoaderJs',*/'clean', 'copy', 'scripts', 'stylesheets']); // we don't want to zip it, 'compress']);
    grunt.registerTask('build-view', 'Compiles all of the assets and copies the files to the build directory starts a web server and opens browser to preview app.', ['clean', 'copy', 'scripts', 'stylesheets', 'compress', 'connect:build', 'open:build_browser', 'watch:build']);
    grunt.registerTask('scripts', 'Compiles the JavaScript files.', ['eslint', 'uglify']);
    grunt.registerTask('stylesheets', 'Auto prefixes css and compiles the stylesheets.', ['stylelint', 'postcss', 'cssmin']);
    grunt.registerTask('lint', 'Run eslint and stylelint.', ['eslint', 'stylelint']);
    grunt.registerTask('build-deploy', 'Compiles all of the assets and copies the files to the dist folder, then deploys it. User is prompted for username and password.', [/*'layerLoaderJs',*/'clean', 'copy', 'operationalLayers', 'scripts', 'stylesheets','scp']);
    grunt.registerTask('deploy', 'Deploys the dist folder. User is prompted for host (destination server), username and password.', ['scp']);
    grunt.registerTask('operationalLayers', function() {
        if (target === 'stage' || target === 'preprod' || target === 'prod') {
            grunt.task.run(['string-replace']);
        } else {
            grunt.log.write('Skipping string-replace');
        }
    });
};
