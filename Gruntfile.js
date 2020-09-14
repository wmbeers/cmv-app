/* global module */
module.exports = function (grunt) {
    //get target from command line, e.g. "grunt build-deploy --target=stage"; defaults to "dev" if not provided on command line
    var target = grunt.option('target') || 'dev';
    //get host from target; if not dev or stage, user is prompted for host (assuming you have Bill's modified version of the scp grunt task)
    var host = target === 'dev' ? 'prometheus.est.vpn' :
        target === 'stage' ? 'hyperion.est.vpn' : 
        target === 'preprod' ? 'pandora.est.vpn' :
        target === 'prod' ? 'calypso.est.vpn' : null;
    var previouslyReviewed, 
        currentlyInReview,
        queryMmaLayer,
        queryDraftLayer;
    
    //get operationalLayers based on target
    //in our source it should always be dev (https://gemini.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Previously_Reviewed_Dev/MapServer and 
    //https://gemini.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_ETAT_Review_Dev/MapServer)
    //which will be replaced with the stage or prod version
    if (target === 'stage' || target === 'preprod') {
        previouslyReviewed = 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Previously_Reviewed_Stage/MapServer';
        currentlyInReview = 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_ETAT_Review_Stage/MapServer';
        queryMmaLayer = 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Query_MMA_Stage/MapServer/0';
        queryDraftLayer = 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Query_Drafts_Stage/MapServer/0';
    } else if (target === 'prod') {
        previouslyReviewed = 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Previously_Reviewed_Prod/MapServer';
        currentlyInReview = 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_ETAT_Review_Prod/MapServer';
        queryMmaLayer = 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Query_MMA_Prod/MapServer/0';
        queryDraftLayer = 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Query_Drafts_Prod/MapServer/0';
    }
    grunt.log.writeln ("target: " + target);
    grunt.log.writeln ("previouslyReviewed: " + previouslyReviewed);
    grunt.log.writeln ("currentlyInReview: " + currentlyInReview);
    grunt.log.writeln ("queryMmaLayer: " + queryMmaLayer);
    grunt.log.writeln ("queryDraftLayer: " + queryDraftLayer);
    
    // middleware for browserSync
    var bodyParser = require('body-parser');
    var middleware = [
        function (req, res, next) {
            var proxypage = require('proxypage');
            var proxyRe = /\/proxy\/proxy.ashx/i;
            if (!proxyRe.test(req.url)) {
                return next();
            }
            proxypage.proxy(req, res);
        },
        bodyParser.json(),
        bodyParser.urlencoded({extended: true})
    ];

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
                            pattern: 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Previously_Reviewed_Dev/MapServer',
                            replacement: previouslyReviewed
                        },
                        {
                            pattern: 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_ETAT_Review_Dev/MapServer',
                            replacement: currentlyInReview
                        },
                        {
                            pattern: 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Query_MMA_Dev/MapServer/0',
                            replacement: queryMmaLayer
                        },
                        {
                            pattern: 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Query_Drafts_Dev/MapServer/0',
                            replacement: queryDraftLayer
                        }
                    ] //TODO need replacements for aoiLayers, also a way to read from DB
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
        browserSync: {
            dev: {
                bsFiles: {
                    src : ['viewer/**']
                },
                options: {
                    cors: true,
                    https: true,
                    middleware: middleware,
                    port: 3000,
                    server: 'viewer',
                    ui: {
                        port: 3002
                    },
                    watchTask: true
                }
            },
            build: {
                bsFiles: {
                    src : ['dist/**']
                },
                options: {
                    cors: true,
                    https: true,
                    port: 3001,
                    server: 'dist',
                    ui: {
                        port: 3003
                    },
                    watchTask: true
                }
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
    grunt.loadNpmTasks('grunt-browser-sync');
    grunt.loadNpmTasks('grunt-contrib-compress');
    grunt.loadNpmTasks('grunt-scp');
    grunt.loadNpmTasks('grunt-string-replace');
    //grunt.loadNpmTasks('grunt-exec');

    // define the tasks
    grunt.registerTask('default', 'Watches the project for changes, automatically builds them and runs a web server and opens default browser to preview.', ['eslint', 'stylelint', 'browserSync:dev', 'watch:dev']);
    grunt.registerTask('build', 'Compiles all of the assets and copies the files to the build directory.', [/*'layerLoaderJs',*/'clean', 'copy', 'scripts', 'stylesheets']); // we don't want to zip it, 'compress']);
    grunt.registerTask('build-view', 'Compiles all of the assets and copies the files to the build directory starts a web server and opens browser to preview app.', ['clean', 'copy', 'scripts', 'stylesheets', 'compress', 'browserSync:build', 'watch:build']);
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
