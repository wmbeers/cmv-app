define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/TooltipDialog',
    'dojox/image/LightboxNano',
    'dojo/ready',
    'dijit/popup',
    'dojo/_base/lang',
    'dojo/on',
    'dojo/aspect',
    'dojo/dom',
    'dojo/dom-style',
    'dojo/dom-class',
    'dojo/dom-construct',
    'dojo/topic',
    'dojo/text!./IssueSelector/templates/issueSelector.html',
    'dojo/text!./IssueSelector/templates/issueSelectorTooltip.html',
    'dojo/query',    
    'dijit/registry',
    'dijit/form/FilteringSelect',
    'esri/layers/ArcGISDynamicMapServiceLayer',
    'esri/InfoTemplate',
    'esri/request',
    'xstyle/css!./IssueSelector/css/issueSelector.css',
    // If nested widgets fail on load try adding these
    'dijit/form/Form',
    'dijit/layout/ContentPane',
    'dijit/layout/TabContainer'
],
    function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, TooltipDialog, LightboxNano, ready, popup, lang, on, aspect, dom, domStyle, domClass, domConstruct, 
        topic, SlrFiltertemplate, SlrFilterTooltiptemplate, query, registry, fSelect,
        ArcGISDynamicMapServiceLayer, InfoTemplate, esriRequest
) {
        return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
            widgetsInTemplate: true,
            templateString: SlrFiltertemplate,
            tooltiptemplateString: SlrFilterTooltiptemplate,            
            topicID: 'issueSelector',            
            baseClass: 'issueSelector',
            map: this.map,
            sidebarPane: null,
            defaultProjection: null,
            defaultRegion: null,
            defaultTime: null,
            defaultTidal: null,
            postCreate: function () {
                this.inherited(arguments);
                this._initializeIssueSelector();
            },
            startup: function () {
                this.inherited(arguments);
                this.initializeTooltip();                                
              
            },
            initializeTooltip: function () {
                // tooltip Dialog
                this.inherited(arguments);

                var myTooltipDialog = new TooltipDialog({
                    id: 'myTooltipDialog',
                    style: 'width: 300px;',
                    templateString: SlrFilterTooltiptemplate,
                    onShow: function () {
                        // Focus the first element in the TooltipDialog
                        this.focus();
                    },                    
                    _onBlur: function () {
                        // User must have clicked a blank area of the screen, so close the TooltipDialog
                        // popup.close(myTooltipDialog);
                    },                 
                    onClick: function (evt) {
                        if (evt.target === this.slrTTCloseNode) {
                            popup.close(myTooltipDialog);
                        }
                    }
                });
                this.issueSelectorTooltip = myTooltipDialog;    
                this.issueSelectorTooltip.startup();

                on(this.issueSelectorHelpNode, 'click', function () {
                    popup.open({
                        popup: myTooltipDialog,
                        around: dom.byId('tooltipNode'),
                        onCancel: function () {                            
                            // User pressed escape, so close myself
                            popup.close(myTooltipDialog);
                        }
                    });
                });

            },
            _addIssueToMap: function (issue) {
                topic.publish('growler/growl', 'Loading ' + issue.name);
                var layer = new ArcGISDynamicMapServiceLayer(issue.url,
                    {
                        opacity: 0.75, //todo store in config?
                        id: issue.name,
                        infoTemplate: new InfoTemplate('Attributes', '${*}')
                    }
                );
                //construct on-load handler. The layer needs to be loaded before getting the layerInfo
                //and adding to layerControl widget
                on(layer, 'load', function () {
                    console.log("layer " + layer.id + " loaded");
                    esriRequest({
                        url: issue.url,
                        content: { f: 'json' },
                        handleAs: 'json',
                        callbackParamName: 'callback'
                    }).then(function (response, b, c, d, e) {
                        console.log("Success: ", response.layers);
                        var layerControlInfo = {
                            controlOptions: {
                                expanded: true,
                                metadataUrl: true,
                                //includeUnspecifiedLayers: true, //might be important
                                swipe: true,
                                noMenu: false,
                                mappkgDL: true,
                                removeControl: true,
                                menu: [{
                                    label: 'Open Attribute Table',
                                    topic: 'openTable',
                                    iconClass: 'fa fa-table fa-fw'
                                }, {
                                    label: 'Open Metadata',
                                    topic: 'openMetadata',
                                    iconClass: 'fa fa-info fa-fw'
                                }]
                            },
                            layer: layer,
                            title: issue.name,
                            type: 'dynamic'
                        };
                        topic.publish('layerControl/addLayerControls', [layerControlInfo]);


                    }, function (error) {
                        console.log("Error: ", error.message);
                        //TODO better error handler
                    });

                }); //end on-load

                //add the layer to the map
                //TODO: in DnD, after which this is modelled, "this.map" is a thing
                //for some reason it doesn't work here, so using app.map
                app.map.addLayer(layer);

            },
            _initializeIssueSelector: function () {
                for (var i = 0; i < this.issueServices.length; i++) {
                    var issueService = this.issueServices[i];
                    var span = domConstruct.create("span", null, this.IssueSelectDom);
                    if (!issueService.iconUrl) {
                        //default to image named the same as the issue
                        issueService.iconUrl = issueService.name.replace(/\s/g, '_') + '.png';
                    }
                    var img = domConstruct.create("img", { 'alt': issueService.name, 'src': 'js/gis/dijit/IssueSelector/images/' + issueService.iconUrl }, span);
                    domConstruct.create("br", null, span);
                    var label = domConstruct.create("span", { 'innerHTML': issueService.name }, span);
                    if (issueService.url) {
                        this._addClickHandler(span, issueService);
                        domClass.add(span, "enabled");
                    } else {
                        domClass.add(span, "disabled");
                        label.disable;
                    }
                }
            },
            _addClickHandler: function (span, issue) {
                on(span, "click", this._addIssueToMap(issue));
            },
            openFilterHelp: function () {
                this.myDialog.show();
            },
            _onIssueChange: function (timeIdx) {
                //TODO?
            },
            _applyFilter: function () {
                // Added layers Check
                if (this.addedLayers < this.maxLayers) {
                    // console.log('apply ok ' + String(this.addedLayers) + ' is less than ' +  String(this.maxLayers));
                } else {
                    // console.log('apply disabled ' + String(this.addedLayers) + ' is not less than ' +  String(this.maxLayers));
                    this.clearGrowl();
                    var msg = {
                        title: 'Scenario Limit:',
                        message: 'Layer limit exceeded(' + this.maxLayers + '). Please remove a Scenario to add a new one.',
                        level: 'warning',
                        timeout: 5000,
                        opacity: 1.0
                    };
                    topic.publish('growler/growl', msg);          
                    return;                
                }
                var selectedcontentPane = registry.byId('slrFilterTabContainer').domNode;


                    topic.publish('slrFilterCntrool/applyFilter2', {
                        projection: this._getSelectedIssue(selectedcontentPane).projection,                
                        state: this._getSelectedIssue(selectedcontentPane).state,
                        time: this._getSelectedIssue(selectedcontentPane).time,
                        tidal: this._getSelectedIssue(selectedcontentPane).tidalDatum,

                        scenario:
                            this._RetrieveScenario(this.defaultScenarioType,
                            this._getSelectedIssue(selectedcontentPane).state,
                            this._getSelectedIssue(selectedcontentPane).time,
                            this._getSelectedIssue(selectedcontentPane).projection, 
                            this._getSelectedIssue(selectedcontentPane).tidalDatum)
                    });
            },
            _RetrieveScenario: function (scenarioType, state, year, projection, tidalDatum) {
                var SelectedScenarioKey = scenarioType + state + year + projection + tidalDatum; 
                var scenarios = this.scenarios;
                var ScenarioOBJ;
                scenarios.forEach (function (scenario) {
                    var ScenarioID = scenario.scenarioType + scenario.state + scenario.year + scenario.projection + scenario.tidal;                     
                    if (SelectedScenarioKey === ScenarioID) {
                        ScenarioOBJ = scenario;                                         
                    }
                });
                return ScenarioOBJ;
            },
            _getFilterInputsConfig: function () {
                this.inherited(arguments);
                var regionTypeVal = this.regionType[this.regionTypeIdx];
                var regionVal = this.regions[this.regionIdx];
                var stateVal = this.regions[this.regionIdx].state;
                var extentVal = this.regions[this.regionIdx].extent;
                var timeVal = this.times[this.timeIdx].time;

                return {
                    // How to return array index from config
                    regionTypeArray: regionTypeVal,
                    regionArray: regionVal,
                    state: stateVal,
                    extent: extentVal,
                    time: timeVal
                };
            },
            _getSelectedIssue: function () {

                return {
                    issueName: this.issueSelectDijit.get('displayedValue'),
                    issueUrl: this.issueSelectDijit.get('value')
                };           
            },
            // get the sidebar pane containing the widget (if any)
            getSidebarPane: function () {
                if (!this.sidebarPane) {
                    this.sidebarPane = registry.byId(this.sidebarID);
                }
            },
            // open the sidebar pane containing this widget (if any)
            openPane: function () {
                this.getSidebarPane();
                if (this.sidebarPane) {
                    var paneID = this.sidebarPane.id.toLowerCase().replace('sidebar', '');
                    topic.publish('viewer/togglePane', {
                        pane: paneID,
                        show: 'block'
                    });
                }
            },
            closePane: function () {
                this.getSidebarPane();
                if (this.sidebarPane) {
                    var paneID = this.sidebarPane.id.toLowerCase().replace('sidebar', '');
                    topic.publish('viewer/togglePane', {
                        pane: paneID,
                        show: 'none'
                    });
                }
            },          
            _overrideSlrFilterDockHandle: function () {
                this.inherited(arguments);
                var self = this;
                /*eslint-disable */
                var slrFilterControl_parent = registry.byId('slrFilterControl_parent');
                var dockhandler = slrFilterControl_parent.dockHandleNode;

                aspect.after(slrFilterControl_parent._moveable, 'onMoveStop', function () {
                    console.log('moveStop');
                    self.closePane();
                });
                },
              _checkedRadioBtn: function (sGroupName) {
                var activebtnsX = query(':checked');  
                var value;
                activebtnsX.forEach( function(node) {
                    if(node.name === sGroupName){
                        value = node.value;
                        return value;
                    }
                });
                     return value;
            },
            _SLRFilterError: function (errorMsg) {
                this.clearGrowl();
                var msg = {
                    title: 'Scenario Selector Error: ' + errorMsg,
                    level: 'error',
                    timeout: 5000,
                    opacity: 1.0
                };
                topic.publish('growler/growl', msg);          
            },
            clearGrowl: function () {
                var growl = registry.byId(this.growlID);
                if (growl && growl.close) {
                    growl.close();
                    registry.remove(this.growlID);
                }
            }

        });
    });
