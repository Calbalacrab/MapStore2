/**
 * Copyright 2015, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
var ol = require('openlayers');
var CoordinatesUtils = require('../../../utils/CoordinatesUtils');
var wgs84Sphere = new ol.Sphere(6378137);

const MeasurementSupport = React.createClass({
    propTypes: {
        map: React.PropTypes.object,
        projection: React.PropTypes.string,
        measurement: React.PropTypes.object,
        changeMeasurementState: React.PropTypes.func
    },
    componentWillReceiveProps(newProps) {

        if (this.props.measurement.geomType !== newProps.measurement.geomType &&
                newProps.measurement.geomType !== null) {
            this.addDrawInteraction(newProps);
        }

        if (newProps.measurement.geomType === null) {
            this.removeDrawInteraction();
        }
    },
    render() {
        return null;
    },
    addDrawInteraction: function(newProps) {

        var source;
        var vector;
        var draw;
        var geometryType;
        // cleanup old interaction
        if (this.drawInteraction) {
            this.removeDrawInteraction();
        }
        // create a layer to draw on
        source = new ol.source.Vector();
        vector = new ol.layer.Vector({
            source: source,
            zIndex: 1000000,
            style: new ol.style.Style({
                fill: new ol.style.Fill({
                    color: 'rgba(255, 255, 255, 0.2)'
                }),
                stroke: new ol.style.Stroke({
                    color: '#ffcc33',
                  width: 2
                }),
                image: new ol.style.Circle({
                    radius: 7,
                    fill: new ol.style.Fill({
                        color: '#ffcc33'
                    })
                })
            })
        });
        this.props.map.addLayer(vector);

        if (newProps.measurement.geomType === 'Bearing') {
            geometryType = 'LineString';
        } else {
            geometryType = newProps.measurement.geomType;
        }

        // create an interaction to draw with
        draw = new ol.interaction.Draw({
            source: source,
            type: /** @type {ol.geom.GeometryType} */ geometryType,
            style: new ol.style.Style({
                fill: new ol.style.Fill({
                    color: 'rgba(255, 255, 255, 0.2)'
                }),
                stroke: new ol.style.Stroke({
                    color: 'rgba(0, 0, 0, 0.5)',
                    lineDash: [10, 10],
                    width: 2
                }),
                image: new ol.style.Circle({
                    radius: 5,
                    stroke: new ol.style.Stroke({
                        color: 'rgba(0, 0, 0, 0.7)'
                    }),
                    fill: new ol.style.Fill({
                        color: 'rgba(255, 255, 255, 0.2)'
                    })
                })
            })
        });

        // update measurement results for every new vertex drawn
        this.props.map.on('click', this.updateMeasurementResults, this);

        draw.on('drawstart', function(evt) {
            // preserv the sketch feature of the draw controller
            // to update length/area on drawing a new vertex
            this.sketchFeature = evt.feature;
            // clear previous measurements
            source.clear();
        }, this);

        this.props.map.addInteraction(draw);
        this.drawInteraction = draw;
        this.measureLayer = vector;
    },
    removeDrawInteraction: function() {
        if (this.drawInteraction !== null) {
            this.props.map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;
            this.props.map.removeLayer(this.measureLayer);
            this.sketchFeature = null;
            this.props.map.un('click', this.updateMeasurementResults, this);
        }
    },
    updateMeasurementResults() {

        var bearing = 0;
        var sketchCoords = this.sketchFeature.getGeometry().getCoordinates();
        var newMeasureState;

        if (this.props.measurement.geomType === 'Bearing' &&
                sketchCoords.length > 2) {
            this.drawInteraction.finishDrawing();
            // calculate the azimuth as base for bearing information
            bearing = CoordinatesUtils.calculateAzimuth(
                sketchCoords[0], sketchCoords[1], this.props.projection);
        }

        newMeasureState = {
            lineMeasureEnabled: this.props.measurement.lineMeasureEnabled,
            areaMeasureEnabled: this.props.measurement.areaMeasureEnabled,
            bearingMeasureEnabled: this.props.measurement.bearingMeasureEnabled,
            geomType: this.props.measurement.geomType,
            len: this.props.measurement.geomType === 'LineString' ?
                this.calculateGeodesicDistance(sketchCoords) : 0,
            area: this.props.measurement.geomType === 'Polygon' ?
                this.calculateGeodesicArea(this.sketchFeature.getGeometry().getLinearRing(0).getCoordinates()) : 0,
            bearing: this.props.measurement.geomType === 'Bearing' ? bearing : 0
        };
        this.props.changeMeasurementState(newMeasureState);
    },
    reprojectedCoordinates: function(coordinates) {
        return coordinates.map((coordinate) => {
            let reprojectedCoordinate = CoordinatesUtils.reproject(coordinate, this.props.projection, 'EPSG:4326');
            return [reprojectedCoordinate.x, reprojectedCoordinate.y];
        });
    },
    calculateGeodesicDistance: function(coordinates) {
        let reprojectedCoordinates = this.reprojectedCoordinates(coordinates);
        let length = 0;
        for (let i = 0; i < reprojectedCoordinates.length - 1; ++i) {
            length += wgs84Sphere.haversineDistance(reprojectedCoordinates[i], reprojectedCoordinates[i + 1]);
        }
        return length;
    },
    calculateGeodesicArea: function(coordinates) {
        let reprojectedCoordinates = this.reprojectedCoordinates(coordinates);
        return Math.abs(wgs84Sphere.geodesicArea(reprojectedCoordinates));
    }
});

module.exports = MeasurementSupport;
