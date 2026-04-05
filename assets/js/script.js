$( document ).ready(function() {
                function restartAnimation(selector, animationClass) {
                    $(selector).removeClass('animated slideInLeft slideInRight');
                    void $(selector)[0].offsetWidth;
                    $(selector).addClass('animated ' + animationClass);
                }

                async function renderJourneyMap() {
                    const mapShell = document.querySelector('.journey-map-shell');
                    const mapStage = mapShell ? mapShell.querySelector('.journey-map-stage') : null;
                    const mapSvg = mapShell ? mapShell.querySelector('.journey-map') : null;

                    if (!mapShell || !mapStage || !mapSvg || !window.d3 || !window.proj4) {
                        return;
                    }

                    const viewBox = mapSvg.viewBox.baseVal;
                    const mapWidth = viewBox.width;
                    const mapHeight = viewBox.height;
                    const isCompactLayout = window.matchMedia('(max-width: 777px)').matches;

                    const stopNodes = Array.from(mapStage.querySelectorAll('.journey-stop'));
                    const tileNodes = Array.from(mapShell.querySelectorAll('.journey-tile'));
                    const stops = stopNodes.map((node) => ({
                        node,
                        id: node.dataset.stopId,
                        lon: Number(node.dataset.lon),
                        lat: Number(node.dataset.lat),
                    }));
                    const labelOffsets = new Map([
                        ['stop-damme', { x: -34, y: -30 }],
                        ['stop-hannover-bsc', { x: -30, y: -56 }],
                        ['stop-berlin', { x: 30, y: -50 }],
                        ['stop-hannover-msc', { x: 30, y: 42 }],
                        ['stop-innsbruck', { x: 34, y: 34 }],
                    ]);

                    const bounds = {
                        west: -13.303137398774437,
                        south: 36.4896558289309,
                        east: 25.01717469341483,
                        north: 59.421260692021285,
                    };

                    const padding = isCompactLayout
                        ? {
                            left: 66,
                            right: 40,
                            top: 26,
                            bottom: 28,
                        }
                        : {
                            left: 142,
                            right: 6,
                            top: 18,
                            bottom: 24,
                        };

                    proj4.defs(
                        'EPSG:3035',
                        '+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +units=m +no_defs'
                    );

                    const bboxCorners3035 = [
                        proj4('EPSG:4326', 'EPSG:3035', [bounds.west, bounds.south]),
                        proj4('EPSG:4326', 'EPSG:3035', [bounds.east, bounds.south]),
                        proj4('EPSG:4326', 'EPSG:3035', [bounds.east, bounds.north]),
                        proj4('EPSG:4326', 'EPSG:3035', [bounds.west, bounds.north]),
                    ];

                    const bboxFeature3035 = {
                        type: 'Feature',
                        geometry: {
                            type: 'Polygon',
                            coordinates: [[
                                bboxCorners3035[0],
                                bboxCorners3035[1],
                                bboxCorners3035[2],
                                bboxCorners3035[3],
                                bboxCorners3035[0],
                            ]],
                        },
                    };

                    const projection = d3
                        .geoIdentity()
                        .reflectY(true)
                        .fitExtent(
                            [
                                [padding.left, padding.top],
                                [mapWidth - padding.right, mapHeight - padding.bottom],
                            ],
                            bboxFeature3035
                        );

                    const projectPoint = ([lon, lat]) => {
                        const point3035 = proj4('EPSG:4326', 'EPSG:3035', [lon, lat]);
                        return projection(point3035);
                    };

                    const getStopClassId = (stop) =>
                        Array.from(stop.node.classList).find((className) => className.indexOf('stop-') === 0);

                    const getLabelOffset = (stop) => {
                        const classId = getStopClassId(stop);
                        const baseOffset = labelOffsets.get(classId) || { x: 24, y: -24 };

                        if (isCompactLayout) {
                            return {
                                x: Math.round(baseOffset.x * 0.72),
                                y: Math.round(baseOffset.y * 0.72),
                            };
                        }

                        return baseOffset;
                    };

                    const getLabelGeometry = (stop) => {
                        const point = projectPoint([stop.lon, stop.lat]);
                        const offset = getLabelOffset(stop);
                        const labelPoint = [point[0] + offset.x, point[1] + offset.y];
                        const deltaX = labelPoint[0] - point[0];
                        const deltaY = labelPoint[1] - point[1];
                        const length = Math.hypot(deltaX, deltaY) || 1;
                        const labelInset = isCompactLayout ? 9 : 11;

                        return {
                            point,
                            labelPoint,
                            lineEnd: [
                                labelPoint[0] - ((deltaX / length) * labelInset),
                                labelPoint[1] - ((deltaY / length) * labelInset),
                            ],
                        };
                    };

                    const stopNodeById = new Map(stops.map((stop) => [stop.id, stop.node]));
                    const tileNodeById = new Map(tileNodes.map((tileNode) => [tileNode.dataset.stopId, tileNode]));
                    const leaderLineNodeById = new Map();
                    let hoveredStopId = null;
                    let pinnedStopId = null;

                    const syncInteractionState = () => {
                        const effectiveHoverStopId = pinnedStopId ? null : hoveredStopId;

                        stopNodeById.forEach((node, stopId) => {
                            node.classList.toggle('is-hovered', effectiveHoverStopId === stopId);
                            node.classList.toggle('is-pinned', pinnedStopId === stopId);
                        });

                        tileNodeById.forEach((node, stopId) => {
                            node.classList.toggle('is-hovered', effectiveHoverStopId === stopId);
                            node.classList.toggle('is-pinned', pinnedStopId === stopId);
                        });

                        leaderLineNodeById.forEach((node, stopId) => {
                            node.classList.toggle('is-hovered', effectiveHoverStopId === stopId);
                            node.classList.toggle('is-pinned', pinnedStopId === stopId);
                        });
                    };

                    const setHoveredStopId = (stopId) => {
                        hoveredStopId = stopId;
                        syncInteractionState();
                    };

                    const setPinnedStopId = (stopId) => {
                        pinnedStopId = stopId;
                        syncInteractionState();
                    };

                    const bindInteractiveEvents = (element, stopId) => {
                        element.addEventListener('mouseenter', () => setHoveredStopId(stopId));
                        element.addEventListener('mouseleave', () => setHoveredStopId(null));
                        element.addEventListener('focus', () => setHoveredStopId(stopId));
                        element.addEventListener('blur', () => setHoveredStopId(null));
                        element.addEventListener('click', (event) => {
                            event.stopPropagation();
                            setPinnedStopId(stopId);
                        });
                    };

                    const path = d3.geoPath(projection);

                    function updateExtent(coords, extent) {
                        if (!Array.isArray(coords) || coords.length === 0) {
                            return;
                        }

                        if (typeof coords[0] === 'number') {
                            const x = coords[0];
                            const y = coords[1];
                            extent.minX = Math.min(extent.minX, x);
                            extent.maxX = Math.max(extent.maxX, x);
                            extent.minY = Math.min(extent.minY, y);
                            extent.maxY = Math.max(extent.maxY, y);
                            return;
                        }

                        coords.forEach((part) => updateExtent(part, extent));
                    }

                    function featureIntersectsBbox(feature, bboxExtent) {
                        const extent = {
                            minX: Infinity,
                            maxX: -Infinity,
                            minY: Infinity,
                            maxY: -Infinity,
                        };

                        updateExtent(feature.geometry.coordinates, extent);

                        return !(
                            extent.maxX < bboxExtent.minX ||
                            extent.minX > bboxExtent.maxX ||
                            extent.maxY < bboxExtent.minY ||
                            extent.minY > bboxExtent.maxY
                        );
                    }

                    function polygonTouchesMainlandEurope(polygonCoords, westClipLongitude) {
                        let maxLongitude = -Infinity;

                        polygonCoords.forEach((ring) => {
                            ring.forEach((coord) => {
                                const lon = proj4('EPSG:3035', 'EPSG:4326', coord)[0];
                                maxLongitude = Math.max(maxLongitude, lon);
                            });
                        });

                        return maxLongitude >= westClipLongitude;
                    }

                    function trimWesternOutliers(feature, westClipLongitude) {
                        if (!feature || !feature.geometry) {
                            return null;
                        }

                        if (feature.geometry.type === 'Polygon') {
                            return polygonTouchesMainlandEurope(feature.geometry.coordinates, westClipLongitude)
                                ? feature
                                : null;
                        }

                        if (feature.geometry.type === 'MultiPolygon') {
                            const keptPolygons = feature.geometry.coordinates.filter((polygonCoords) =>
                                polygonTouchesMainlandEurope(polygonCoords, westClipLongitude)
                            );

                            if (keptPolygons.length === 0) {
                                return null;
                            }

                            return {
                                ...feature,
                                geometry: {
                                    ...feature.geometry,
                                    coordinates: keptPolygons,
                                },
                            };
                        }

                        return feature;
                    }

                    const bboxExtent3035 = {
                        minX: Math.min(...bboxCorners3035.map((coord) => coord[0])),
                        maxX: Math.max(...bboxCorners3035.map((coord) => coord[0])),
                        minY: Math.min(...bboxCorners3035.map((coord) => coord[1])),
                        maxY: Math.max(...bboxCorners3035.map((coord) => coord[1])),
                    };

                    try {
                        const geojson = window.CNTR_RG_20M_2024_3035 || await (async () => {
                            const response = await fetch('assets/data/CNTR_RG_20M_2024_3035.geojson');

                            if (!response.ok) {
                                throw new Error('Map data request failed');
                            }

                            return response.json();
                        })();
                        const includedCountries = new Set([
                            'Austria',
                            'Belgium',
                            'Croatia',
                            'Czechia',
                            'Denmark',
                            'France',
                            'Germany',
                            'Hungary',
                            'Italy',
                            'Luxembourg',
                            'Netherlands',
                            'Poland',
                            'Portugal',
                            'Slovakia',
                            'Slovenia',
                            'Spain',
                            'Switzerland',
                        ]);
                        const westClipLongitude = -10;

                        const centralEurope = geojson.features
                            .filter((feature) => {
                                const countryName = feature.properties.NAME_ENGL;

                                return includedCountries.has(countryName) && featureIntersectsBbox(feature, bboxExtent3035);
                            })
                            .map((feature) => trimWesternOutliers(feature, westClipLongitude))
                            .filter(Boolean);

                        const countryLayer = d3.select(mapSvg).select('.journey-country-layer');

                        countryLayer
                            .selectAll('path')
                            .data(centralEurope)
                            .join('path')
                            .attr('class', 'journey-country')
                            .attr('d', path);
                    } catch (error) {
                        console.warn('Journey map country rendering failed.', error);
                    }

                    const routeLayer = d3.select(mapSvg).select('.journey-route-layer');
                    const leaderLineLayer = d3.select(mapSvg).select('.journey-leader-line-layer');
                    const leaderHitLayer = d3.select(mapSvg).select('.journey-leader-hit-layer');
                    const routeSegments = d3.pairs(stops);
                    const stopAnnotations = stops.map((stop) => ({
                        stop,
                        ...getLabelGeometry(stop),
                    }));

                    leaderLineLayer
                        .selectAll('line')
                        .data(stopAnnotations)
                        .join('line')
                        .attr('class', 'journey-leader-line')
                        .attr('data-stop-id', ({ stop }) => stop.id)
                        .attr('x1', ({ point }) => point[0])
                        .attr('y1', ({ point }) => point[1])
                        .attr('x2', ({ lineEnd }) => lineEnd[0])
                        .attr('y2', ({ lineEnd }) => lineEnd[1])
                        .each(function(datum) {
                            leaderLineNodeById.set(datum.stop.id, this);
                        });

                    leaderHitLayer
                        .selectAll('line')
                        .data(stopAnnotations)
                        .join('line')
                        .attr('class', 'journey-leader-hit')
                        .attr('data-stop-id', ({ stop }) => stop.id)
                        .attr('x1', ({ point }) => point[0])
                        .attr('y1', ({ point }) => point[1])
                        .attr('x2', ({ lineEnd }) => lineEnd[0])
                        .attr('y2', ({ lineEnd }) => lineEnd[1])
                        .on('mouseenter', (_, datum) => setHoveredStopId(datum.stop.id))
                        .on('mouseleave', () => setHoveredStopId(null))
                        .on('click', (event, datum) => {
                            event.stopPropagation();
                            setPinnedStopId(datum.stop.id);
                        });

                    routeLayer
                        .selectAll('path')
                        .data(routeSegments)
                        .join('path')
                        .attr('class', 'journey-route-line')
                        .attr('marker-end', 'url(#journey-arrow)')
                        .attr('d', ([fromStop, toStop]) => {
                            const fromPoint = projectPoint([fromStop.lon, fromStop.lat]);
                            const toPoint = projectPoint([toStop.lon, toStop.lat]);

                            return `M ${fromPoint[0]} ${fromPoint[1]} L ${toPoint[0]} ${toPoint[1]}`;
                        });

                    stops.forEach((stop) => {
                        const projected = projectPoint([stop.lon, stop.lat]);
                        const labelNode = stop.node.querySelector('.journey-label');
                        const offset = getLabelOffset(stop);

                        stop.node.style.left = `${(projected[0] / mapWidth) * 100}%`;
                        stop.node.style.top = `${(projected[1] / mapHeight) * 100}%`;

                        if (labelNode) {
                            labelNode.style.left = `${offset.x}px`;
                            labelNode.style.top = `${offset.y}px`;
                            bindInteractiveEvents(labelNode, stop.id);
                        }
                    });

                    tileNodes.forEach((tileNode) => {
                        bindInteractiveEvents(tileNode, tileNode.dataset.stopId);
                    });

                    document.addEventListener('click', (event) => {
                        const interactionTarget = event.target.closest('.journey-tile, .journey-label, .journey-leader-hit');

                        if (!interactionTarget) {
                            setPinnedStopId(null);
                        }
                    });

                    syncInteractionState();
                }
                
                $("#about_scroll").fadeOut();   
                $("#work_scroll").fadeOut();
                $("#contact_scroll").fadeOut();

                renderJourneyMap();

                $("#about").click(function(){
                    $("#index").fadeOut();
                    $("#about_scroll").fadeIn();
                    restartAnimation('#about_left', 'slideInLeft');
                    restartAnimation('#about_right', 'slideInRight');
                    });
                $("#work").click(function(){
                    $("#index").fadeOut();
                    $("#work_scroll").fadeIn();
                    restartAnimation('#work_left', 'slideInLeft');
                    restartAnimation('#work_right', 'slideInRight');
                    });
                $("#contact").click(function(){
                    $("#index").fadeOut();
                    $("#contact_scroll").fadeIn();
                    restartAnimation('#contact_left', 'slideInLeft');
                    restartAnimation('#contact_right', 'slideInRight');
                    });
                
                $(".back").click(function(){
                    $(".pages").fadeOut();
                    $("#index").fadeIn();
                    restartAnimation('#index_left', 'slideInLeft');
                    restartAnimation('#index_right', 'slideInRight');
                    });
           
		});
