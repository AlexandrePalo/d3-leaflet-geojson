import React, { useEffect, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import * as d3 from 'd3'
var L = null

//const source = require('./data/aocAlsace.geojson')
const source = require('./data/states-us.geojson')

const AppCanvas = () => {
    const [mapElement, setMap] = useState(null)

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
                // Create canvas element to the correct size
                // Diseppears on pan or zoom with this solution ...

                const canvasLayer = L.canvas().addTo(map)
                const canvas = d3.select('#map').select('canvas')

                /*
                document
                    .getElementsByClassName(
                        'leaflet-pane leaflet-overlay-pane'
                    )[0]
                    .appendChild(document.createElement('canvas'))
                const canvas = d3.select('#map').select('canvas')
                canvas.attr('height', `${map.getSize().y}px`)
                canvas.attr('width', `${map.getSize().x}px`)
                */

                // Transformation (projection générale)
                // Définit la projection des points sur la carte
                // Définie à un instant t en fonction de la carte, statique
                const projection = d3.geoTransform({
                    point: function (x, y) {
                        // Projète le point M(x,y) sur la carte en utilisant latLngToLayerPoint
                        const point = map.latLngToLayerPoint(new L.LatLng(y, x))
                        this.stream.point(point.x, point.y) // this : NO ARROW FUNCTION
                    },
                })
                const context = canvas.node().getContext('2d')
                // Path generator, function qui génère le path en fonction du geoJson
                // transformation, contexte
                const path = d3
                    .geoPath()
                    .projection(projection)
                    .context(context)

                d3.json(source).then((data) => {
                    context.beginPath()
                    path(data)
                    context.stroke()

                    canvasLayer.on('update', (e) => {
                        context.save()
                        context.clearRect(
                            0,
                            0,
                            map.getSize().x,
                            map.getSize().y
                        )
                        context.beginPath()
                        path(data)
                        context.stroke()
                        context.restore()
                    })
                })

                setMap(map)
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

export default AppCanvas
