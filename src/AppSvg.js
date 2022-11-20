import React, { useEffect, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import * as d3 from 'd3'
var L = null

const source = require('./data/aocAlsace.geojson')
//const source = require('./data/states-us.geojson')

const AppSvg = () => {
    // https://bost.ocks.org/mike/leaflet/
    const [mapElement, setMap] = useState(null)
    const [polygonElements, setPolygons] = useState(null)
    const [pathGenerator, setPathGenerator] = useState(null)

    useEffect(() => {
        L = require('leaflet')
        // Map creation
        if (!mapElement) {
            const origin = [37.8, -96.9]
            const initialZoom = 4

            const map = L.map('map')
                .setView(origin, initialZoom)
                .addLayer(
                    new L.TileLayer(
                        'http://{s}.tile.stamen.com/toner-lite/{z}/{x}/{y}.png'
                    )
                )

            map.whenReady(() => {
                // Transformation (projection générale)
                // Définit la projection des points sur la carte
                // Définie à un instant t en fonction de la carte, statique
                const transform = d3.geoTransform({
                    point: function (x, y) {
                        // Projète le point M(x,y) sur la carte en utilisant latLngToLayerPoint
                        const point = map.latLngToLayerPoint(new L.LatLng(y, x))
                        this.stream.point(point.x, point.y) // this : NO ARROW FUNCTION
                    },
                })

                // Path generator, function qui génère le path en fonction du geoJson
                // transformation, pas de contexte
                const path = d3.geoPath().projection(transform)
                setMap(map)
                setPathGenerator(() => path)
            })
        }
        // Polygons creation
        if (mapElement && pathGenerator && !polygonElements) {
            d3.json(source).then((data) => {
                // Ajout d'une sur couche svg
                /*
                const svg = d3
                    .select(mapElement.getPanes().overlayPane)
                    .append('svg')
                    */
                // L'utilisation de .getPanes().overlayPane crée un svg de taille nulle
                // Il faut recaler la taille et déplacer le centre du svg qui a bougé en changeant la taille
                L.svg().addTo(mapElement)
                const svg = d3.select('#map').select('svg')
                const g = svg.append('g')

                // Création des polygons
                const polygons = g
                    .selectAll('path')
                    .data(data.features)
                    .enter()
                    .append('path')
                    .attr('d', (feature) => pathGenerator(feature)) // d = svp path string encoded
                //setPolygons(polygons)

                // Recalage de la taille du svg s'il n'en a pas
                /*
                const bounds = path.bounds(data)
                const topLeft = bounds[0]
                const bottomRight = bounds[1]
                // Définition de la taille du svg pour supporter tous les éléments
                svg.attr('width', bottomRight[0] - topLeft[0])
                    .attr('height', bottomRight[1] - topLeft[1])
                    .style('left', topLeft[0] + 'px')
                    .style('top', topLeft[1] + 'px')
                g.attr(
                        'transform',
                        'translate(' + -topLeft[0] + ',' + -topLeft[1] + ')'
                    )
                */

                mapElement.on('zoom', () => {
                    polygons.attr('d', (feature) => pathGenerator(feature))
                })
            })
        }
    })

    return (
        <div>
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 0,
                }}
                id="map"
            ></div>
        </div>
    )
}

export default AppSvg
