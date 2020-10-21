define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/Dialog',
    'dijit/ConfirmDialog',
    'dojo/request',
    'dojo/_base/lang',
    'dojo/on',
    'dojo/query',
    'dojo/dom',
    'dojo/dom-class',
    'dojo/html',
    'dojo/topic',
    'dojo/store/Memory',
    'dojo/Deferred',

    'dojo/text!./LayerLoader/templates/layerLoaderSidebar.html', // template for the widget in left panel, and some dialogs
    'dojo/text!./LayerLoader/templates/layerLoaderDialog.html', // template for the resource layer broswer dialog
    'dojo/text!./LayerLoader/templates/searchResultsDialog.html', // template for the layer search results

    './js/config/layerLoader.js',
    
    //jquery and jqueryUI, and custom ko Bindings needed for expandable categories
    'jquery',
    'jqueryUi',
    'koBindings',

    'dijit/form/Form',
    'dijit/form/FilteringSelect',
    'dijit/form/CheckBox',
    'dijit/form/ValidationTextBox',
    'dijit/form/TextBox',

    'xstyle/css!./LayerLoader/css/layerLoader.css'
],
function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Dialog, ConfirmDialog, request, lang, on, query, dom,
    domClass, html, topic, Memory, Deferred, layerLoaderSidebarTemplate, layerLoaderDialogTemplate, searchResultsDialogTemplate,
    layerConfig
) {
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        widgetsInTemplate: true,
        templateString: layerLoaderSidebarTemplate,
        topicID: 'layerLoader',
        baseClass: 'layerLoader',
        map: this.map,

        //Dialogs. Broader scope needed for these dialogs to support closing when option is selected, so declaring these here
        layerBrowserDialog: null,
        searchResultsDialog: null,

        //the category currently selected in the layer browser
        currentCategory: ko.observable(null),

        //the layer currently selected in the layer browser
        currentLayer: ko.observable(null),

        //the array of layerDefs and categories returned from searching
        searchResults: ko.observableArray(),

        //stores any errors that happen during search
        searchResultsError: ko.observable(null),

        //boolean flag for storing whether user wants detailed search results, or just layer/category names
        showDetails: ko.observable(true),

        //flattened list of all categories, used for loading saved maps with references to dynamic map services
        allCategories: [],

        searching: false,

        postCreate: function () {
            this.inherited(arguments);
            var self = this; //needed to maintain context within the validator function and onchange event handler

            this.searchNode.validator = function (value) {
                var hasProblem = self.searching && ko.utils.isNullOrWhiteSpace(value);
                self.searching = false; //gets set back to true in handleSearch
                return !hasProblem;
            };

            //copy categories and layerDefs from layerConfig, now that we're not passing it in as options
            this.categories = layerConfig.categories;
            this.layerDefs = layerConfig.layerDefs;

            //put a reference to layerDefs on map so savedmaps widget can read the same
            //note that this means savemaps is dependent on this widget, but that's ok
            this.map.layerDefs = this.layerDefs;
            
            //computeds that refers to "self"/"this" have to be added here, not in root constructor
            self.mapServiceSearchResults = ko.pureComputed(function () {
                return ko.utils.arrayFilter(self.searchResults(), function (x) {
                    return x.type === 'dynamic' && x.layerDefs && x.layerDefs.length > 0;
                });
            });

            self.featureLayerSearchResults = ko.pureComputed(function () {
                return ko.utils.arrayFilter(self.searchResults(), function (x) {
                    return x.type === 'feature';
                });
            });

            self.searchResultsCount = ko.pureComputed(function () {
                if (self.mapServiceSearchResults().length === 0 && self.featureLayerSearchResults().length === 0) {
                    return 'No results found';
                }
                var s = [];
                if (self.mapServiceSearchResults().length === 1) {
                    s.push('one topic');
                } else if (self.mapServiceSearchResults().length > 1) {
                    s.push(self.mapServiceSearchResults().length + ' topics');
                }
                if (self.featureLayerSearchResults().length === 1) {
                    s.push('one layer');
                } else if (self.featureLayerSearchResults().length > 1) {
                    s.push(self.featureLayerSearchResults().length + ' layers');
                }
                return 'Found ' + s.join(' and ');
            });

            this._initializeDialogs();
        },

        startup: function () {
            this.inherited(arguments);

            this.searchNode.focus(); //hacky way of fixing the problem of the validation icon not showing up if the first thing the user does is click the search button; by forcing focus here it somehow causes dojo to handle validation correctly.

            //let the application know we're done starting up
            topic.publish('layerLoader/startupComplete');
        },

        /**
         * Called from postCreate, initializes the layer browser dialog, post-processes layerDefs from config/layerLoader.js
         * @returns {void}
         */
        _initializeDialogs: function () {
            //layer browser dialog
            this.layerBrowserDialog = new Dialog({
                id: 'layerloader_browser_dialog',
                title: 'Layer Browser',
                content: layerLoaderDialogTemplate,
                style: 'width: 90%; height: 75%'
            });

            //post-process layerDefs
            this.layerDefs.forEach(function (layerDef) {
                //root in this context is the LayerLoader widget, passed as the "this" to the forEach. "this" looses context in the computeds, so redefining here
                var root = this; // eslint-disable-line consistent-this

                //function called when user clicks Add to Map, passes the request on to _LayerLoadMixin.addLayerFromLayerDef, passing reference to the layerDef
                layerDef.loadLayer = function () {
                    layerDef.loadPending(true);
                    topic.publish('layerLoader/addLayerFromLayerDef', this);
                };

                //function called when user clicks Remove from Map, passes the request on to _LayerLoadMixin.removeLayer, passing reference to the layer (why the layer? because the removeLayer function also works from layer control menus, which only know about layers)
                layerDef.removeLayer = function () {
                    if (layerDef.layer) {
                        topic.publish('layerLoader/removeLayer', layerDef.layer);
                    }
                };

                //for giving user feedback about when it is visible
                //TODO there's probably no reason for this to be computed, it won't change. As long as this is sorted out before ko.applyBindings, it could just be a simple assignment; or it could just be something we handle in creating layerDerfs.
                layerDef.scaleText = ko.computed(function () {
                    var scaleText = '';
                    var minScale = (layerDef.layer && layerDef.layer.minScale) ? layerDef.layer.minScale : (layerDef.minScale || 0);
                    var maxScale = (layerDef.layer && layerDef.layer.maxScale) ? layerDef.layer.maxScale : (layerDef.maxScale || 0);

                    if (minScale > 0) {
                        if (maxScale > 0) {
                            scaleText = 'Visible between 1:' + maxScale + ' and 1:' + minScale;
                        } else {
                            scaleText = 'Visible when zoomed in closer than 1:' + minScale;
                        }
                    } else if (maxScale > 0) {
                        scaleText = 'Visible when zoomed out beyond 1:' + maxScale;
                    }
                    return scaleText;
                });

                //shim the expanded/collapsed properties of a category so we can use the same ko template
                layerDef.expanded = ko.pureComputed(function () {
                    return false;
                });

                layerDef.collapsed = ko.pureComputed(function () {
                    return false;
                });

                //handles user clicking on a layer in the middle pane
                layerDef.select = function () {
                    root.currentLayer(layerDef);
                };
                layerDef.isSelected = ko.pureComputed(function () {
                    return root.currentLayer() === layerDef;
                });

                //set to true when the layer is loaded into the map
                layerDef.loaded = ko.observable(false);

                //set to true when the user requests it to be loaded into the map, before it actually gets loaded
                layerDef.loadPending = ko.observable(false);

                //TEMPORARY until we figure out if it's possible to load raster layers. Isn't supported in DnD, and I get "Output format not supported." error when I try to create RasterLayer
                layerDef.loadable = layerDef.type === 'feature';

                //cross-reference layerDefs to categories (so far, a given layer doesn't appear in more than one category, but we might do that in the future)
                //these are added in _processCategories
                layerDef.categories = [];

            }, this);

            //start the chain of post-processing categories to add knockout observables and functions
            this._processCategories(this);

            //apply knockout bindings
            ko.applyBindings(this, dom.byId('layerLoaderDialog'));

            //bindings appear to muck this up and set it to the last one
            this.currentCategory(this.categories[0]);

            //search results dialog (content added in search handler)
            this.searchResultsDialog = new Dialog({
                id: 'layerloader_search_dialog',
                title: 'Search Results',
                content: searchResultsDialogTemplate
            });

            //apply knockout bindings to search results
            ko.applyBindings(this, dom.byId('searchResultsDialog'));

        },

        /**
            * Called from postCreate via _intializeDialogs. Post-process categories to cross-reference layers and knockoutify
            * @returns {void}
            */
        _processCategories: function () {
            var root = this; // eslint-disable-line consistent-this

            //internal function to add layerDefs and functions; recursively called, starting
            //with the root model (this LayerLoader), then each root-level category, then subcategories
            function processCategories (parent) {

                //remove restricted services (categories) for which the user doesn't have a credential
                var i = parent.categories.length;
                while (i--) {
                    var cat = parent.categories[i];
                    if (cat.restricted) {
                        var credential = root.credentials.find(function (cred) { //eslint-disable-line no-loop-func
                            return cat.url && cat.url.indexOf(cred.server) === 0;
                        });
                        if (typeof credential === 'undefined') {
                            //restricted service, and we don't have a credential for the server the service is on
                            //drop it
                            parent.categories.splice(i, 1);
                        }
                    }
                }

                //parent.categories now should just have available (unrestricted, or restricted+credential) categories
                parent.categories.forEach(function (category) {
                    root.allCategories.push(category);
                    category.parent = parent === root ? null : parent;
                    category.layerDefs = category.layerIds.map(function (layerId) {
                        return root.layerDefs.find(function (l) {
                            return l.id === layerId;
                        });
                    }, this);

                    category.layerDefs.forEach(function (l) {
                        l.categories.push(category);
                    });

                    //not currently used, but this rolls up all layerDefs of this category and those of it's sub-categories.
                    category.allLayerDefs = [];

                    category.loadCategory = function () {
                        topic.publish('layerLoader/addCategory', category);
                        root.layerBrowserDialog.hide();
                    };

                    category.loadCategoryRecursive = function () {
                        topic.publish('layerLoader/addCategory', category, true);
                        root.layerBrowserDialog.hide();
                    };

                    //our template for "selectable" items is shared between categories and layerDefs
                    //so we bind the expand/collapsed icons based on separate, related properties, and 
                    //only show if there are sub-categories. 
                    //The layerDefs versions of these both return false.
                    category._expanded = ko.observable(false);

                    category.expanded = ko.pureComputed(function () {
                        return category.categories.length > 0 && category._expanded();
                    });

                    category.collapsed = ko.pureComputed(function () {
                        return category.categories.length > 0 && !category._expanded();
                    });

                    category.select = function () {
                        //expand it if not expanded, collapse it if it's already the current category
                        if (!category._expanded()) {
                            category._expanded(true);
                        } else if (root.currentCategory() === category) {
                            category._expanded(false);
                        }
                        //expand its parent
                        if (category.parent) {
                            category.parent._expanded(true);
                        }
                        root.currentCategory(category);
                        root.currentLayer(category.layerDefs.length > 0 ? category.layerDefs[0] : null);
                    };


                    category.isSelected = ko.pureComputed(function () {
                        return root.currentCategory() === category;
                    });

                    category.loadService = function () {
                        topic.publish('layerLoader/addLayerFromCategoryDef', category);
                        root.layerBrowserDialog.hide();
                        root.searchResultsDialog.hide();
                    };

                    if (category.categories && category.categories.length > 0) {
                        processCategories(category);
                    }

                }, this); // end forEach through available categories
            } // end processCategories inner function

            processCategories(this);
        },

        /**
         * Listen for the keyDown event in the search field, to detect when enter key is typed
         * @param {any} event the keyDown event
         * @returns {void}
         */
        handleSearchKeyDown: function (event) {
            if (event.keyCode === 13) {
                this.handleSearch();
            }
        },

        /**
         * Listen for the keyUp event in the Project field, to detect when enter key is typed
         * @param {any} event the keyUp event
         * @returns {void}
         */
        handleProjectKeyUp: function (event) {
            if (event.keyCode === 13) {
                this.addProject();
            }
        },

        /**
         * Adds the project/project-alt identified by the value entered in the projectAltId field.
         * @returns {void}
         */
        addProject: function () {
            //TODO: first a quick DWR call to check if user can see it (valid project, if draft then only show if user has draft access, etc.)
            //either do that here or in addProjectToMap function
            if (ko.utils.isNullOrWhiteSpace(this.projectAltId.value)) {
                topic.publish('growler/growlError', 'Please enter a project ID to add to the map');
                return;
            }
            topic.publish('layerLoader/addProjectToMap', this.projectAltId.value);
        },
  
        /**
         * Handles searching for layers and services, showing the search results.
         * @returns {void}
         */
        handleSearch: function () {
            var self = this; //solves the problem of "this" meaning something different in request callback handler
            self.searchResultsError(null);
            self.searchResults([]); //clear results
            if (ko.utils.isNullOrWhiteSpace(this.searchNode.displayedValue)) {
                this.searchNode.focus(); //put the cursor where we want the user to be
                this.searching = true; //let's the validator function (added in postCreate) know the user is trying to search w/o entering a value. Since this only happens in response to user typing enter, or clicking the search button, we don't have spurious null validation errors showing up if a user is just tabbing through.
                this.searchNode.validate(); //calls the validator function and adds the annotation.
                return; //bail
            }

            //eslint-disable-next-line no-useless-escape
            var encodedSearchTerms = encodeURIComponent(this.searchNode.displayedValue.replace(/([-\+\|\!\{\}\[\]\:\^\~\*\?\(\)])/g, '\\$1')); // escape solr special chars

            //SOLR query
            //should look like this for the search term land use:
            // /solr1/layers/select?indent=on&q=name:land%20use^10%20or%20longName:land%20use^10%20or%20description:land%20use%20or%20layerName:land%20use&wt=json

            //TODO: in the future we might have some restricted_yn=Y services that only some users can see. for now, if user has no map credentials (as ONLY happens on public site), assume
            //we filter on restricted=N

            var searchUrl = window.location.origin +
                '/solr1/layers/select?wt=json&q=(name:"' +
                encodedSearchTerms +
                '"^150+OR+longName:"' +
                encodedSearchTerms +
                '"^100+OR+description:"' +
                encodedSearchTerms +
                '"^50+OR+topic:"' +
                encodedSearchTerms +
                '"^75+OR+name:' +
                encodedSearchTerms +
                '+OR+longName:' +
                encodedSearchTerms +
                '+OR+description:' +
                encodedSearchTerms +
                '+OR+topic:' +
                encodedSearchTerms +
                ')';
            if (this.credentials.length === 0) {
                searchUrl += '+AND+restricted:N';
            }
            
            request(searchUrl).then(function (reply) {
                var resultDocs = JSON.parse(reply).response.docs;
                var searchResults = [];
                resultDocs.forEach(function (doc) {
                    //this business of checking if it's an array is because SOLR returns the type as an array. I don't think it should do that,
                    //and perhaps we can fix it, so I've added a test to see if it's an array with value 'category' as a work-around,
                    //and a test for simple string match if/when we do fix SOLR.
                    if (doc.type && (Array.isArray(doc.type) && doc.type.indexOf('category') >= 0) || doc.type === 'category') {
                        var cat = self.allCategories.find(function (c) {
                            return ('c' + c.id) === doc.id;
                        });
                        if (cat) {
                            searchResults.push(cat);
                        }
                    } else {
                        var lyr = self.layerDefs.find(function (ld) {
                            return ('l' + ld.id) === doc.id;
                        });
                        if (lyr) {
                            searchResults.push(lyr);
                        }
                    }
                });
                self.searchResults(searchResults);
                self.searchResultsDialog.show();
            }, function (err) {
                self.searchResultsError(err);
                self.searchResultsDialog.show();
            });
        },

        /**
            * Opens the layer browser dialog.
            * @returns {void}
            */
        browseLayers: function () {
            //resize to work around Dojo's auto-sizing limitations
            //it expects the content to have a fixed size, but we need it to be at least somewhat 
            //dynamic with regard to the size of the window
            var width = window.innerWidth * 0.85,
                height = window.innerHeight * 0.7,
                content = document.getElementById('layerLoaderDialog');

            content.setAttribute('style', 'width: ' + width + 'px; height: ' + height + 'px;');

            this.layerBrowserDialog.show();
                
        }

    });
});
