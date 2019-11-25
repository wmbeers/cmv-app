define([
    'dojo/Deferred',
    'dojo/topic',
    'esri/tasks/FeatureSet',
    'esri/tasks/RouteParameters',
    'esri/tasks/RouteTask',
    'esri/tasks/query',
    'esri/graphic',
    'esri/tasks/QueryTask',
    'esri/geometry/Point',
    'esri/geometry/Polyline',
    //breaks identify 'esri/geometry/projection',
    'esri/tasks/GeometryService',
    'esri/tasks/LengthsParameters',
    'esri/symbols/TextSymbol', //ONLY USED FOR TESTING
    'jquery'
],
function (Deferred, topic, FeatureSet, RouteParameters, RouteTask, Query, Graphic, QueryTask, Point, PolyLine, /*projection,*/ GeometryService, LengthsParameters, TextSymbol, jQuery) {
    /**
    * Helper class for extracting points routes from the FDOT basemap.
    */
    return {

        addRciBasemapToMap: function () {
            /*var rciService = {
                id: 7311,
                type: 'dynamic',
                name: 'RCI Basemap',
                url: 'https://pisces.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/RCI_Base/MapServer/'
            };
            var rciService = {
                id: 97311, //TODO!
                type: 'feature',
                name: 'RCI Basemap',
                url: 'https://pisces.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/RCI_Network/MapServer/7'
            };
            topic.publish('layerLoader/addLayerFromCategoryDef', rciService);
            */
        },

        /**
         * Gets the roadway feature from the basemap with the specified roadway ID. 
         * @deprecated Use getRoadwayWithMeasures, as this doesn't take measures into account.
         * @param {any} roadwayId The value for the desired feature's ROADWAY attribute
         * @returns {feature} The feature from the basemap with the specified roadway ID
         */
        getRoadway: function (roadwayId) {
            var queryTask = new QueryTask('https://pisces.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/RCI_Network/MapServer/7'),
                query = new Query(),
                deferred = new Deferred();

            query.where = 'ROADWAY=' + roadwayId;
            query.returnGeometry = true;
            query.outFields = ['BEGIN_POST', 'END_POST'];
            query.outSpatialReference = app.map.spatialReference;
            queryTask.execute(query).then(
                function (reply) {
                    if (reply.features && reply.features.length > 0) {
                        var feature = reply.features[0]; //ROADWAY is a unique identifier, but not once we've split it up to add AADT, so we need to handle more than one
                        //if (!projection.isLoaded()) {
                        //    projection.load().then(function () {
                        //        feature.geometry = projection.project(feature.geometry, app.map.spatialReference); //TODO avoid app.map reference, somehow; probably easiest to just define it
                        //        deferred.resolve(feature);
                        //    });
                        //} else {
                        //project the polyline
                        //feature.geometry = projection.project(feature.geometry, app.map.spatialReference);
                        deferred.resolve(feature);
                        //}
                    } else {
                        deferred.reject('No roadway found with id ' + roadwayId);
                    }
                },
                function (e) {
                    deferred.reject(e);
                });
            return deferred;
        },

       
        /**
         * Extracts a point along the specified roadway at the specified milepost.
         * @deprecated Use extractPoint2
         * @param {any} roadwayId The value for the desired feature's ROADWAY attribute
         * @param {any} milePost The milepost along the route.
         * @returns {Point} The point along the specified roadway at the specified milepost
         */
        extractPoint: function (roadwayId, milePost) {
            var self = this,
                deferred = new Deferred();
            this.getRoadway(roadwayId).then(
                function (feature) {
                    if (feature) {
                        self.getPointAlongRoadway(feature, milePost).then(function (p) {
                            deferred.resolve(p);
                        }, function (e) {
                            deferred.reject(e);
                        });
                    } else {
                        deferred.reject('Roadway not found.');
                    }
                }, function (e) {
                    deferred.reject(e);
                });
            return deferred;
        },

        /**
         * Extracts a line between two mileposts along the specified roadway. 
         * @deprecated This is a less reliable method than extractLine2, in that doesn't fully take measures into account.
         * @param {any} roadwayId The value for the desired feature's ROADWAY attribute
         * @param {any} beginMilePost The begin milepost along the route.
         * @param {any} endMilePost The end milepost along the route.
         * @returns {Polyline} The polyline along the specified roadway between the specified mileposts
         */
        extractLine: function (roadwayId, beginMilePost, endMilePost) {
            var self = this,
                deferred = new Deferred();
            try {
                this.getRoadway(roadwayId).then(
                    function (roadway) {
                        if (roadway) {
                            self.getPointAlongRoadway(roadway, beginMilePost).then(
                                function (p1) {
                                    self.getPointAlongRoadway(roadway, endMilePost).then(
                                        function (p2) {
                                            self.extractRouteBetweenPoints(p1, p2).then(
                                                function (roadwaySegment) {
                                                    deferred.resolve(roadwaySegment); //yay
                                                },
                                                function (e) { //error extracting route
                                                    deferred.reject(e);
                                                }
                                            );
                                        },
                                        function (e) { //error getting second point
                                            deferred.reject(e);
                                        }
                                    );
                                },
                                function (e) { //error getting first point
                                    deferred.reject(e);
                                }
                            );
                        } else {
                            deferred.reject('Roadway not found'); //invalid roadway ID
                        }
                    },
                    function (e) {
                        deferred.reject(e); //some other error getting the roadway
                    }
                );
            } catch (e) {
                deferred.reject(e);
            }

            return deferred;
        },

        /**
         * Extracts a point between at the desired milepost along the roadway
         * @param {any} roadwayId The value for the desired feature's ROADWAY attribute
         * @param {Number} milepost The milepost of the point
         * @returns {Deferred} A Deferred object to be resolved with a Point object in Web Mercator projection, representing the point at the desired milepost along the roadway
         */
        extractPoint2: function (roadwayId, milepost) {
            var self = this,
                deferred = new Deferred();

            //via UI, milepost comes in as a string. Convert it to a number
            milepost = parseFloat(milepost);
            if (isNaN(milepost)) {
                deferred.reject('Milepost value "' + milepost + '" is not a valid number');
                return deferred;
            } else if (milepost < 0) {
                deferred.reject('Milepost value must be greater than or equal to 0');
                return deferred;
            }

            this.getRoadwayWithMeasures(roadwayId).then(
                function (reply) {
                    try {
                        var p = self._extractPointFromPointArray(reply, milepost);
                        deferred.resolve(p);
                    } catch (e) {
                        deferred.reject(e);
                    }
                },
                function (e) {
                    deferred.reject(e);
                }
            );
            return deferred;
        },

        /**
         * Extracts a line between two mileposts along the specified roadway.
         * @param {any} roadwayId The value for the desired feature's ROADWAY attribute
         * @param {any} beginMilePost The begin milepost along the route.
         * @param {any} endMilePost The end milepost along the route.
         * @returns {Deferred} A Deferred object to be resolved with a PolyLine object, representing the path along the specified roadway between the specified mileposts
         */
        extractLine2: function (roadwayId, beginMilePost, endMilePost) {
            var self = this,
                deferred = new Deferred();

            //via UI, mileposts comes in as strings. Convert them to numbers
            beginMilePost = parseFloat(beginMilePost);
            if (isNaN(beginMilePost)) {
                deferred.reject('Begin milepost value "' + beginMilePost + '" is not a valid number');
                return deferred;
            } else if (beginMilePost < 0) {
                deferred.reject('Milepost values must be greater than or equal to 0');
                return deferred;
            }
            endMilePost = parseFloat(endMilePost);
            if (isNaN(endMilePost)) {
                deferred.reject('End milepost value "' + endMilePost + '" is not a valid number');
                return deferred;
            } else if (endMilePost < 0) {
                deferred.reject('Milepost values must be greater than or equal to 0');
                return deferred;
            }
            if (endMilePost <= beginMilePost) {
                deferred.reject('End milepost must be greater than begin milepost');
                return deferred;
            }

            try {
                this.getRoadwayWithMeasures(roadwayId).then(
                    function (reply) {
                        deferred.resolve(self._extractPolyLinesFromPointArray(reply, beginMilePost, endMilePost));
                    },
                    function (e) {
                        deferred.reject(e);
                    }
                );
            } catch (e) {
                deferred.reject(e);
            }

            return deferred;
        },

        /**
        * Gets the raw geometry, with measures, from the basemap with the specified roadway ID, using a direct query to the AGS REST API.
        * @param {any} roadwayId The value for the desired feature's ROADWAY attribute
        * @returns {Deferred} A Deffered object resolved with the response from the REST query, a raw object representing the feature, including the array of coordinates and measures from the basemap with the specified roadway ID, as an array of arrays, with the inner set of arrays storing coordinate x, y and m values.
        */
        getRoadwayWithMeasures: function (roadwayId) {
            var deferred = new Deferred(),
                url = 'https://pisces.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/RCI_Base/MapServer/2/query?where=ROADWAY%3D' + roadwayId + '&outFields=BEGIN_POST%2C+END_POST%2C+RTLENGTH&returnGeometry=true&outSR=%7Bwkid%3D102100%7D&returnZ=false&returnM=true&f=pjson';
            //url = 'https://pisces.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/RCI_Network/MapServer/7/query?where=ROADWAY%3D' + roadwayId + '&outFields=BEGIN_POST%2C+END_POST%2C+RTLENGTH&returnGeometry=true&outSR=%7Bwkid%3D102100%7D&returnZ=false&returnM=true&f=pjson';
            try {
                jQuery.get(url, null,
                    function (reply) {

                        if (reply.features && reply.features.length > 0) {
                            deferred.resolve(reply);
                        } else {
                            deferred.reject('No roadway found with id ' + roadwayId);
                        }
                    }, 'json');
            } catch (e) {
                deferred.reject(e);
            }
            return deferred;
        },

        /**
         * Parses the response from getRoadwayWithMeasures to construct a Point at the desired milepost along the roadway
         * @param {Object} roadwayFeatures The response returned from getRoadwayWithMeasures, including features and other info.
         * @param {Number} milepost The milepost of the point
         * @returns {Point} A Point object in Web Mercator projection, representing the point at the desired milepost along the roadway
         */
        _extractPointFromPointArray: function (roadwayFeatures, milepost) {
            var milePostError = this._verifyMeasures(roadwayFeatures, milepost, null),
                i = null, //index of the roadwayFeatures array
                j = null, //calculated below to be the index of the first point in the ith array with an m value greater than milepost.
                p = null, //stores the response from getPointBetweenPoints
                path = null, //set in the loop through roadwayFeatures, the current roadway feature being tested
                pointJson = { //the point to be created
                    x: null,
                    y: null,
                    m: null,
                    spatialReference: {
                        wkid: 102100
                    }
                };
            if (milePostError) {
                throw milePostError;
            } else {
                //valid milepost
                //loop through paths
                for (i = 0; i < roadwayFeatures.features.length; i++) {
                    path = roadwayFeatures.features[i].geometry.paths[0]; //I assume there are no multi-part features
                    for (j = 0; j < path.length; j++) {
                        var v = path[j], //the current vertex along the path, as an array with x, y, and m values;
                            measure = v[2]; //the m value of the vertex
                        if (measure >= milepost) {
                            p = this._getPointBetweenPoints(path, j, milepost);
                            pointJson.x = p.x;
                            pointJson.y = p.y;
                            pointJson.m = milepost;
                            return new Point(pointJson);
                        }
                    }
                }
            }
            //if we get this far, it's likely a rounding error discrepancy between the m value and the END_POST value.
            //punt to use the last point
            var lastPoint = path[path.length - 1];
            pointJson.x = lastPoint[0];
            pointJson.y = lastPoint[1];
            pointJson.m = lastPoint[2]; //not really used
            return new Point(pointJson);
        },

        /* eslint-disable max-statements */
        
        /**
         * Parses the response from getRoadwayWithMeasures to construct a PolyLine representing the desired segment of roadway between the begin and end mileposts.
         * @param {Array} roadwayFeatures The features (as JSON) returned from getRoadwayWithMeasures.
         * @param {Number} beginMilePost The begin milepost of the desired segment
         * @param {Number} endMilePost The end milepost of the desired segment
         * @returns {Array} An array of PolyLine objects in Web Mercator projection representing the desired segments of roadway between the begin and end mileposts.
         */
        _extractPolyLinesFromPointArray: function (roadwayFeatures, beginMilePost, endMilePost) {
            if (roadwayFeatures.features.length === 0) {
                throw (new Error('No roadway features found'));
            }
            var polyLines = [],
                milePostError = this._verifyMeasures(roadwayFeatures, beginMilePost, endMilePost),
                b = {featureIndex: null, vertexIndex: null, uninitialized: true}, //stores the indexes of the first feature vertex with m value greater than beginMilePost;
                e = {featureIndex: null, vertexIndex: null, uninitialized: true}; //stores the indexes of the last feature vertex with m value greater than endMilePost

            if (milePostError) {
                throw milePostError;
            } else {
                //valid mileposts

                //loop through roadway features to find where we begin and end
                for (var featureIndex = 0; featureIndex < roadwayFeatures.features.length && e.uninitialized; featureIndex++) {
                    var feature = roadwayFeatures.features[featureIndex],
                        path = feature.geometry.paths[0]; //I assume there are no multi-part PolyLines, need to confirm that and add another loop
                    //TODO, could compare BEGIN_POST and END_POST to beginMilePost and endMilePost and skip the loop
                    //loop through vertices
                    for (var vertexIndex = 0; vertexIndex < path.length; vertexIndex++) {
                        var v = path[vertexIndex], //a vertex along the path, as an array with x, y, and m values;
                            measure = v[2]; //the m value
                        if (b.uninitialized && measure >= beginMilePost) {
                            b.uninitialized = false; //skips this block on the next iteration
                            b.featureIndex = featureIndex;
                            b.vertexIndex = vertexIndex;
                        }
                        if (measure >= endMilePost) {
                            e.uninitialized = false; //effectively breaks out of the outer for loop
                            e.featureIndex = featureIndex;
                            e.vertexIndex = vertexIndex;
                            break; //break out of the inner for loop
                        }
                    }
                }

                if (b.uninitialized) {
                    throw (new Error('Unable to find a measure > beginMilePost'));
                }
                //todo check e?
                //NOTE: I'm assuming that the features are ordered by measure, with the first feature having the lowest measure and second having it's first measure the same as the first features last vertex
                //Spot checking shows this to be the case, but may need to run a more comprehensive test to make sure.
                //ignore features before the "b[0]" (i) feature, and features after the e[0] feature.
                for (var i = b.featureIndex; i <= e.featureIndex; i++) {
                    var path2 = roadwayFeatures.features[i].geometry.paths[0],
                        newPath = [],
                        bIndex = 0,
                        eIndex = path2.length,
                        beginPoint = null, //the first vertex, only applies for the first path
                        endPoint = null; //the last vertex, only applies for the last path
                    if (i === b.featureIndex) {
                        //first path (maybe the only one)
                        beginPoint = this._getPointBetweenPoints(path2, b.vertexIndex, beginMilePost);
                        bIndex = b.vertexIndex;
                        if (beginPoint.snapped === 'snappedLower' || beginPoint.snapped === 'snappedHigher') {
                            bIndex++; //prevent double-including the point at path[b.vertexIndex], as it will be the beginPoint created above
                        }
                    }
                    if (i === e.featureIndex) {
                        //last path (which might be the same as the first path, and that's ok), so no "else"
                        //get up to endMilePost
                        endPoint = this._getPointBetweenPoints(path2, e.vertexIndex, endMilePost);
                        eIndex = e.vertexIndex;
                        if (endPoint.snapped === 'snappedLower') { //we only decrement eIndex when snappedLower, becausee our midpoint loop stops at eIndex-1 already
                            eIndex--;
                        }
                    }
                    //construct the array of vertices
                    //first vertex (only if we're on the first path)
                    if (beginPoint) {
                        newPath.push([beginPoint.x, beginPoint.y, beginPoint.m]);
                    }
                    //vertices in between (or all if on some middle path), except for the one at eIndex, because it's the first that's just beyond the measure
                    for (var n = bIndex; n < eIndex; n++) {
                        newPath.push(path2[n]);
                    }
                    //last vertex (only if we're on the last path)
                    if (endPoint) {
                        newPath.push([endPoint.x, endPoint.y, endPoint.m]);
                    }
                    //convert to polyline todo maybe should be grapphics? So we can better preserve attributes?
                    var polyLine = new PolyLine({
                        paths: [newPath],
                        spatialReference: {
                            wkid: 102100
                        }
                    });
                    polyLines.push(polyLine);
                }

                return polyLines;
            }
        },

        /**
         * Verfies milepost(s) against the min BEGIN_POST and max END_POST value of a set of roadway features with a given roadway ID
         * @param {any} roadwayFeatures The response from getRoadwayWithMeasures, including the array of features
         * @param {any} beginMilePost The begin (or only) milepost to test
         * @param {any} endMilePost The optional end milepost to test.
         * @returns {Error} Error object if given mileposts are not in the range of min BEGIN_POST to max END_POST of a set of roadway features, or null if valid
         */
        _verifyMeasures: function (roadwayFeatures, beginMilePost, endMilePost) {
            var beginPost = roadwayFeatures.features[0].attributes.BEGIN_POST,
                endPost = roadwayFeatures.features[roadwayFeatures.features.length - 1].attributes.END_POST;
            if (beginMilePost < beginPost) {
                return new Error('Begin milepost ' + beginMilePost + ' is less than the BEGIN_POST value of the roadway (' + beginPost + ').');
            } else if (beginMilePost > endPost) {
                return new Error('Begin milepost ' + beginMilePost + ' is greater than the END_POST value of the roadway (' + endPost + ').');
            } else if (endMilePost && endMilePost < beginPost) {
                return new Error('End milepost ' + endMilePost + ' is less than the BEGIN_POST value of the roadway (' + beginPost + ').');
            } else if (endMilePost && endMilePost > endPost) {
                return new Error('End milepost ' + endMilePost + ' is greater than the END_POST value of the roadway (' + endPost + ').');
            }
            return null;
        },

        /* eslint-enable max-statements */

        /**
         * Gets a point at a measure (milepost) between two points, snapping to the first or second point 
         * if their measures are within .0001 miles of the desired milepost
         * @param {Array} path The array of vertices point, in [[x,y,m]] format
         * @param {Array} index The index of the vertex in the path with a higher measure.
         * @param {Number} m The desired measure (milepost)
         * @return {object} Object with properties x, y, m and "snapped". x and y are the x and y of the point, m is the point's measure value; snapped property indicates whether the point was snapped or interpolated, and to which of the two points it was snapped, with value of "snappedLower", "snappedHigher", or "interpolated"
         *                  e.g. {x: -8282828, y: 3320303, m: 0, snapped: 'snappedLower'}
         */
        _getPointBetweenPoints: function (path, index, m) {
            var p1 = index === 0 ? path[index] : path[index - 1], //the first point (unless requested index is 0), in which case we shortcut this method
                p2 = path[index], //the second point
                xy1 = {x: p1[0], y: p1[1], m: p1[2]}, //convert from array to object to make this a little easier to understand
                xy2 = {x: p2[0], y: p2[1], m: p2[2]},
                result = null;
            //try snapping to first point
            if (index === 0 || parseFloat(xy1.m.toFixed(3)) === parseFloat(m.toFixed(3))) {
                //no interpolation required, we have an existing vertex with measure close to or equal to the requested milepost
                result = xy1;
                result.snapped = 'snappedLower';
                //check b
            } else if (parseFloat(xy2.m.toFixed(3)) === parseFloat(m.toFixed(3))) {
                result = xy2;
                result.snapped = 'snappedHigher';
            } else {
                //interpolate, along a line between points at p1 and p2, at a distance of d, where d is the remaining distance from the measure at p1 to get to the desired input measure milepost, in miles
                var d = m - xy1.m;
                result = this._interpolateBetweenPoints(xy1, xy2, d);
                result.snapped = 'interpolated';
                result.m = m;
            }
            return result;
        },

        /**
         * Interpolates a point at a measure (milepost) between two points
         * @param {any} p1 The first point, as an an object with x and y properties
         * @param {any} p2 The second point, as an an object with x and y properties
         * @param {any} d The desired distance from p1, along the line from p1 to p2, of the interpolated point, in miles
         * @return {Array} The interpolated point, as an an object with x and y properties
         */
        _interpolateBetweenPoints: function (p1, p2, d) {
            var xyI = {x: null, y: null}; //the object to be returned
            
            //convert d from miles to meters, because X and Y are in meters, and our remaining distance no longer cares about milepost measures
            d *= 1609.34;

            //handle vertical and horizontal lines in a quick and easy way, avoiding divide-by-zero errors
            if (p1.x === p2.x) {
                //vertical line, just adjust y by d, and keep x
                xyI.x = p1.x;
                xyI.y = p1.y + d;
                return xyI;
            }
            if (p1.y === p2.y) {
                //horizontal line, just adjust x by d, and keep y
                xyI.x = p1.x + d;
                xyI.y = p1.y;
                return xyI;
            }
            //if we get this far, we need to do some trig
            var slope = (p2.y - p1.y) / (p2.x - p1.x),
                theta = Math.atan(slope);
            
            xyI.x = p1.x + d * Math.cos(theta);
            xyI.y = p1.y + d * Math.sin(theta);

            return xyI;
        },

        /**
         * Extracts the route from the basemap between any two points. Currently the two points must be along the same roadway. This is the method used by the interactive click-on-map extract function.
         * @param {Point} p1 The begin point 
         * @param {Point} p2 The end point
         * @returns {Polyline} The route between the specified points
         */
        extractRouteBetweenPoints: function (p1, p2) {
            var rt = new RouteTask('https://pisces.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/RCI_Network/NAServer/Route'),
                params = new RouteParameters(),
                g1 = new Graphic({
                    geometry: p1
                }),
                g2 = new Graphic({
                    geometry: p2
                }),
                deferred = new Deferred();

            //let proj4 know about the existence of Florida Albers, defining an alias TODO maybe this belongs in config?
            //this is the spatial reference we'll get querying RCI directly
            //proj4.defs('EPSG:3087', '+proj=aea +lat_1=24 +lat_2=31.5 +lat_0=24 +lon_0=-84 +x_0=400000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'); //TODO put in startup somewhere
            //define the projection from Albers to Web Mercator
            //var proj = proj4('EPSG:3087', 'EPSG:3857');

            params.stops = new FeatureSet();
            params.stops.features.push(g1);
            params.stops.features.push(g2);
            params.outSpatialReference = p1.spatialReference;

            rt.solve(params,
                function (result) {
                    var pl = result.routeResults[0].route.geometry;
                    //if (!projection.isLoaded()) {
                    //    projection.load().then(function () {
                    //        var plWM = projection.project(pl, p1.spatialReference);
                    //        deferred.resolve(plWM);
                    //    });
                    //} else {
                    //    project the polyline
                    //    var plWM = projection.project(pl, p1.spatialReference);
                    //    deferred.resolve(plWM);
                    deferred.resolve(pl);
                    //}
                },
                function (e) {
                    deferred.reject(e);
                });

            return deferred;
        },

        /**
         * Gets the point along the given polyline at the specified distance. 
         * @deprecated Use methods above that take measures into account.
         * Adapted from  https://gis.stackexchange.com/questions/29594/finding-a-location-on-a-line-using-a-point-and-a-relative-distance-with-arcgis-j
         * (http://jsfiddle.net/raykendo/w22rm/)
         * @param {feature} feature: The Roadway feature from which to get a point.
         * @param {Number} distance: The distance, in miles, along the specified line.
         * @returns {Point} The point along the specified polyline at the specified distance.
         */
        getPointAlongRoadway: function (feature, distance) {
            // create sublines for geometry service.
            var i = null,
                geometry = feature.geometry,
                beginMilePost = feature.attributes ? feature.attributes.BEGIN_POST : null,
                endMilePost = feature.attributes ? feature.attributes.END_POST : null,
                lines = [],
                numOfSubLines = geometry.paths[0].length - 1,
                gs = new GeometryService('http://tasks.arcgisonline.com/ArcGIS/rest/services/Geometry/GeometryServer'),
                deferred = new Deferred();

            
            //quick check that distance is valid
            if (beginMilePost >= 0 && endMilePost) {
                if (distance < beginMilePost) {
                    setTimeout(function () {
                        deferred.reject('Distance requested (' + distance + ') is less than BEGIN_POST value ' + beginMilePost);
                    }, 200);
                } else if (distance > endMilePost) {
                    setTimeout(function () {
                        deferred.reject('Distance requested (' + distance + ') is greater than END_POST value ' + endMilePost);
                    }, 200);
                } else {
                    for (i = 0; i < numOfSubLines; i++) {
                        lines.push(new PolyLine(geometry.spatialReference));
                        lines[i].addPath(geometry.paths[0].slice(i, i + 2));
                    }

                    // create LengthParams to feed into geometry service
                    var lenParams = new LengthsParameters();
                    lenParams.geodesic = true;
                    lenParams.lengthUnit = GeometryService.UNIT_STATUTE_MILE;
                    lenParams.polylines = lines;

                    // run the geometry service
                    gs.lengths(lenParams).then(
                        function (result) {
                            var goal = distance;
                            var numOfLengths = result.lengths.length;
                            i = null;
                            for (i = 0; i < numOfLengths; i++) {
                                // todo: countdown the goal length until its below beginMilePost
                                goal -= result.lengths[i];
                                if (goal <= beginMilePost) {
                                    break;
                                }
                            }
                            if (goal < beginMilePost) {
                                // calculate where the line should terminate
                                var startXY = geometry.paths[0][i];
                                var endXY = geometry.paths[0][i + 1];
                                var finalLength = result.lengths[i] + goal - beginMilePost;

                                var newXY = [];
                                newXY.push(startXY[0] + (endXY[0] - startXY[0]) * finalLength / result.lengths[i]);
                                newXY.push(startXY[1] + (endXY[1] - startXY[1]) * finalLength / result.lengths[i]);

                                var p = new Point(newXY, geometry.spatialReference);
                                deferred.resolve(p);
                            } else {
                                //occurs because of rounding errors? Measures not matching up to actual lines? Some sort of projection issue?
                                //we know that we've already done a sanity check against BEGIN_POST and END_POST, so just get the last point
                                deferred.resolve(new Point(geometry.paths[0][i], geometry.spatialReference)); 
                            }
                        },
                        function (e) {
                            deferred.reject(e);
                        });
                }
            } else {
                setTimeout(function () {
                    deferred.reject('Roadway feature is missing BEGIN_POST or END_POST value');
                }, 200);
            }
            return deferred;
        }
    };
});