//refactored out of aoi editor widget with the idea that I could incorporate it into identify results for an 
//AOI service loaded into the map. That seems possible, but the way identify content is handled by AGS JSAPI
//it's the same div being reused, and if a user clicked on two separate AOIs, this class would be conflicting
//in what it should be writing to.

//that concept is proving to be overwraught. I think it would be much simpler to incorporate visibility 
//controls into the existing aoi editor UI, copying from the editor portion of the widget.

define([
    'dojo/topic'
],
function (topic) {
    console.log('AoiProgressMonitor > define');

    return function (callingWidget) {
        var self = this,
            nullProgress = {code: 0, text: 'foo', running: false, title: 'Bar', href: null};
        //add progress-related observables
        //this has to be done before calling ko.applyBindings!
        //so calling class should construct this object in postCreate, and apply bingings in startup.
        //or you could put this in startup, or wherever, just before applyBindings call.

        callingWidget.progressGIS = ko.observable(nullProgress);
        callingWidget.progressCCI = ko.observable(nullProgress);
        callingWidget.progressHCM = ko.observable(nullProgress);
        callingWidget.progressCRD = ko.observable(nullProgress);
        callingWidget.progressERT = ko.observable(nullProgress);
        callingWidget.analysisRunning = ko.observable(false);

        callingWidget.checkAnalysisProgress = function () {
            self.cancelRequested = false;
            self._checkAnalysisProgress();
        };

        this.cancelRequested = false; //note I don't have any UI support for this; before adding that I would 
        //want to either figure out how to get report/map generation from stopping, or warn the user...what?
        //in effect, setting this to true while analysis is running only stops our checking for progress,
        //not the analysis itself. leaving it here as a possible future todo, and for testing purposes  

        this.progressErrorCount = 0;
        
        this._checkAnalysisProgress = function () {
            if (!callingWidget.aoiId()) {
                topic.publish('growler/growlError', 'Unable to check for analysis progress: AOI is not loaded.');
            }
            if (self.cancelRequested) {
                topic.publish('growler/growl', 'Progress check cancelled');
                return;
            }
            MapDAO.getAoiAnalysisProgress(callingWidget.aoiId(), {
                callback: function (p) {
                    //a little post-processing
                    //Note: don't think you can simplify this by just directly referring to the DWR reply, it has to be cloned to a new object
                    //because DWR takes short-cuts, and there will be a common object like "s0={code: 1, text: 'whatever'}" re-used for each progress
                    var gis = {
                        code: p.progressGIS.code,
                        text: p.progressGIS.text,
                        running: p.progressGIS.running,
                        title: 'Study Area Report',
                        href: '/est/analysis/ReportOptions.do?aoiId=' + callingWidget.aoiId()
                    },
                        hcm = {
                            code: p.progressHCM.code,
                            text: p.progressHCM.text,
                            running: p.progressHCM.running,
                            title: 'Hardcopy Maps',
                            href: '/est/hardCopyMaps.jsp?aoiId=' + callingWidget.aoiId()
                        },
                        cci = {
                            code: p.progressCCI.code,
                            text: p.progressCCI.text,
                            running: p.progressCCI.running,
                            title: 'Sociocultural Data Report',
                            href: null //links are by feature, handled in sidebar.html layout
                        },
                        crd = {
                            code: p.progressCRD.code,
                            text: p.progressCRD.text,
                            running: p.progressCRD.running,
                            title: 'Cultural Resources Data Report',
                            href: '/est/analysis/CachedGisReport.do?aoiId=' + callingWidget.aoiId() + '&issueId=102&crdReport=true'
                        },
                        ert = {
                            code: p.progressERT.code,
                            text: p.progressERT.text,
                            running: p.progressERT.running,
                            title: 'Emergency Response Report',
                            href: 'todo'
                        };

                    if (gis.code === 4 && p.completedGisCount > 1) {
                        gis.text = 'Creating PDF ' + (p.completedGisCount - 1) + ' of 22';
                    }

                    if (hcm.code === 3 && p.completedHcmCount > 1) {
                        hcm.text = 'Creating Map ' + (p.completedHcmCount - 1) + ' of 22';
                    }

                    callingWidget.progressGIS(gis);
                    callingWidget.progressCCI(cci);
                    callingWidget.progressHCM(hcm);
                    callingWidget.progressCRD(crd);
                    callingWidget.progressERT(ert);

                    callingWidget.analysisRunning(p.running);

                    if (p.running) {
                        window.setTimeout(function () {
                            self._checkAnalysisProgress();
                        }, 15000);
                    }
                },
                errorHandler: function (e) {
                    if (self.progressErrorCount > 5) {
                        //bail
                        topic.publish('growler/growlError', 'Too many errors updating progress, updates will stop: ' + e);
                    } else {
                        topic.publish('growler/growlError', 'Error updating progress: ' + e);
                        self.progressErrorCount++;
                        self.checkAnalysisProgress();
                    }
                }
            });

            return this;
        }
        
    };
});