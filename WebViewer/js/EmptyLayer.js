dojo.provide("observer.EmptyLayer");
dojo.require("esri.map");

dojo.ready(function () {
    dojo.declare("observer.EmptyLayer", esri.layers.DynamicMapServiceLayer, {
        app: null,

        constructor: function (initExtent, app) {
            this.app = app;
            var i = initExtent || { xmin: -2, xmax: 27, ymin: -2, ymax: 27 };
            this.initialExtent = this.fullExtent = new esri.geometry.Extent({ "xmin": this.app.xOrigin + i.xmin, "ymin": this.app.yOrigin + i.ymin, "xmax": this.app.xOrigin + i.xmax, "ymax": this.app.yOrigin + i.ymax, "spatialReference": { "wkid": 25833 } });
            this.spatialReference = new esri.SpatialReference({ wkid: 25833 });
            this.loaded = true;
            this.onLoad(this);
        },

        getImageUrl: function (extent, width, height, callback) {
            callback("http://localhost:62237/WebViewer/symbols/blank.png");
        }
    });
});
