import React, { useEffect, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import * as d3 from 'd3'
import { parse as PathDataParse } from 'path-data'
var L = null

//const source = require('./data/aocAlsace.geojson')
const source = require('./data/states-us.geojson')

const AppCanvas = () => {
    const [mapElement, setMap] = useState(null)
    const [hovered, setHovered] = useState(null)

    useEffect(() => {
        L = require('leaflet')

        // Map creation
        if (!mapElement) {
            const origin = [37.8, -96.9]
            const initialZoom = 3

            const map = L.map('map')
                .setView(origin, initialZoom)
                .addLayer(
                    new L.TileLayer(
                        'http://{s}.tile.stamen.com/toner-lite/{z}/{x}/{y}.png'
                    )
                )

            map.whenReady(() => {
                // Create canvas element to the correct size
                const canvasLayer = L.canvas().addTo(map)
                const canvas = d3.select('#map').select('canvas')

                // Transformation (overal projection) for points on map
                // Defined for the map at this instant, must be recalculated everytime
                const projection = d3.geoTransform({
                    point: function (x, y) {
                        // Project M(x, y) to the map
                        const point = map.latLngToLayerPoint(new L.LatLng(y, x))
                        this.stream.point(point.x, point.y) // this : NO ARROW FUNCTION
                    },
                })
                const context = canvas.node().getContext('2d')
                // Path generator, generate path function according to geoJson
                // transformation, no context => svg
                // as we'll use the svg to draw on canvas after
                const path = d3.geoPath().projection(projection)
                //.context(context)

                // -------------------
                // Create an in memory only element of type 'custom'
                var detachedContainer = document.createElement('custom')
                // Create a d3 selection for the detached container. We won't actually be attaching it to the DOM.
                var dataContainer = d3.select(detachedContainer)

                d3.json(source).then((data) => {
                    // If the data may change, ie add / remove nodes
                    // see https://bocoup.com/blog/d3js-and-canvas

                    // In this example, the data doesn't change
                    var dataBinding = dataContainer
                        .selectAll('custom.path')
                        .data(data.features, function (d) {
                            return d
                        })

                    // Custom node for each element
                    dataBinding
                        .enter()
                        .append('path')
                        .attr('d', (feature) => path(feature)) // d = svp path string encoded
                        .attr('stroke', 'black')
                        .attr('fill', 'transparent')

                    var path2DElements = []

                    function drawCanvas() {
                        context.clearRect(
                            0,
                            0,
                            map.getSize().x,
                            map.getSize().y
                        )

                        path2DElements = []
                        // For each fictive path elements, draw it on the canvas
                        // with the appropriate attributes, bind with d3
                        var elements = dataContainer.selectAll('path')
                        elements.each(function (d) {
                            // store path
                            var node = d3.select(this)

                            // draw path
                            // without context, path(d) is an svg path
                            // need to render it as a canvas path
                            const p = generatePath2D(d, path)
                            context.stroke(p)
                            path2DElements.push({ path2D: p, feature: d })

                            // Add text centroid
                            context.font = '20px serif'
                            context.fillStyle = 'red'
                            context.fillText(
                                `${d.id}`,
                                path.centroid(d)[0],
                                path.centroid(d)[1]
                            )
                        })
                    }

                    drawCanvas()

                    canvasLayer.on('update', (e) => {
                        context.save()
                        context.clearRect(
                            0,
                            0,
                            map.getSize().x,
                            map.getSize().y
                        )
                        drawCanvas()
                        context.restore()
                    })

                    canvas.on('mousemove', (e) => {
                        let bound = canvas.node().getBoundingClientRect() // in case canvas is not at top left
                        let x = e.pageX - bound.left
                        let y = e.pageY - bound.top
                        for (let i = 0; i < path2DElements.length; i++) {
                            if (
                                context.isPointInPath(
                                    transformPath2DWithCanvasStyle(
                                        path2DElements[i].path2D,
                                        canvas.attr('style'),
                                        canvas.attr('width')
                                    ),
                                    map.mouseEventToLayerPoint(e).x,
                                    map.mouseEventToLayerPoint(e).y
                                )
                            ) {
                                console.log(path2DElements[i].feature.id)
                            }
                        }
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
            >
                <span
                    style={{
                        position: 'absolute',
                        top: 30,
                        left: 50,
                        zIndex: 3000,
                        fontWeight: 'bold',
                        color: 'red',
                    }}
                >
                    {(() => {
                        return hovered && `Hovered: ${hovered.id}`
                    })()}
                </span>
            </div>
        </div>
    )
}

export default AppCanvas

const transformPath2DWithCanvasStyle = (
    path2D,
    canvasStyleRaw,
    canvasWidth
) => {
    /*
        Transform a Path2D object according to the canvas styling string

        return: path2D
    */
    const path2DTransformed = new Path2D()

    // Generate canvas style object from raw style string
    const canvasStyle = canvasStyleRaw
        .split(';')
        .reduce((styleObject, styleRaw) => {
            if (styleRaw !== '') {
                return {
                    ...styleObject,
                    [styleRaw.trim().split(': ')[0]]: styleRaw
                        .trim()
                        .split(': ')[1],
                }
            }
            return styleObject
        }, {})

    // Generate transformation matrix according to canvas transform and scaling
    const calculatedScaleWidth =
        parseInt(canvasStyle.width.replace('px', '')) / canvasWidth

    var transformationMatrix = new DOMMatrix(
        `${canvasStyle.transform} scale(${calculatedScaleWidth})`
    )

    // Apply transformation
    path2DTransformed.addPath(path2D, transformationMatrix)

    return path2DTransformed
}

const generatePath2D = (feature, path) => {
    /*
        Generate a Path2D object for feature according to the path generator

        return: path2D

        M: 'moveTo',
        L: 'lineTo',
        C: 'bezierCurveTo',
        Z: 'closePath',
    */
    const path2D = new Path2D()
    const segments = PathDataParse(path(feature))

    segments.forEach((s) => {
        if (s.type === 'M') {
            path2D.moveTo(s.values[0], s.values[1])
        }
        if (s.type === 'L') {
            path2D.lineTo(s.values[0], s.values[1])
        }
        if (s.type === 'C') {
            path2D.bezierCurveTo(s.values[0], s.values[1])
        }
        if (s.type === 'Z') {
            path2D.closePath()
        }
    })

    return path2D
}
