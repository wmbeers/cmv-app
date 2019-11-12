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
    'esri/geometry/projection',
    'esri/tasks/GeometryService',
    'esri/tasks/LengthsParameters'
],
function (Deferred, topic, FeatureSet, RouteParameters, RouteTask, Query, Graphic, QueryTask, Point, PolyLine, projection, GeometryService, LengthsParameters) {
    /**
    * Helper class for extracting points routes from the FDOT basemap.
    */
    return {

        addRciBasemapToMap: function () {
            var rciService = {
                id: 7311,
                type: 'dynamic',
                name: 'RCI Basemap',
                url: 'https://pisces.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/RCI_Base/MapServer/'
            };
            topic.publish('layerLoader/addLayerFromCategoryDef', rciService);
        },

        /**
         * Gets the roadway feature from the basemap with the specified roadway ID
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
            queryTask.execute(query).then(
                function (reply) {
                    if (reply.features && reply.features.length > 0) {
                        var feature = reply.features[0]; //ROADWAY is a unique identifier, so never more than one
                        if (!projection.isLoaded()) {
                            projection.load().then(function () {
                                feature.geometry = projection.project(feature.geometry, app.map.spatialReference); //TODO avoid app.map reference, somehow; probably easiest to just define it
                                deferred.resolve(feature);
                            });
                        } else {
                            //project the polyline
                            feature.geometry = projection.project(feature.geometry, app.map.spatialReference);
                            deferred.resolve(feature);
                        }
                    }
                },
                function (e) {
                    deferred.reject(e);
                });
            return deferred;
        },

        /**
         * Extracts a point along the specified roadway at the specified milepost.
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
         * Extracts the route from the basemap between any two points. Currently the two points must be along the same roadway.
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
            rt.solve(params,
                function (result) {
                    var pl = result.routeResults[0].route.geometry;
                    if (!projection.isLoaded()) {
                        projection.load().then(function () {
                            var plWM = projection.project(pl, p1.spatialReference);
                            deferred.resolve(plWM);
                        });
                    } else {
                        //project the polyline
                        var plWM = projection.project(pl, p1.spatialReference);
                        deferred.resolve(plWM);
                    }
                },
                function (e) {
                    deferred.reject(e);
                });

            return deferred;
        },

        /**
         * Gets the point along the given polyline at the specified distance.
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
                beginMilePost = feature.attributes && feature.attributes.BEGIN_POST || null,
                endMilePost = feature.attributes && feature.attributes.END_POST || null,
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
                                deferred.reject('Requested distance ' + distance + ' exceeds length of line.');
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