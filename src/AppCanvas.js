import React, { useEffect, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import * as d3 from 'd3'
import { parse as PathDataParse } from 'path-data'
var L = null

//const source = require('./data/aocAlsace.geojson')
const source = require('./data/states-us.geojson')

const AppCanvas = () => {
    // App rerenders when a state change
    const [mapElement, setMap] = useState(null)
    const [data, setData] = useState([])
    //const [pathElements, setPathElements] = useState([])
    const [hovered, setHovered] = useState(null)
    // Path2D elements collections for canvas interaction
    var path2DElements = []

    useEffect(() => {
        L = require('leaflet')

        // Drawing function
        function drawCanvas() {
            if (!mapElement) {
                return
            }

            const canvas = d3.select('#map').select('canvas')

            // Transformation (overal projection) for points on map
            // Defined for the map at this instant, must be recalculated everytime
            const projection = d3.geoTransform({
                point: function (x, y) {
                    // Project M(x, y) to the map
                    const point = mapElement.latLngToLayerPoint(
                        new L.LatLng(y, x)
                    )
                    this.stream.point(point.x, point.y) // this : NO ARROW FUNCTION
                },
            })
            const context = canvas.node().getContext('2d')
            // Path generator, generate path function according to geoJson
            // transformation, no context => svg
            // as we'll use the svg to draw on canvas after
            const path = d3.geoPath().projection(projection)
            //.context(context)

            // Regenerate path2DElements
            path2DElements = []
            data.forEach(function (d) {
                // Create path
                // without context, path(d) is an svg path
                // need to render it as a canvas path
                path2DElements.push({
                    path2D: generatePath2D(d, path),
                    feature: d,
                    draw: {
                        strokeStyle: 'rgb(0,0,0)',
                        fillStyle:
                            hovered && d.id === hovered.id
                                ? 'rgba(0,0,0,0.3)'
                                : 'transparent',
                    },
                })
            })

            // Clear current canvas
            context.clearRect(
                0,
                0,
                mapElement.getSize().x,
                mapElement.getSize().y
            )

            // Redraw path2DElements
            path2DElements.forEach((p) => {
                context.strokeStyle = p.draw.strokeStyle
                context.stroke(p.path2D)
                context.fillStyle = p.draw.fillStyle
                context.fill(p.path2D)
            })
        }

        // Data or map changed, rerender
        if (mapElement && data) {
            console.log('General re-render')

            // Remove all layers, except tile layer
            mapElement.eachLayer((layer) => {
                !layer
                    .getPane()
                    .getAttribute('class')
                    .includes('leaflet-tile-pane') &&
                    mapElement.removeLayer(layer)
            })
            // Create / recreate canvas
            const canvasLayer = L.canvas().addTo(mapElement)
            const canvas = d3.select('#map').select('canvas')

            // Draw / redraw canvas
            drawCanvas()

            // Define / redefine the update method
            canvasLayer.on('update', (e) => {
                console.log('update')

                const context = canvas.node().getContext('2d')
                context.save()
                context.clearRect(
                    0,
                    0,
                    mapElement.getSize().x,
                    mapElement.getSize().y
                )
                //generateCustoms(data)
                drawCanvas()
                context.restore()
            })

            // Define / redefine interactions
            // Handle mousemove
            canvas.on('mousemove', (e) => {
                // TODO : check when map isn't at top left
                //let bound = canvas.node().getBoundingClientRect() // in case canvas is not at top left
                //let x = e.pageX - bound.left
                //let y = e.pageY - bound.top
                const context = canvas.node().getContext('2d')

                var currentHovered = null
                for (let i = 0; i < path2DElements.length; i++) {
                    const d = path2DElements[i]
                    if (
                        context.isPointInPath(
                            transformPath2DWithCanvasStyle(
                                d.path2D,
                                canvas.attr('style'),
                                canvas.attr('width')
                            ),
                            mapElement.mouseEventToLayerPoint(e).x,
                            mapElement.mouseEventToLayerPoint(e).y
                        )
                    ) {
                        currentHovered = d.feature
                        break
                    }
                }
                setHovered(currentHovered) // null or defined
            })
        }

        // Map creation
        if (
            !mapElement &&
            !document
                .getElementById('map')
                .classList.contains('leaflet-container')
        ) {
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
                //const canvasLayer = L.canvas().addTo(map)
                const canvas = d3.select('#map').select('canvas')
                setMap(map)

                d3.json(source).then((data) => {
                    // If the data may change, ie add / remove nodes
                    // see https://bocoup.com/blog/d3js-and-canvas

                    // Here data doesn't change
                    setData(
                        data.features.map((feature, i) => ({
                            ...feature,
                            id: i,
                        }))
                    )
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
