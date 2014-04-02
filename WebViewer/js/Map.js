dojo.provide("observer.CivMap");
dojo.require("observer.EmptyLayer");
dojo.require("esri.map");
dojo.require("dojo.hash");

dojo.declare("observer.CivMap", null, {
    app: null,
    iconWidth: 17,
    iconHeight: 17,
    iconFrameSize: 20,
    iconFrameWidth: 3,
    map: null,
    game: null,
    cityMode: false,
    mapId: "map",
    fogOfWarRenderer: null,
    workedTileRenderer: null,
    terrainRenderer: null,
    bonusRenderer: null,
    improvementRenderer: null,
    featureRenderer: null,
    plotTypeRenderer: null,
    cultureRenderer: null,
    outlineRenderer: null,
    roadRenderer: null,
    riverRenderer: null,
    unitRenderer: null,
    unitOwnerRenderer: null,
    emptyLayer: null,
    fogOfWarLayer: null,
    workedTileLayer: null,
    terrainLayer: null,
    bonusLayer: null,
    improvementLayer: null,
    featureLayer: null,
    plotTypeLayer: null,
    cultureLayer: null,
    cityLayer: null,
    roadLayer: null,
    riverLayer: null,
    unitLayer: null,
    unitOwnerLayer: null,
    citySymbol: null,
    hoverFrozen: false,
    frozenPlot: null,
    mapExtentChangeHandle: null,

    constructor: function (args) {
        dojo.safeMixin(this, args);
        if (!this.cityMode) this.createMap();
    },

    createMap: function () {
        this.map = new esri.Map(this.mapId, { slider: !this.cityMode, displayGraphicsOnPan: !this.cityMode });
        dojo.connect(this.map, "onLoad", this, this.onMapLoad);
        this.emptyLayer = new observer.EmptyLayer(this.cityMode ? { xmin: 0, ymin: 0, xmax: 7, ymax: 7} : null, this.app);
        this.map.addLayer(this.emptyLayer);
    },

    createPlayerDependentRenderers: function () {
        if (this.game == null) return;
        this.cultureRenderer = new esri.renderer.UniqueValueRenderer(null, "o");
        dojo.forEach(this.game.players, function (player) {
            this.cultureRenderer.addValue({
                value: player.ID,
                symbol: new esri.symbol.SimpleFillSymbol().setColor(player.colors.primary),
                label: player.name
            });
        }, this);
        if(this.cultureLayer != null) this.cultureLayer.setRenderer(this.cultureRenderer);
        this.unitOwnerRenderer = new esri.renderer.UniqueValueRenderer(null, "uo");
        dojo.forEach([].concat(this.game.players, [this.game.barbarians]), function (player) {
            this.unitOwnerRenderer.addValue({
                value: player.ID,
                symbol: new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_SQUARE, this.iconFramSize,
                   new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, player.colors.primary, this.iconFramWidth),
                   new dojo.Color([0, 0, 0, 0])),
                label: player.name
            });
        }, this);
        if(this.unitOwnerLayer != null) this.unitOwnerLayer.setRenderer(this.unitOwnerRenderer);
    },

    showGame: function (game) {
        this.game = game;
        this.createPlayerDependentRenderers();
        if (!this.cityMode) this.addGrid(function (plot) { return plot; });
    },

    onMapLoad: function () {
        this.createRenderers();
        this.map.disableDoubleClickZoom();
        if (this.cityMode) this.map.disableMapNavigation();
        dojo.connect(this.map, "onMouseMove", this, this.onMapMouseMove);
        dojo.connect(this.map, "onDblClick", this, this.onMapDblClick);
        dojo.connect(this.map, "onClick", this, this.onMapClick);
        if (!this.cityMode) this.mapExtentChangeHandle = dojo.connect(this.map, "onExtentChange", this, this.onMapExtentChange);
    },

    onMapExtentChange: function () {
        this.app.updateHash();
    },

    getHashParams: function () {
        var params = [];
        var e = { xmin: Math.round(this.map.extent.xmin - this.app.xOrigin), ymin: Math.round(this.map.extent.ymin - this.app.yOrigin), xmax: Math.round(this.map.extent.xmax - this.app.xOrigin - 1), ymax: Math.floor(this.map.extent.ymax - this.app.yOrigin - 1) };
        if (e.xmax < e.xmin) e.xmax = e.xmin;
        if (e.ymax < e.ymin) e.ymax = e.ymin;
        params.push(e.xmin + ":" + e.ymin + ":" + e.xmax + ":" + e.ymax);
        params.push(this.frozenPlot ? this.frozenPlot.x + ":" + this.frozenPlot.y : "x");
        return params;
    },

    onMapLoaded: function () {
    },

    refresh: function () {
        this.bonusLayer.refresh();
        this.improvementLayer.refresh();
        this.fogOfWarLayer.refresh();
        this.terrainLayer.refresh();
        this.cultureLayer.refresh();
        this.featureLayer.refresh();
        this.plotTypeLayer.refresh();
        this.riverLayer.refresh();
        this.roadLayer.refresh();
        this.unitLayer.refresh();
        this.unitOwnerLayer.refresh();
        this.workedTileLayer.refresh();
        if (!this.cityMode) this.populateCityLayer();
    },

    setVisibleLayers: function (options) {
        var r = this.terrainLayer.renderer;
        if (!!options.terrain)
            this.terrainLayer.setRenderer(this.terrainRenderer);
        else
            this.terrainLayer.setRenderer(this.outlineRenderer);
        if (r != this.terrainLayer.renderer) this.terrainLayer.refresh();
        this.fogOfWarLayer.setVisibility(!!options.fogOfWar);
        this.featureLayer.setVisibility(!!options.features);
        this.plotTypeLayer.setVisibility(!!options.plotTypes);
        this.unitLayer.setVisibility(!!options.units);
        this.unitOwnerLayer.setVisibility(!!options.units);
        this.riverLayer.setVisibility(!!options.rivers);
        this.roadLayer.setVisibility(!!options.roads);
        this.cityLayer.setVisibility(!!options.cities);
        this.bonusLayer.setVisibility(!!options.resources);
        this.improvementLayer.setVisibility(!!options.improvements);
        this.cultureLayer.setVisibility(!!options.culture);
        this.workedTileLayer.setVisibility(!!options.workedTiles);
    },

    createRenderers: function () {
        var mapOptions = this.app.getMapOptions();
        if (this.cityMode) mapOptions = {
            terrain: true,
            plotTypes: true,
            features: true,
            units: false,
            rivers: true,
            cities: false,
            resources: true,
            improvements: true,
            culture: false,
            roads: true,
            workedTiles: true,
            fogOfWar: true
        };
        this.citySymbol = new esri.symbol.PictureMarkerSymbol({
            "url": "symbols/buildings/Building_1.png",
            "height": this.iconHeight,
            "width": this.iconWidth,
            "xoffsetx": -Math.floor(this.iconWidth/2),
            "yoffsety": -Math.floor(this.iconHeight/2),
            "type": "esriPMS"
        });
        var riverSymbol = new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([0, 0, 128]), 3);
        var roadSymbol = new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([224, 142, 27]), 2);
        var railroadSymbol = new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([156, 126, 86]), 2);
        var noRiverSymbol = new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_NONE, new dojo.Color([0, 0, 128]), 3);
        this.riverRenderer = new esri.renderer.UniqueValueRenderer(riverSymbol, "isRevealed");
        //add symbol for each possible value
        this.riverRenderer.addValue({
            value: true,
            symbol: riverSymbol,
            label: "River"
        });
        this.riverRenderer.addValue({
            value: false,
            symbol: noRiverSymbol,
            label: "Fogged river"
        });
        this.roadRenderer = new esri.renderer.UniqueValueRenderer(noRiverSymbol, "r");
        //add symbol for each possible value
        this.roadRenderer.addValue({
            value: 0,
            symbol: roadSymbol,
            label: "Road"
        });
        this.roadRenderer.addValue({
            value: 1,
            symbol: railroadSymbol,
            label: "Railroad"
        });
        this.workedTileRenderer = new esri.renderer.UniqueValueRenderer(null, "w");
        var workedTileSymbol = new esri.symbol.SimpleFillSymbol().setStyle(esri.symbol.SimpleFillSymbol.STYLE_NULL);
        workedTileSymbol.outline.setStyle(esri.symbol.SimpleLineSymbol.STYLE_SOLID).setColor(new dojo.Color([255, 255, 255, 1]));
        this.workedTileRenderer.addValue({
            value: true,
            symbol: workedTileSymbol,
            label: "Worked"
        });
        this.fogOfWarRenderer = new esri.renderer.UniqueValueRenderer(null, "isVisible");
        this.fogOfWarRenderer.addValue({
            value: false,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([0, 0, 0, 1])),
            label: "Fogged"
        });
        this.outlineRenderer = new esri.renderer.UniqueValueRenderer(null, "t");
        this.outlineRenderer.addValue({
            value: -1,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([0, 0, 0, 1])),
            label: "Unrevealed"
        });
        dojo.forEach([0, 1, 2, 3, 4, 7, 8], function (t) {
            this.outlineRenderer.addValue({
                value: t,
                symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([180, 180, 180, 1])),
                label: "Land"
            });
        }, this);
        dojo.forEach([5, 6], function (t) {
            this.outlineRenderer.addValue({
                value: t,
                symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([255, 255, 255, 1])),
                label: "Water"
            });
        }, this);
        this.terrainRenderer = new esri.renderer.UniqueValueRenderer(null, "t");
        //add symbol for each possible value
        this.terrainRenderer.addValue({
            value: 0,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([141, 217, 128, 1])),
            //new esri.symbol.PictureFillSymbol('images/sand.png', new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color('#000'), 1), 42, 42);
            label: "Grassland"
        });
        this.terrainRenderer.addValue({
            value: 1,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([237, 197, 36, 1])),
            label: "Plains"
        });
        this.terrainRenderer.addValue({
            value: 2,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([242, 230, 179, 1])),
            label: "Desert"
        });
        this.terrainRenderer.addValue({
            value: 3,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([191, 210, 214, 1])),
            label: "Tundra"
        });
        this.terrainRenderer.addValue({
            value: 4,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([240, 248, 250, 1])),
            label: "Ice"
        });
        this.terrainRenderer.addValue({
            value: 5,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([123, 175, 227, 1])),
            label: "Coast"
        });
        this.terrainRenderer.addValue({
            value: 6,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([17, 104, 191, 1])),
            label: "Ocean"
        });
        this.terrainRenderer.addValue({
            value: 7,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([4, 23, 41, 1])),
            label: "Peak"
        });
        this.terrainRenderer.addValue({
            value: 8,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([77, 115, 72, 1])),
            label: "Hills"
        });
        this.terrainRenderer.addValue({
            value: -1,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([0, 0, 0, 1])),
            label: "Unrevealed"
        });
        this.plotTypeRenderer = new esri.renderer.UniqueValueRenderer(null, "p");
        this.plotTypeRenderer.addValue({
            value: 0,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([0, 0, 0, 1])).setStyle(esri.symbol.SimpleFillSymbol.STYLE_SOLID).setOutline(new esri.symbol.SimpleLineSymbol().setStyle(esri.symbol.SimpleLineSymbol.STYLE_NULL)),
            label: "Peak"
        });
        this.plotTypeRenderer.addValue({
            value: 1,
            //symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([0, 0, 0, 1])).setStyle(esri.symbol.SimpleFillSymbol.STYLE_SOLID).setOutline(new esri.symbol.SimpleLineSymbol().setStyle(esri.symbol.SimpleLineSymbol.STYLE_NULL)),
            symbol: new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([0, 0, 0, 1])).setStyle(esri.symbol.SimpleLineSymbol.STYLE_SOLID),
            label: "Hill"
        });
        this.featureRenderer = new esri.renderer.UniqueValueRenderer(null, "f");
        this.featureRenderer.addValue({
            value: 0,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([255, 255, 255, 1])).setStyle(esri.symbol.SimpleFillSymbol.STYLE_SOLID).setOutline(new esri.symbol.SimpleLineSymbol().setStyle(esri.symbol.SimpleLineSymbol.STYLE_NULL)),
            label: "Ice"
        });
        this.featureRenderer.addValue({
            value: 1,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([208, 237, 17, 1])).setStyle(esri.symbol.SimpleFillSymbol.STYLE_SOLID).setOutline(new esri.symbol.SimpleLineSymbol().setStyle(esri.symbol.SimpleLineSymbol.STYLE_NULL)),
            label: "Jungle"
        });
        this.featureRenderer.addValue({
            value: 2,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([5, 241, 244, 1])).setStyle(esri.symbol.SimpleFillSymbol.STYLE_SOLID).setOutline(new esri.symbol.SimpleLineSymbol().setStyle(esri.symbol.SimpleLineSymbol.STYLE_NULL)),
            label: "Oasis"
        });
        this.featureRenderer.addValue({
            value: 3,
            symbol: new esri.symbol.SimpleLineSymbol().setColor(new dojo.Color([5, 241, 244, 1])).setStyle(esri.symbol.SimpleLineSymbol.STYLE_SOLID),
            label: "Flood plains"
        });
        this.featureRenderer.addValue({
            value: 4,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([51, 102, 33, 1])).setStyle(esri.symbol.SimpleFillSymbol.STYLE_SOLID).setOutline(new esri.symbol.SimpleLineSymbol().setStyle(esri.symbol.SimpleLineSymbol.STYLE_NULL)),
            label: "Forest"
        });
        this.featureRenderer.addValue({
            value: 5,
            symbol: new esri.symbol.SimpleFillSymbol().setColor(new dojo.Color([255, 157, 0, 1])).setStyle(esri.symbol.SimpleFillSymbol.STYLE_SOLID),
            label: "Fallout"
        });
        this.bonusRenderer = new esri.renderer.UniqueValueRenderer(null, "b");
        //add symbol for each possible value
        dojo.forEach(xml.Civ4BonusInfos.BonusInfos.BonusInfo, function (bonusInfo, index) {
            this.bonusRenderer.addValue({
                value: index,
                symbol: new esri.symbol.PictureMarkerSymbol({
                    "url": "symbols/bonus/" + index + ".png",
                    "height": this.iconHeight,
                    "width": this.iconWidth,
                    "xoffsetx": -Math.floor(this.iconWidth / 2),
                    "yoffsety": -Math.floor(this.iconHeight / 2),
                    "type": "esriPMS"
                }),
                label: bonusInfo.Type
            });
        }, this);
        this.improvementRenderer = new esri.renderer.UniqueValueRenderer(null, "i");
        //add symbol for each possible value
        dojo.forEach(xml.Civ4ImprovementInfos.ImprovementInfos.ImprovementInfo, function (improvementInfo, index) {
            if (index < 2) return; // Skip IMPROVEMENT_LAND_WORKED and IMPROVEMENT_WATER_WORKED
            this.improvementRenderer.addValue({
                value: index,
                symbol: new esri.symbol.PictureMarkerSymbol({
                    "url": "symbols/improvements/Improvement_" + (index - 1) + ".png",
                    "height": this.iconHeight,
                    "width": this.iconWidth,
                    "xoffsetx": -Math.floor(this.iconWidth / 2),
                    "yoffsety": -Math.floor(this.iconHeight / 2),
                    "type": "esriPMS"
                }),
                label: improvementInfo.Type
            });
        }, this);
        this.unitRenderer = new esri.renderer.UniqueValueRenderer(null, "u");
        dojo.forEach(xml.Civ4UnitInfos.UnitInfos.UnitInfo, function (unitInfo, index) {
            this.unitRenderer.addValue({
                value: index,
                symbol: new esri.symbol.PictureMarkerSymbol({
                    "url": "symbols/units/Unit_" + (index + 1) + ".png",
                    "height": this.iconHeight,
                    "width": this.iconWidth,
                    "xoffsetx": -Math.floor(this.iconWidth / 2),
                    "yoffsety": -Math.floor(this.iconHeight / 2),
                    "type": "esriPMS"
                }),
                label: unitInfo.Type
            });
        }, this);
        this.createPlayerDependentRenderers();

        this.terrainLayer = this.createGraphicsLayer({ visible: !!mapOptions.terrain }, this.terrainRenderer);
        this.featureLayer = this.createGraphicsLayer({ visible: !!mapOptions.features }, this.featureRenderer);
        this.plotTypeLayer = this.createGraphicsLayer({ visible: !!mapOptions.plotTypes }, this.plotTypeRenderer);
        this.riverLayer = this.createGraphicsLayer({ visible: !!mapOptions.rivers }, this.riverRenderer);
        this.roadLayer = this.createGraphicsLayer({ visible: !!mapOptions.roads }, this.roadRenderer);
        this.bonusLayer = this.createGraphicsLayer({ visible: !!mapOptions.resources }, this.bonusRenderer);
        this.improvementLayer = this.createGraphicsLayer({ visible: !!mapOptions.improvements }, this.improvementRenderer);
        this.unitOwnerLayer = this.createGraphicsLayer({ visible: !!mapOptions.units }, this.unitOwnerRenderer);
        this.unitLayer = this.createGraphicsLayer({ visible: !!mapOptions.units }, this.unitRenderer);
        this.cultureLayer = this.createGraphicsLayer({ visible: !!mapOptions.culture, opacity: 0.9 }, this.cultureRenderer);
        this.cityLayer = this.createGraphicsLayer({ visible: !!mapOptions.cities }, null);
        this.workedTileLayer = this.createGraphicsLayer({ visible: !!mapOptions.workedTiles }, this.workedTileRenderer);
        this.fogOfWarLayer = this.createGraphicsLayer({ visible: !!mapOptions.fogOfWar, opacity: 0.5 }, this.fogOfWarRenderer);
    },

    zoomToArea: function (minX, minY, maxX, maxY) {
        var ext = new esri.geometry.Extent({ "xmin": this.app.xOrigin + minX - 2, "ymin": this.app.yOrigin + minY - 2, "xmax": this.app.xOrigin + maxX + 3, "ymax": this.app.yOrigin + maxY + 3, "spatialReference": this.map.spatialReference });
        //ext = ext.expand(1.1);
        this.map.setExtent(ext, true);
    },

    setArea: function (minX, minY, maxX, maxY) {
        var ext = new esri.geometry.Extent({ "xmin": this.app.xOrigin + minX - 0.1, "ymin": this.app.yOrigin + minY - 0.1, "xmax": this.app.xOrigin + maxX + 1.1, "ymax": this.app.yOrigin + maxY + 1.1, "spatialReference": this.map.spatialReference });
        if (dojo.toJson(ext) != dojo.toJson(this.map.extent)) {
            if (this.mapExtentChangeHandle) {
                dojo.disconnect(this.mapExtentChangeHandle);
                this.mapExtentChangeHandle = dojo.connect(this.map, "onExtentChange", this, function () {
                    dojo.disconnect(this.mapExtentChangeHandle);
                    this.mapExtentChangeHandle = dojo.connect(this.map, "onExtentChange", this, this.onMapExtentChange);
                });
                this.map.setExtent(ext, false);
            }
            else
                this.map.setExtent(ext, false);
        }
    },

    createGraphicsLayer: function (options, renderer) {
        var layer = new esri.layers.GraphicsLayer(options);
        if (renderer) layer.setRenderer(renderer);
        layer.spatialReference = this.map.spatialReference;
        layer.initialExtent = this.emptyLayer.initialExtent;
        layer.fullExtent = this.emptyLayer.fullExtent;
        this.map.addLayer(layer);
        return layer;
    },

    addGrid: function (checkAddTile) {
        this.terrainLayer.clear();
        this.featureLayer.clear();
        this.plotTypeLayer.clear();
        this.bonusLayer.clear();
        this.improvementLayer.clear();
        this.unitLayer.clear();
        this.unitOwnerLayer.clear();
        this.cultureLayer.clear();
        this.riverLayer.clear();
        this.roadLayer.clear();
        this.cityLayer.clear();
        this.workedTileLayer.clear();
        this.fogOfWarLayer.clear();
        dojo.forEach(this.game.map.plots, function (plot) {
            plot = checkAddTile(plot);
            if (plot == null) return;
            var poly = new esri.geometry.Polygon(this.map.spatialReference);
            var minX = this.app.xOrigin + plot.x;
            var minY = this.app.yOrigin + plot.y;
            var maxX = this.app.xOrigin + plot.x + 1;
            var maxY = this.app.yOrigin + plot.y + 1;
            poly.addRing([[minX, minY], [minX, maxY], [maxX, maxY], [maxX, minY], [minX, minY]]);
            this.terrainLayer.add(new esri.Graphic(poly, null, plot));
            var feature = this._createFeatureSymbol(plot.feature, (minX + maxX) / 2, (minY + maxY) / 2);
            if (feature != null) this.featureLayer.add(new esri.Graphic(feature, null, plot));
            var plotType = this._createPlotTypeSymbol(plot.plotType, (minX + maxX) / 2, (minY + maxY) / 2);
            if (plotType != null) this.plotTypeLayer.add(new esri.Graphic(plotType, null, plot));
            this.fogOfWarLayer.add(new esri.Graphic(poly, null, plot));
            var centerPoint = new esri.geometry.Point((minX + maxX) / 2, (minY + maxY) / 2, this.map.spatialReference);
            var upperLeftPoint = new esri.geometry.Point(minX + 0.35, maxY - 0.35, this.map.spatialReference);
            var bottomRightPoint = new esri.geometry.Point(maxX - 0.35, minY + 0.35, this.map.spatialReference);
            this.bonusLayer.add(new esri.Graphic(upperLeftPoint, null, plot));
            this.improvementLayer.add(new esri.Graphic(bottomRightPoint, null, plot));
            if (plot.routeType > -1) {
                var line = new esri.geometry.Polyline(this.map.spatialReference);
                var roadCount = 0;
                dojo.forEach(this.app.neighbourSteps, function (s) {
                    if (this.game.getPlotRouteType(plot.x + s[0], plot.y + s[1]) > -1) {
                        line.addPath([[(minX + maxX) / 2, (minY + maxY) / 2], [(minX + maxX + s[0]) / 2, (minY + maxY + s[1]) / 2]]);
                        roadCount++;
                    }
                }, this);
                if (roadCount == 0) {
                    // Draw small cross if no neighbouring roads
                    line.addPath([[(minX + maxX - 0.5) / 2, (minY + maxY) / 2], [(minX + maxX + 0.5) / 2, (minY + maxY) / 2]]);
                    line.addPath([[(minX + maxX) / 2, (minY + maxY - 0.5) / 2], [(minX + maxX) / 2, (minY + maxY + 0.5) / 2]]);
                }
                this.roadLayer.add(new esri.Graphic(line, null, plot));
            }
            if (plot.river.isNOfRiver) {
                var line = new esri.geometry.Polyline(this.map.spatialReference);
                line.addPath([[minX, minY], [maxX, minY]]);
                this.riverLayer.add(new esri.Graphic(line, null, plot));
            }
            if (plot.river.isWOfRiver) {
                var line = new esri.geometry.Polyline(this.map.spatialReference);
                line.addPath([[maxX, minY], [maxX, maxY]]);
                this.riverLayer.add(new esri.Graphic(line, null, plot));
            }
            if (!this.cityMode) {
                this.cultureLayer.add(new esri.Graphic(poly, null, plot));
                if (plot.units.length > 0) {
                    this.unitLayer.add(new esri.Graphic(centerPoint, null, plot));
                    this.unitOwnerLayer.add(new esri.Graphic(centerPoint, null, plot));
                }
            }
            else {
                var poly2 = this._createRectangle((minX + maxX) / 2, (minY + maxY) / 2, 0.8, 0.8, null);
                this.workedTileLayer.add(new esri.Graphic(poly2, null, plot));
            }
        }, this);
        if (!this.cityMode) {
            this.populateCityLayer();
        }
    },

    _createFeatureSymbol: function (feature, cx, cy) {
        if (feature.type == 0 || feature.type == 5) { // Ice or Fallout
            return this._createRectangle(cx, cy, 0.8, 0.8, null);
        }
        else if (feature.type == 2) // Oasis
        {
            return this._createSineCircle(cx, cy, 0.25, 0.35, null);
        }
        else if (feature.type == 3) // Flood plains
        {
            var wave = this._createSineWave(cx - 0.4, cx + 0.4, cy + 0.15, 0.10, null);
            wave = this._createSineWave(cx - 0.4, cx + 0.4, cy - 0.15, 0.10, wave);
            return wave;
        }
        else if (feature.type == 1 || feature.type == 4) { // Forest or jungle
            var tree = this._createTree(cx - 0.1, cy - 0.1, 0.5, null);
            return this._createTree(cx + 0.22, cy + 0.13, 0.3, tree);
        }
        else
            return null;
    },

    _createPlotTypeSymbol: function (plotType, cx, cy) {
        if (plotType == 0) { // Peak
            //return this._createRectangle(cx, cy, 0.8, 0.8, null);
            return this._createMountains(cx, cy, 0.9, 0.8, null, true);
        }
        else if (plotType == 1) { // Hill
            //return this._createSineCircle(cx, cy, 0.25, 0.35, null);
            return this._createMountains(cx + 0.03, cy + 0.1, 0.8, 0.6, null);
        }
        else
            return null;
    },

    _createRectangle: function (cx, cy, width, height, poly) {
        if (!poly) {
            poly = new esri.geometry.Polygon(this.map.spatialReference);
        }
        var minX2 = cx - width / 2;
        var minY2 = cy - height / 2;
        var maxX2 = cx + width / 2;
        var maxY2 = cy + height / 2;
        poly.addRing([[minX2, minY2], [minX2, maxY2], [maxX2, maxY2], [maxX2, minY2], [minX2, minY2]]);
        return poly;
    },

    _createMountain: function (cx, cy, width, height, polyline) {
        if (!polyline) {
            polyline = new esri.geometry.Polyline(this.map.spatialReference);
        }
        var x1 = cx - width / 2;
        var x2 = cx + width / 2;
        var y1 = cy - height / 2;
        var y2 = cy + height / 2;
        polyline.addPath([[x1, y1], [cx, y2], [x2, y1]]);
        return polyline;
    },

    _createMountains: function (cx, cy, width, height, geometry, makePolygon) {
        if (!geometry) {
            if (makePolygon)
                geometry = new esri.geometry.Polygon(this.map.spatialReference);
            else
                geometry = new esri.geometry.Polyline(this.map.spatialReference);
        }
        var x1 = cx - width / 2;
        var x2 = x1 + width / 3;
        var x3 = x2 + width / 3;
        var x23 = (x2 + x3) / 2;
        var x4 = x1 + width;
        var y1 = cy - height / 2;
        var y2 = y1 + height * 0.4;
        var y3 = y2 + height * 0.4;
        var y4 = y1 + height;
        var path1 = [[x1, y1], [x2, y3], [x3, y1]];
        var path2 = [[x23, (y1 + y3) / 2], [(x23 + x4) / 2, y4], [x4, y2]];
        if (makePolygon) {
            path1.push(path1[0]);
            path2.push(path2[0]);
            geometry.addRing(path1);
            geometry.addRing(path2);
        }
        else {
            geometry.addPath(path1);
            geometry.addPath(path2);
        }
        return geometry;
    },

    _createTree: function (cx, cy, height, poly) {
        if (!poly) {
            poly = new esri.geometry.Polygon(this.map.spatialReference);
        }
        var width = height * 0.8;
        var y1 = cy + height / 2;
        var y2 = y1 - height * 0.5;
        var y3 = y1 - height * 0.75;
        var y4 = y1 - height * 1.0;
        var sx = width * 0.05;
        var sy = height * 0.05;
        var x1 = cx - width / 2;
        var x2 = x1 + width * 0.3;
        var x3 = x1 + width * 0.7;
        var x4 = x1 + width * 1.0;
        poly.addRing([[cx, y4 + sy + sy], [x1, y4], [x2 + sx, y3 + sy], [x1 + sx, y3], [x2 + sx + sx, y2 + sy], [x1 + sx + sx, y2], [cx - sx - sx - sx, (y1 + y2) / 2], [cx, y1], [cx + sx + sx + sx, (y1 + y2) / 2], [x4 - sx - sx, y2], [x3 - sx - sx, y2 + sy], [x4 - sx, y3], [x3 - sx, y3 + sy], [x4, y4], [cx, y4 + sy + sy]]);
        return poly;
    },

    _createSineWave: function (x1, x2, y, amplitude, polyline) {
        var PI = 3.14159265359;
        if (!polyline) {
            polyline = new esri.geometry.Polyline(this.map.spatialReference);
        }
        var width = x2 - x1;
        var path = [];
        for (var a = 0; a < 13; a++) {
            var angle = 2 * PI * a / 12;
            var xx = x1 + a * width / 12;
            var yy = y + Math.sin(angle) * width * amplitude;
            path.push([xx, yy]);
        }
        polyline.addPath(path);
        return polyline;
    },

    _createSineCircle: function (cx, cy, radius, amplitude, poly) {
        var PI = 3.14159265359;
        if (!poly) {
            poly = new esri.geometry.Polygon(this.map.spatialReference);
        }
        var ring = [];
        for (var a = 24; a >= 0; a--) {
            var angle = 2 * PI * a / 24;
            var r = radius + Math.sin(angle * 3) * radius * amplitude;
            ring.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
        }
        poly.addRing(ring);
        return poly;
    },

    showCity: function (game, city) {
        this.game = game;
        if (this.map == null) {
            dojo.connect(this, "onMapLoaded", this, function () {
                this.showCity(city);
            });
            this.createMap();
        }
        this.addGrid(dojo.hitch(this, function (plot) {
            var xd = this.game.getXDist(plot.x, city.x);
            var yd = this.game.getYDist(plot.y, city.y);
            if (xd < 4 && yd < 4) {
                var p = {
                    t: plot.terrain,
                    b: plot.bonus,
                    o: plot.owner,
                    f: plot.feature.type,
                    p: plot.plotType,
                    i: plot.improvement,
                    r: plot.routeType,
                    u: plot.units.length > 0 ? plot.units[0].unitType : -1,
                    isVisible: city.ID == plot.wcid,
                    w: city.ID == plot.wcid && plot.worked
                };
                p = dojo.mixin({}, plot, p);
                // Move tiles across world wrap as needed:
                if (p.x - city.x < -3) p.x += this.game.map.width;
                if (p.x - city.x > 3) p.x -= this.game.map.width;
                if (p.y - city.y < -3) p.y += this.game.map.height;
                if (p.y - city.y > 3) p.y -= this.game.map.height;
                // reposition tiles
                p.x -= city.x - 3;
                p.y -= city.y - 3;
                return p;
            }
            else
                return null;
        }));
        this.refresh();
    },

    populateCityLayer: function () {
        this.cityLayer.clear();
        this._populateCityLayer(false);
        this._populateCityLayer(true);
    },

    _populateCityLayer: function(text) {
        dojo.forEach(this.game.players, function (player) {
            dojo.forEach(player.cities, function (city) {
                var x = this.app.xOrigin + city.x + 0.5;
                var y = this.app.yOrigin + city.y + 0.1;
                var visible = false;
                dojo.forEach(this.game.map.plots, function (plot) {
                    if (plot.x == city.x && plot.y == city.y)
                        visible = plot.isRevealed;
                }, this);
                if (visible) {
                    if (text) {
                        var textSymbol = new esri.symbol.TextSymbol("(" + city.size + ") " + city.name).
                            setColor(player.colors.text).
                            setDecoration(esri.symbol.TextSymbol.DECORATION_UNDERLINE).
                            setAlign(esri.symbol.TextSymbol.ALIGN_MIDDLE).
                            setAngle(0).
                            setFont(new esri.symbol.Font("12pt").setWeight(esri.symbol.Font.WEIGHT_BOLD));
                        this.cityLayer.add(new esri.Graphic(new esri.geometry.Point(x, y, this.map.spatialReference), textSymbol, city));
                    }
                    else
                        this.cityLayer.add(new esri.Graphic(new esri.geometry.Point(x, y + 0.4, this.map.spatialReference), this.citySymbol, city));
                }
            }, this);
        }, this);
    },

    _getPlotFromPoint: function (mapPoint) {
        if (this.game == null) return null;
        var x = Math.floor(mapPoint.x - this.app.xOrigin);
        var y = Math.floor(mapPoint.y - this.app.yOrigin);
        var p = null;
        dojo.forEach(this.game.map.plots, function (plot) {
            if (plot.x == x && plot.y == y)
                if (plot.isRevealed)
                    p = plot;
        }, this);
        return p;
    },

    onMapMouseMove: function (evt) {
        if (this.hoverFrozen) return;
        var p = this._getPlotFromPoint(evt.mapPoint);
        if (p == null) return;
        this.onTileHover(p);
    },

    onTileHover: function (plot) {
    },

    onCityDblClick: function (city) {
    },

    _updateHoverTip: function() {
        dojo.byId("hoverTip").innerHTML = this.hoverFrozen ? "Click the map to unfreeze the tile info." : "Click the map to freeze the tile info.";
    },

    freezeTile: function (x, y) {
        var p = null;
        dojo.forEach(this.game.map.plots, function (plot) {
            if (plot.x == x && plot.y == y)
                if (plot.isRevealed)
                    p = plot;
        }, this);
        if (p) {
            this.hoverFrozen = true;
            this.frozenPlot = p;
            this.onTileHover(p);
        }
        this._updateHoverTip();
    },

    unfreezeTile: function () {
        this.hoverFrozen = false;
        this.frozenPlot = null;
        this._updateHoverTip();
    },

    onMapClick: function (evt) {
        this.hoverFrozen = !this.hoverFrozen;
        this._updateHoverTip();
        var p = this._getPlotFromPoint(evt.mapPoint);
        if (this.hoverFrozen)
            this.frozenPlot = p;
        else
            this.frozenPlot = null;
        if (p) this.onTileHover(p);
        this.app.updateHash();
    },

    onMapDblClick: function (evt) {
        if (this.cityMode) return;
        var p = this._getPlotFromPoint(evt.mapPoint);
        if (p == null) return;
        var city = this.game.getCity(p.x, p.y);
        if (city != null)
            this.onCityDblClick(city);
        else {
            this.map.centerAndZoom(evt.mapPoint, 0.5);
        }
    }

});