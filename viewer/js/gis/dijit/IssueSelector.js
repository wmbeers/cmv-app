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
    'esri/dijit/Legend',
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
        ArcGISDynamicMapServiceLayer, Legend, InfoTemplate, esriRequest
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
                topic.publish('growler/growl', 'Loading ' + issue.title);

                //todo add layerControlInfo
                //Note: I tried app.initLayer, and while it does do a great job of adding the layer to the map, 
                //it doesn't then call functions to make it show up in the LayerControl widget
                //app._initLayer(issue, ArcGISDynamicMapServiceLayer);

                var layer = new ArcGISDynamicMapServiceLayer(issue.url,
                    {
                        opacity: 0.75, //todo store in config?
                        id: issue.name,
                        infoTemplate: new InfoTemplate('Attributes', '${*}')
                    }
                );
                //Note: _MapMixin adds layers to the layers control with unshift, e.g.:
                //layers.unshift(l)
                //but that's to keep it in the order in which they're listed in operationalLayers
                app.layers.push(layer);
                //construct on-load handler. The layer needs to be loaded before getting the layerInfo
                //and adding to layerControl widget
                on(layer, 'load', function () {
                    //I don't know why we need to make this separate esriRequest, but the layer won't show up in layerControl
                    //unless we do
                    esriRequest({
                        url: issue.url,
                        content: {f: 'json'},
                        handleAs: 'json',
                        callbackParamName: 'callback'
                    }).then(function () {
                        //todo: put this in config? Or have some default options if not in config?
                        var layerControlInfo = {
                            controlOptions: {
                                expanded: false,
                                metadataUrl: true,
                                //includeUnspecifiedLayers: true, //might be important
                                swipe: true,
                                noMenu: false,
                                noZoom: true, //TODO: disable zoom to layer for state-wide layers?
                                mappkgDL: true,
                                allowRemove: true,
                                menu: {
                                    dynamic: {
                                        label: 'Remove A',
                                        topic: 'remove',
                                        iconClass: 'fa fa-info fa-fw'
                                    }
                                }
                            },
                            menu: [{
                                label: 'Remove B',
                                topic: 'remove',
                                iconClass: 'fa fa-info fa-fw'
                            }],
                            layer: layer,
                            title: issue.title,
                            type: 'dynamic'
                        };
                        topic.publish('layerControl/addLayerControls', [layerControlInfo]);
                        //topic.publish('legendControl/addLayerControls') TODO
                        topic.publish('identify/addLayerInfos', [{
                            type: 'dynamic',
                            layer: layer,
                            title: issue.title
                        }]);
                        app.legendLayerInfos.push({layer: layer, title: issue.title});
                        //Legend.refresh();
                    }, function (error) {
                        topic.publish('growler/growl', {
                            title: 'Issue Selector Error',
                            message: error.message,
                            level: 'error', //can be: 'default', 'warning', 'info', 'error', 'success'.
                            timeout: 0, //set to 0 for no timeout
                            opacity: 1.0
                        });
                    });

                }); //end on-load

                //add the layer to the map
                //note: in DnD, after which this is modelled, "this.map" is a thing
                //for some reason it doesn't work here, so using app.map
                app.map.addLayer(layer);
            },
            _initializeIssueSelector: function () {
                this.issueServices.forEach(function (issueService) {
                    var span = domConstruct.create('span', null, this.IssueSelectDom);
                    if (!issueService.iconUrl) {
                        //default to image named the same as the issue
                        issueService.iconUrl = issueService.title.replace(/\s/g, '_') + '.png';
                    }
                    domConstruct.create('img', {'alt': issueService.title, 'src': 'js/gis/dijit/IssueSelector/images/' + issueService.iconUrl}, span);
                    domConstruct.create('br', null, span);
                    if (issueService.url) {
                        on(span, 'click', lang.hitch(this, function () {
                            this._addIssueToMap(issueService);
                        }));
                        domClass.add(span, 'enabled');
                        domConstruct.create('span', {'innerHTML': issueService.title}, span);
                    } else {
                        domClass.add(span, 'disabled');
                        domConstruct.create('span', {'innerHTML': issueService.title, 'disabled': true}, span);
                    }
                }, this);
            },
            openFilterHelp: function () {
                this.myDialog.show();
            },
            _onIssueChange: function () {
                //TODO?
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
