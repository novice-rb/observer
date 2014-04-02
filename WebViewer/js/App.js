dojo.provide("observer.App");
dojo.require("esri.map");
dojo.require("observer.CivMap");
dojo.require("observer.Game");
dojo.require("dijit.layout.BorderContainer");
dojo.require("dijit.layout.ContentPane");
dojo.require("dijit.form.Select");
dojo.require("dijit.form.CheckBox");
dojo.require("dojox.widget.Standby");
dojo.require("dojox.grid.EnhancedGrid");
dojo.require("dojo.data.ItemFileWriteStore");

dojo.declare("observer.App", null, {
    yOrigin: 7000000,
    xOrigin: 0,
    app: null,
    map: null,
    game: null,
    cityMap: null,
    techGrid: null,
    games: {},
    currentGame: null,
    neighbourSteps: [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]],
    plotTypes: [{ "Type": "Peak", defenseBonus: 0 }, { "Type": "Hills", defenseBonus: 25 }, { "Type": "Flat", defenseBonus: 0 }, { "Type": "Water", defenseBonus: 0 }],
    workerActions: [
        { "name": "BUILD_ROAD" }, { "name": "BUILD_RAILROAD" }, { "name": "BUILD_FARM" }, { "name": "BUILD_FISHING_BOATS" }, { "name": "BUILD_WHALING_BOATS" }, { "name": "BUILD_MINE" }, { "name": "BUILD_WORKSHOP" }, { "name": "BUILD_LUMBERMILL" }, { "name": "BUILD_WINDMILL" }, { "name": "BUILD_WATERMILL" }, { "name": "BUILD_PLANTATION" }, { "name": "BUILD_QUARRY" }, { "name": "BUILD_PASTURE" }, { "name": "BUILD_CAMP" }, { "name": "BUILD_WELL" }, { "name": "BUILD_OFFSHORE_PLATFORM" }, { "name": "BUILD_WINERY" }, { "name": "BUILD_COTTAGE" }, { "name": "BUILD_FORT" }, { "name": "BUILD_REMOVE_JUNGLE" }, { "name": "BUILD_REMOVE_FOREST" }, { "name": "BUILD_SCRUB_FALLOUT" }, { "name": "BUILD_FOREST_PRESERVE" }
    ],
    _textsById: null,
    turnHandle: null,
    playerListHandle : null,
    ignoreTurnChange: false,
    hashChangeListener: null,
    isLoadingHash: false,
    currentCity: null,

    constructor: function (args) {
        dojo.safeMixin(this, args);
        this.app = this; // For convenience
        this.init();
        this.hashChangeListener = dojo.subscribe("/dojo/hashchange", this, this.hashChanged);
    },

    initGames: function (games) {
        this.games = games;
        dojo.connect(openGameDialog, "onShow", this, function () {
            if (dijit.byId("btnOpenGame").get("disabled")) {
                var s = dijit.byId("selectGame");
                s.removeOption(0);
                dojo.forEach(this.games.games, function (game, index) {
                    s.addOption({ "value": index, "label": game.name });
                }, this);
                dijit.byId("btnOpenGame").set("disabled", false);
            }
        });
        if (!this.loadInitialHash()) {
            openGameDialog.show();
        }
    },

    loadInitialHash: function () {
        var hash = dojo.hash();
        if (!hash || hash.length == 0) return false;
        var params = hash.split("/");
        if (params.length == 0) return false;
        var gameId = params[0];
        var foundGames = dojo.filter(this.games.games, function (g) { return g.id == gameId }, this);
        if (foundGames.length == 0) return false;
        this.currentGame = foundGames[0];
        var playerId = params.length > 1 ? params[1] : "x";
        var turn = params.length > 2 ? params[2] : "x";
        var turnPlayer = params.length > 3 ? params[3] : "x";
        var turnWithPlayer = turn + (turnPlayer == "x" ? "" : "p" + turnPlayer);
        var mapParams = params.length > 4 ? params.slice(4) : [];
        var turnToOpen = this.currentGame.turns[this.currentGame.turns.length - 1];
        var foundTurns = dojo.filter(this.currentGame.turns, function (t) {
            return t == turnWithPlayer;
        }, this);
        if (foundTurns.length == 0) foundTurns = dojo.filter(this.currentGame.turns, function (t) {
            return t == turn;
        }, this);
        if (foundTurns.length > 0) turnToOpen = foundTurns[0];
        this.openGameTurn(turnToOpen, true, dojo.hitch(this, function () {
            this.loadMapState(playerId, mapParams)
        }), null, mapParams.length > 0 && mapParams[0] != "x");
        return true;
    },

    hashChanged: function (hash) {
        console.log("Load: Hash changed to " + hash);
        this.isLoadingHash = true;
        var params = hash.split("/");
        if(params.length < 8) return;
        var gameId = params[0];
        var playerId = params[1];
        var turn = params[2];
        var turnPlayer = params[3];
        if(turnPlayer != "x") turn = turn + "p" + turnPlayer;
        var mapParams = params.slice(4);
        var currentTurn = dijit.byId("selectGameTurn").get("value").replace("t", "");
        if (!(this.currentGame) || this.currentGame.id != gameId) {
            var f = dojo.filter(this.games.games, function (g) { return "" + g.id == "" + gameId }, this);
            if (f.length > 0) {
                this.currentGame = f[0];
                this.openGameTurn(turn, true, dojo.hitch(this, function () {
                    this.loadMapState(playerId, mapParams)
                }));
            }
        }
        else if (currentTurn != turn) {
            this.openGameTurn(turn, false, dojo.hitch(this, function () { this.loadMapState(playerId, mapParams) }));
        }
        else
            this.loadMapState(playerId, mapParams);
    },

    loadMapState: function (playerId, mapParams) {
        var cp = this.getCurrentPlayerId();
        var updateMap = false;
        if (!(cp == -1 && playerId == "x" || cp == playerId)) {
            //dijit.byId("busyIndicator").show();
            this.setCurrentPlayer(playerId);
            this.updatePlayerInfo();
            updateMap = mapParams.length > 0 && mapParams[0] != "x";
            this.updateVisibility(!updateMap);
            //dijit.byId("busyIndicator").hide();
        }
        if (mapParams.length > 0 && mapParams[0] != "x" && mapParams[0] != this.map.getHashParams()[0]) updateMap = true;
        if (updateMap) {
            var coords = mapParams[0].split(":");
            this.map.setArea(coords[0] * 1, coords[1] * 1, coords[2] * 1, coords[3] * 1);
        }
        if(mapParams.length > 2 && mapParams[2] != "x") this.setMapOptions(this.getMapOptionsFromHash(mapParams[2]));
        if (mapParams.length < 2 || mapParams[1] == "x") {
            this.map.unfreezeTile();
        }
        else {
            this.map.freezeTile(mapParams[1].split(":")[0] * 1, mapParams[1].split(":")[1] * 1);
        }
        if (mapParams.length < 4 || mapParams[3] == "x") {
            cityScreen.onCancel();
        }
        else {
            var city = this.game.getCityAt(mapParams[3].split(":")[0] * 1, mapParams[3].split(":")[1] * 1);
            if(city) this.openCity(city);
        }
        this.isLoadingHash = false;
    },

    getMapOptionsFromHash: function(hashParam) {
        var mapOptions = hashParam * 1;
        var boolArray = [];
        var pow = 1024;
        while (pow >= 1) {
            if (mapOptions >= pow) {
                mapOptions -= pow;
                boolArray.push(true);
            }
            else
                boolArray.push(false);
            pow /= 2;
        }
        boolArray = boolArray.reverse();
        return {
            terrain: boolArray[0],
            plotTypes: boolArray[1],
            features: boolArray[2],
            units: boolArray[3],
            rivers: boolArray[4],
            cities: boolArray[5],
            resources: boolArray[6],
            improvements: boolArray[7],
            culture: boolArray[8],
            roads: boolArray[9],
            fogOfWar: boolArray[10]
        };
    },

    updateHash: function () {
        if (this.isLoadingHash) {
            console.log("Attempt to update hash while loading hash was ignored.");
            return;
        }
        var params = [];
        params.push(this.currentGame.id);
        var playerId = this.getCurrentPlayerId();
        params.push(playerId == -1 ? "x" : playerId);
        var turn = dijit.byId("selectGameTurn").get("value").replace("t", "");
        var turnParts = turn.split("p");
        params.push(turnParts[0]);
        params.push(turnParts.length > 1 ? turnParts[1] : "x");
        params = [].concat(params, this.map.getHashParams());
        params.push(this.getMapOptionsHash());
        params.push(this.currentCity ? this.currentCity.x + ":" + this.currentCity.y : "x");
        this.setHash(params.join("/"));
    },

    setHash: function (hash) {
        if (hash == dojo.hash()) return;
        if (this.hashChangeListener) dojo.unsubscribe(this.hashChangeListener);
        this.hashChangeListener = dojo.subscribe("/dojo/hashchange", this, function (hash) {
            dojo.unsubscribe(this.hashChangeListener);
            console.log("Hash updated to " + hash);
            this.hashChangeListener = dojo.subscribe("/dojo/hashchange", this, this.hashChanged);
        });
        dojo.hash(hash);
    },

    init: function () {
        this.cityMap = new observer.CivMap({ mapId: "cityMap", cityMode: true, app: this });
        this.map = new observer.CivMap({ mapId: "map", app: this });
        dojo.connect(this.map, "onTileHover", this, this.onTileHover);
        dojo.connect(this.map, "onCityDblClick", this, this.openCity);
        dojo.connect(dijit.byId("btnPrevTurn"), "onClick", this, this.btnPrevTurn_click);
        dojo.connect(dijit.byId("btnNextTurn"), "onClick", this, this.btnNextTurn_click);
        dojo.connect(cityScreen, "onCancel", this, function () { this.currentCity = null; this.updateHash(); });
        this.createUI();
        dojo.xhrGet({
            url: "webservices/GetGameData.ashx?op=getgames",
            handleAs: "json",
            load: dojo.hitch(this, this.initGames),
            error: function (err) {
                alert("Error downloading game list: " + err);
            }
        });
    },

    getText: function (key) {
        if (this._textsById == null) {
            this._textsById = {};
            dojo.forEach(texts.Civ4GameText.TEXT, function (txt) {
                this._textsById[txt.Tag] = txt.English;
            }, this);
        }
        if (this._textsById[key]) {
            return this._textsById[key];
        }
        return key.replace("TXT_KEY_", "").toLowerCase();
    },

    openSelectedGame: function () {
        var selectedGame = dijit.byId("selectGame").get("value");
        this.currentGame = this.games.games[selectedGame];
        openGameDialog.onCancel();
        this.openGameTurn(this.currentGame.turns[this.currentGame.turns.length - 1], true);
    },

    openGameTurn: function (turn, isNewGame, callback, errback, dontZoom) {
        dijit.byId("busyIndicator").show();
        //var turn = ('' + turn).replace('p', ' Player ');
        //var dataUrl = "data/" + encodeURIComponent(dojo.string.substitute(this.currentGame.filename, { "turn": turn }));
        if (turn * 1 == turn) {
            turn = "sot" + turn;
        }
        else {
            turn = ("eot" + turn).replace('p', '_player');
        }
        var dataUrl = "webservices/GetGameData.ashx?op=getturn&filename=" + dojo.string.substitute(this.currentGame.filename, { "turn": turn });
        //alert(dataUrl);
        dojo.xhrGet({
            url: dataUrl,
            handleAs: "json",
            load: dojo.hitch(this, function (obj) {
                this.game = new observer.Game(dojo.mixin(obj, { app: this }));
                this.updateUI(isNewGame);
                this.updateVisibility(!dontZoom);
                this.map.showGame(this.game);
                this.cityMap.showGame(this.game);
                dijit.byId("busyIndicator").hide();
                if(dojo.isFunction(callback)) callback(null);
            }),
            error: function (err) {
                alert("Error downloading game: " + err);
                if (dojo.isFunction(errback)) errback(err);
            }
        });
    },

    btnPrevTurn_click: function () {
        this.changeTurn(-1);
    },

    btnNextTurn_click: function () {
        this.changeTurn(1);
    },

    changeTurn: function (step) {
        if (this.game && this.currentGame) {
            var i = this.currentGame.turns.indexOf(this.game.game.turn + "p" + this.game.game.activePlayer);
            if (i == -1) i = this.currentGame.turns.indexOf(this.game.game.turn);
            if (i == -1) return;
            i = i + step;
            if (i >= 0 && i < this.currentGame.turns.length) {
                this.openGameTurn(this.currentGame.turns[i], false);
            }
        }
    },

    updatePlayerInfo: function () {
        var playerId = this.getCurrentPlayerId();
        if (playerId > -1) {
            var p = this.game.getPlayerById(playerId);
            dojo.byId("playerResearch").innerHTML = "Gold: " + p.gold + ", ";
            if (p.currentTech >= 0) {
                var tech = xml.Civ4TechInfos.TechInfos.TechInfo[p.currentTech];
                dojo.byId("playerResearch").innerHTML += dojo.string.substitute("<span title=\"Currently ${2}/${3}, gaining ${4} x ${5:ff} = ${6} beakers\">Research: ${0} (${1})</span>", [this.getText(tech.Description), p.currentTechTurnsLeft, p.techProgress[p.currentTech], this.game.getTechCost(p, p.currentTech), p.overflowResearch > 0 ? "( " + p.overflowResearch + " overflow + " + (p.researchCommerceRate + 1) + " bpt)" : "" + (p.researchCommerceRate + 1), this.game.getResearchModifier(p, p.currentTech), Math.floor(this.game.getResearchModifier(p, p.currentTech) * (p.researchCommerceRate + p.overflowResearch + 1))], null, { ff: function (val) { return Math.round(val * 1000) / 1000; } });
            }
            else {
                dojo.byId("playerResearch").innerHTML += "Research: None";
            }
            if (p.goldenAgeTurns > 0) {
                dojo.byId("playerResearch").innerHTML += "<br/>Golden age - " + p.goldenAgeTurns + " turns remaining.";
            }
            if (p.anarchyTurns > 0) {
                dojo.byId("playerResearch").innerHTML += "<br/>Anarchy - " + p.anarchyTurns + " turns remaining.";
            }
            dojo.byId("playerBeakers").innerHTML = dojo.string.substitute("Science: ${0}%: +${1} bpt", [p.sliders.research, p.researchCommerceRate]);
            dojo.byId("playerGold").innerHTML = dojo.string.substitute("Tax: ${0}%: ${1} gpt", [p.sliders.gold, p.netGoldCommerceRate >= 0 ? "+" + p.netGoldCommerceRate : "-" + (0-p.netGoldCommerceRate)]);
            dojo.byId("playerCultureSlider").innerHTML = dojo.string.substitute("Culture: ${0}%: +${1} cpt", [p.sliders.culture, p.cultureCommerceRate]);
            dojo.byId("playerEPs").innerHTML = dojo.string.substitute("Espionage: ${0}%: +${1} ept", [p.sliders.espionage, p.espionageCommerceRate]);
            dojo.style(dojo.byId("playerCommercePanel"), "display", "block");
            dojo.style(dojo.byId("playerResearch"), "display", "block");
        }
        else {
            dojo.style(dojo.byId("playerCommercePanel"), "display", "none");
            dojo.style(dojo.byId("playerResearch"), "display", "none");
        }
    },

    onMenuClick: function (id) {
        if (id == "menuOpenGame") {
            dijit.byId("btnCancelOpenGame").set("disabled", false);
            openGameDialog.show();
        }
        else if (id == "menuTechnologies") {
            techScreen.show();
            /*set up data store*/
            var data = {
                identifier: 'id',
                items: []
            };
            dojo.forEach(xml.Civ4TechInfos.TechInfos.TechInfo, function (tech, index) {
                var d = { id: (index + 1), techName: this.getText(tech.Description), cost: tech.iCost*1, adjustedCost: this.game.getTechCost(this.game.players[0], index) };
                dojo.forEach(this.game.players, function (player) {
                    var cost = this.game.getTechCost(player, index);
                    var techStatus = "Yes";
                    if (player.techs.indexOf(index) < 0) {
                        if (player.techLeft && player.techLeft[index] < cost)
                            techStatus = (cost - player.techLeft[index]) + "/" + cost;
                        else
                            techStatus = "No";
                    }
                    d["player" + player.ID] = techStatus;
                }, this);
                data.items.push(d);
            }, this);
            var store = new dojo.data.ItemFileWriteStore({ data: data });
            var layout = [[
              { 'name': 'ID', 'field': 'id' },
              { 'name': 'Technology', 'field': 'techName' },
              { 'name': 'Base cost', 'field': 'cost' },
              { 'name': 'Adjusted cost', 'field': 'adjustedCost' }
            ]];
            dojo.forEach(this.game.players, function (player) {
                layout[0].push({ 'name': player.name, 'field': "player" + player.ID });
            }, this);
            if (this.techGrid == null) {
                /*create a new grid:*/
                this.techGrid = new dojox.grid.EnhancedGrid({
                    id: 'techGrid',
                    store: store,
                    structure: layout,
                    rowSelector: '20px'
                }, document.createElement('div'));
                /*append the new grid to the div*/
                dojo.byId("techGridDiv").appendChild(this.techGrid.domNode);
                /*Call startup() to render the grid*/
                this.techGrid.startup();
            }
            else {
                this.techGrid.setStore(store);
                this.techGrid.setStructure(layout);
            }
        }
    },

    onTurnChange: function () {
        if (this.ignoreTurnChange) {
            this.ignoreTurnChange = false;
            return;
        }
        this.openGameTurn(dijit.byId("selectGameTurn").get("value").substring(1), false);
    },

    createUI: function () {
        var menuItems = dojo.query("#menuBar span");
        menuItems.addClass("menuLink");
        menuItems.on("mouseover", function (evt) {
            dojo.addClass(evt.target, "menuLinkHover");
        });
        menuItems.on("mouseout", function (evt) {
            dojo.removeClass(evt.target, "menuLinkHover");
        });
        menuItems.on("click", dojo.hitch(this, function (evt) {
            this.onMenuClick(evt.target.id);
        }));
        var playerList = dijit.byId("selectPerspective");
        this.playerListHandle = dojo.connect(playerList, "onChange", this, this.onPlayerListChange);
        this.turnHandle = dojo.connect(dijit.byId("selectGameTurn"), "onChange", this, this.onTurnChange);
        this.checkBoxes = [];
        this.checkBoxes.push({ checkbox: dijit.byId("chkTerrain")});
        this.checkBoxes.push({ checkbox: dijit.byId("chkPlotTypes")});
        this.checkBoxes.push({ checkbox: dijit.byId("chkFeatures")});
        this.checkBoxes.push({ checkbox: dijit.byId("chkUnits")});
        this.checkBoxes.push({ checkbox: dijit.byId("chkRivers")});
        this.checkBoxes.push({ checkbox: dijit.byId("chkCities")});
        this.checkBoxes.push({ checkbox: dijit.byId("chkResources")});
        this.checkBoxes.push({ checkbox: dijit.byId("chkImprovements")});
        this.checkBoxes.push({ checkbox: dijit.byId("chkCulture")});
        this.checkBoxes.push({ checkbox: dijit.byId("chkRoads")});
        this.checkBoxes.push({ checkbox: dijit.byId("chkFogOfWar")});
        dojo.forEach(this.checkBoxes, function (cb) {
            cb.handle = dojo.connect(cb.checkbox, "onChange", this, this.onMapOptionsChange);
        }, this);
    },

    setCurrentPlayer: function (playerId) {
        if (this.playerListHandle) dojo.disconnect(this.playerListHandle);
        var playerList = dijit.byId("selectPerspective");
        var p;
        if (playerId == "x" || playerId == "All" || playerId == -1)
            p = "All";
        else
            p = "p" + playerId;
        if (p != playerList.get("value")) {
            this.playerListHandle = dojo.connect(playerList, "onChange", this, function () {
                dojo.disconnect(this.playerListHandle);
                this.playerListHandle = dojo.connect(playerList, "onChange", this, this.onPlayerListChange);
            });
            playerList.set("value", p);
        }
    },

    onPlayerListChange: function() {
        dijit.byId("busyIndicator").show();
        this.updatePlayerInfo();
        this.updateVisibility(true);
        this.map.refresh();
        dijit.byId("busyIndicator").hide();
    },

    updateUI: function (isNewGame) {
        dojo.byId("currentGame").innerHTML = this.game.game.name;
        var turnSelect = dijit.byId("selectGameTurn");
        turnSelect.removeOption(turnSelect.getOptions());
        this.ignoreTurnChange = true;
        if (this.turnHandle) this.turnHandle.remove();
        var selectedValue = null;
        dojo.forEach(this.currentGame.turns, function (tt) {
            var t = "" + tt;
            turnSelect.addOption({ value: "t" + t, label: "Turn: " + t.replace('p', ' Player ') });
            if (t == this.game.game.turn + "p" + this.game.game.activePlayer)
                selectedValue = "t" + t;
            if (selectedValue == null && t == "" + this.game.game.turn)
                selectedValue = "t" + t;
        }, this);
        if (selectedValue) turnSelect.set("value", selectedValue);
        this.turnHandle = dojo.connect(dijit.byId("selectGameTurn"), "onChange", this, this.onTurnChange);
        dojo.byId("gameYear").innerHTML = dojo.string.substitute("${0} ${1}", [Math.abs(this.game.game.year), this.game.game.year < 0 ? "BC" : "AD"]);
        if (isNewGame) {
            var playerList = dijit.byId("selectPerspective");
            playerList.removeOption(playerList.getOptions());
            playerList.addOption({ value: "All", label: "Omniscient", selected: true });
            dojo.forEach(this.game.players, function (p) {
                playerList.addOption({ value: "p" + p.ID, label: p.name });
            }, this);
        }
        this.updatePlayerInfo();
    },

    checkBoxes: [],

    setMapOptions: function (options) {
        dojo.forEach(this.checkBoxes, function (cb) {
            dojo.disconnect(cb.handle);
        }, this);
        dijit.byId("chkTerrain").set("checked", options.terrain);
        dijit.byId("chkPlotTypes").set("checked", options.plotTypes);
        dijit.byId("chkFeatures").set("checked", options.features);
        dijit.byId("chkUnits").set("checked", options.units);
        dijit.byId("chkRivers").set("checked", options.rivers);
        dijit.byId("chkCities").set("checked", options.cities);
        dijit.byId("chkResources").set("checked", options.resources);
        dijit.byId("chkImprovements").set("checked", options.improvements);
        dijit.byId("chkCulture").set("checked", options.culture);
        dijit.byId("chkRoads").set("checked", options.roads);
        dijit.byId("chkFogOfWar").set("checked", options.fogOfWar);
        this.map.setVisibleLayers(this.getMapOptions());
        dojo.forEach(this.checkBoxes, function (cb) {
            cb.handle = dojo.connect(cb.checkbox, "onChange", this, this.onMapOptionsChange);
        }, this);
    },

    getMapOptions: function () {
        return {
            terrain: dijit.byId("chkTerrain").get("value") == "visible",
            plotTypes: dijit.byId("chkPlotTypes").get("value") == "visible",
            features: dijit.byId("chkFeatures").get("value") == "visible",
            units: dijit.byId("chkUnits").get("value") == "visible",
            rivers: dijit.byId("chkRivers").get("value") == "visible",
            cities: dijit.byId("chkCities").get("value") == "visible",
            resources: dijit.byId("chkResources").get("value") == "visible",
            improvements: dijit.byId("chkImprovements").get("value") == "visible",
            culture: dijit.byId("chkCulture").get("value") == "visible",
            roads: dijit.byId("chkRoads").get("value") == "visible",
            fogOfWar: dijit.byId("chkFogOfWar").get("value") == "visible"
        };
    },

    getMapOptionsHash: function () {
        var opt = this.getMapOptions();
        var boolArray = [
            opt.terrain,
            opt.plotTypes,
            opt.features,
            opt.units,
            opt.rivers,
            opt.cities,
            opt.resources,
            opt.improvements,
            opt.culture,
            opt.roads,
            opt.fogOfWar
        ];
        var hash = 0;
        var pow = 1;
        dojo.forEach(boolArray, function (b) {
            if (b) hash += pow;
            pow *= 2;
        }, this);
        return hash;
    },

    onMapOptionsChange: function () {
        this.map.setVisibleLayers(this.getMapOptions());
        this.updateHash();
    },

    getCurrentPlayerId: function () {
        var playerList = dijit.byId("selectPerspective");
        var pp = playerList.get("value");
        var playerId = -1;
        if (pp != "All") playerId = pp.substring(1) * 1;
        return playerId;
    },

    updateVisibility: function (zoom) {
        var playerId = this.getCurrentPlayerId();
        var minX = 99999999;
        var maxX = 0;
        var minY = 99999999;
        var maxY = 0;
        dojo.forEach(this.game.map.plots, function (p) {
            if (playerId == -1 || p.revealed[playerId]) {
                p.t = p.terrain;
                p.b = p.bonus;
                p.o = p.owner;
                p.f = p.feature.type;
                p.p = p.plotType;
                p.i = p.improvement;
                p.r = p.routeType;
                if (p.units.length > 0) {
                    p.u = p.units[0].unitType;
                    p.uo = p.units[0].owner;
                }
                else {
                    p.u = -1;
                    p.uo = -1;
                }
                p.isRevealed = true;
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }
            else {
                p.t = -1;
                p.b = -1;
                p.o = -1;
                p.f = -1;
                p.p = -1;
                p.i = -1;
                p.u = -1;
                p.uo = -1;
                p.r = -1;
                p.isRevealed = false;
            }
            if (playerId == -1 || p.visible[playerId]) {
                if (p.units.length > 0) {
                    p.u = p.units[0].unitType;
                    p.uo = p.units[0].owner;
                }
                else {
                    p.u = -1;
                    p.uo = -1;
                }
                p.isVisible = true;
            }
            else {
                p.u = -1;
                p.uo = -1;
                p.isVisible = false;
            }
        }, this);
        if (zoom)
            this.map.zoomToArea(minX, minY, maxX, maxY);
    },

    calculateXPRequiredForLevel: function (level, owner) {
        var xp = 2;
        var lvl = level - 1;
        var step = 3;
        while (lvl > 0) {
            xp += step;
            lvl--;
            step += 2;
        }
        var leader = xml.Civ4LeaderHeadInfos.LeaderHeadInfos.LeaderHeadInfo[this.game.getPlayerById(owner).leaderType];
        if (leader.Traits && leader.Traits.Trait && dojo.filter(leader.Traits.Trait, function (Trait) { return Trait.TraitType == "TRAIT_CHARISMATIC"; }).length > 0) {
            // Charismatic leader
            xp = Math.ceil(xp * 0.75);
        }
        return xp;
    },

    calculatePlotDefenseBonus: function (plot) {
        var d = 1 * this.lookup(plot.terrain, xml.Civ4TerrainInfos.TerrainInfos.TerrainInfo, "iDefense");
        if (plot.feature.type >= 0) d += 1 * this.lookup(plot.feature.type, xml.Civ4FeatureInfos.FeatureInfos.FeatureInfo, "iDefense");
        if (plot.plotType >= 0) d += this.lookup(plot.plotType, this.plotTypes, "defenseBonus");
        if (plot.improvement >= 0) d += 1 * this.lookup(plot.improvement, xml.Civ4ImprovementInfos.ImprovementInfos.ImprovementInfo, "iDefenseModifier");
        return d;
    },

    calculatePlotCulturePercentages: function (plot) {
        var percentages = [];
        var totalCulture = 0;
        // Plot's culture array contains culture values for live players plus the barbarians
        dojo.forEach([].concat(this.game.players, [this.game.barbarians]), function (player, index) {
            var c = plot.culture[index];
            totalCulture += c;
            if (c > 0)
                percentages.push({ playerID: player.ID, culture: c, percentage: 0 });
        }, this);
        if (totalCulture > 0) {
            dojo.forEach(percentages, function (p) { p.percentage = p.culture * 100.0 / totalCulture; }, this);
        }
        // Sort by culture but keep tile owner first
        percentages.sort(function (a, b) { if (a.playerID == plot.owner) return -1; if (b.playerID == plot.owner) return 1; return b.culture - a.culture; });
        return percentages;
    },

    onTileHover: function (p) {
        var city = this.game.getCity(p.x, p.y);
        var info = dojo.mixin({}, p);
        info = dojo.mixin(info, {
            "terrainType": this.lookup(p.terrain, xml.Civ4TerrainInfos.TerrainInfos.TerrainInfo, "Description", true),
            "bonusType": this.lookup(p.bonus, xml.Civ4BonusInfos.BonusInfos.BonusInfo, "Description", true),
            "improvementType": this.lookup(p.improvement, xml.Civ4ImprovementInfos.ImprovementInfos.ImprovementInfo, "Description", true),
            "featureType": this.lookup(p.feature.type, xml.Civ4FeatureInfos.FeatureInfos.FeatureInfo, "Description", true),
            "routeTypeName": this.lookup(p.routeType, xml.Civ4RouteInfos.RouteInfos.RouteInfo, "Description", true),
            "plotTypeName": this.lookup(p.plotType, this.plotTypes, "Type"),
            "ownerName": p.owner >= 0 ? this.game.getPlayerById(p.owner).civShortDescription : "Neutral",
        });
        //html = dojo.string.substitute(
        //    "X, Y: ${x}, ${y}<br/>" +
        //    "Terrain: ${terrainType}<br/>" +
        //    "Feature: ${featureType}<br/>" +
        //    "Plot type: ${plotTypeName}<br/>" +
        //    "Bonus: ${bonusType}<br/>" +
        //    "Improvement: ${improvementType}<br/>" +
        //    "Route type: ${routeTypeName}<br/>" +
        //    "Riverside: ${river.isRiverSide}<br/>" +
        //    "Irrigated: ${isIrrigated}<br/>" +
        //    "Impassable: ${isImpassable}<br/>" +
        //    "Freshwater: ${isFreshWater}<br/>" +
        //    "Goody hut: ${isGoody}<br/>" +
        //    "Tile owner: ${ownerName}",
        //    info);
        var html = "";
        html += dojo.string.substitute("<br/>X, Y: ${x}, ${y}<br/>", p);
        if (p.owner >= 0) {
            if (!p.isVisible)
                html += this.game.getPlayerById(p.owner).civDescription + "<br/>";
            else {
                dojo.forEach(this.calculatePlotCulturePercentages(p), function (p) {
                    html += Math.floor(p.percentage) + "% " + this.game.getPlayerById(p.playerID).civAdjective + "<br/>";
                }, this);
            }
        }
        var defenseBonus = this.calculatePlotDefenseBonus(p);
        if (defenseBonus > 0) html += "Defense Bonus: +" + defenseBonus + "%<br/>";
        if (info.plotType == 0 /* Peak */) {
            html += info.plotTypeName;
        }
        else {
            if (info.plotType == 1 /* "Hills" */) html += info.plotTypeName + "/";
            if (info.feature.type >= 0) html += info.featureType + "/";
            html += info.terrainType;
        }
        if (p.isFreshWater) html += "<br/>Fresh Water";
        // TODO: Add tile yield info after terrain description, e.g. Hills/Forest/Plains, 3h
        if (p.bonus >= 0) html += "<br/>" + info.bonusType;
        if (p.improvement >= 0) {
            html += "<br/>" + info.improvementType;
            if (p.isIrrigated) html += " (Irrigated)";
        }
        if (p.routeType >= 0) html += "<br/>" + info.routeTypeName;
        if (p.isImpassable) html += "<br/>IMPASSABLE";
        if (city != null) html += "<br/>City: " + city.name;
        dojo.byId('tileInfo').innerHTML = html;
        var unitHtml = "Tile is fogged.";
        if (p.isVisible) {
            unitHtml = "No units.";
            if (p.units.length > 0) {
                unitHtml = "Units:<br/>";
                dojo.forEach(p.units, function (unit) {
                    var u = dojo.mixin({}, unit);
                    u = dojo.mixin(u, {
                        "ownerName": this.game.getPlayerById(unit.owner).name,
                        "totalMoves": this.lookup(unit.unitType, xml.Civ4UnitInfos.UnitInfos.UnitInfo, "iMoves"),
                        "strength": 1 * this.lookup(unit.unitType, xml.Civ4UnitInfos.UnitInfos.UnitInfo, "iCombat"),
                        "workerAction": "",
                        "nextXP": this.calculateXPRequiredForLevel(u.level, u.owner),
                        "health": 100 - u.damage,
                        "fMoves": u.moves / 60,
                        "fortificationBonus": u.fortifyTurns * 5,
                        "xpValueAttack": 1 * this.lookup(unit.unitType, xml.Civ4UnitInfos.UnitInfos.UnitInfo, "iXPValueAttack"),
                        "xpValueDefense": 1 * this.lookup(unit.unitType, xml.Civ4UnitInfos.UnitInfos.UnitInfo, "iXPValueDefense")
                    });
                    u.fMoves = u.totalMoves - u.fMoves;
                    if (u.fMoves < 0) u.fMoves = 0;
                    u.fMoves = Math.round(100 * u.fMoves) / 100;
                    unitHtml += dojo.string.substitute("${name}", u);
                    if (u.strength > 0 || u.damage > 0) {
                        unitHtml += ", ";
                        if (u.damage > 0) unitHtml += dojo.string.substitute("${0}/", [Math.round(u.strength * u.health / 10) / 10]);
                        unitHtml += dojo.string.substitute("${strength} str", u);
                    }
                    unitHtml += dojo.string.substitute(", ${fMoves}/${totalMoves} moves", u);
                    unitHtml += dojo.string.substitute(", ${ownerName}", u);
                    if (unit.buildType > -1) unitHtml += ", " + this.lookup(unit.buildType, this.workerActions, "name");
                    if (u.xpValueAttack > 0 || u.xpValueDefense > 0) unitHtml += dojo.string.substitute(", XP: (${xp}/${nextXP})", u);
                    dojo.forEach(u.promotions, function (promo) {
                        unitHtml += dojo.string.substitute('<img class="promotionIcon" src="symbols/promotions/Promotion_${0}.png"></img>', [promo + 1]);
                    }, this);
                    if (u.fortifyTurns > 0) unitHtml += dojo.string.substitute("<br/>Fortify Bonus: ${fortificationBonus}%", u);
                    unitHtml += "<br/>";
                }, this);
            }
        }
        dojo.byId('unitList').innerHTML = unitHtml;
        //"culture": [0, 0, 0, 0, 0, 0, 0, 0, 0]
    },

    lookup: function (value, infos, attrName, text) {
        if (value >= 0 && value < infos.length) {
            if (text)
                return this.getText(infos[value][attrName]);
            else
                return infos[value][attrName];
        }
        else
            return "None";
    },

    openCity: function (city) {
        this.currentCity = city;
        this.updateHash();
        cityScreen.set("title", city.name + ": " + city.size);
        var cityOwner = this.game.getPlayerById(city.owner);
        dojo.byId("cityFood").innerHTML = "Food: " + city.food.food + "/" + this.game.getFoodBoxSize(city.size) + ", +" + city.food.difference + "fpt, growth in " + city.food.foodTurnsLeft + " turns." + (city.food.foodKept > 0 ? " " + city.food.foodKept + " food in granary." : "");
        dojo.byId("cityHammers").innerHTML = "Build: " + city.production.name + " - " + city.production.hammersInBox + "/" + (city.production.hammersNeeded) + " hammers, " + (city.production.overflow > 0 ? city.production.overflow + " overflow " : "") + "+" + city.production.hpt + "hpt, " + city.production.turnsLeft + " turns left.";
        dojo.byId("cityBeakers").innerHTML = dojo.string.substitute("Science: ${0}%: +${1} bpt", [cityOwner.sliders ? cityOwner.sliders.research : 0, "?"]);
        dojo.byId("cityGold").innerHTML = dojo.string.substitute("Tax: ${0}%: +${1} gpt", [cityOwner.sliders ? cityOwner.sliders.gold : 0, "?"]);
        dojo.byId("cityCultureSlider").innerHTML = dojo.string.substitute("Culture: ${0}%: +${1} cpt", [cityOwner.sliders ? cityOwner.sliders.culture : 0, "?"]);
        dojo.byId("cityEPs").innerHTML = dojo.string.substitute("Espionage: ${0}%: +${1} ept", [cityOwner.sliders ? cityOwner.sliders.espionage : 0, "?"]);
        dojo.byId("cityMaintenance").innerHTML = dojo.string.substitute("<span title=\"Distance: ${1}, #of cities: ${2}, colony: ${3}, corporations: ${4}\">Maintenance: -${0} gpt</span>", [(city.maintenance.distance + city.maintenance.colony + city.maintenance.corps + city.maintenance.numCities) / 100, city.maintenance.distance / 100, city.maintenance.numCities / 100, city.maintenance.colony / 100, city.maintenance.corps / 100]);
        if (city.buildings.length > 0) {
            var buildings = "";
            dojo.forEach(city.buildings, function (b) {
                buildings += '<img class="buildingIcon" src="symbols/buildings/Building_' + (b + 2) + '.png"></img><span>' + this.getText(xml.Civ4BuildingInfos.BuildingInfos.BuildingInfo[b].Description) + "</span><br/>";
            }, this);
            dojo.byId("cityBuildingList").innerHTML = buildings;
        }
        var handle = dojo.connect(cityScreen, "onShow", this, function () {
            dojo.disconnect(handle);
            this.cityMap.showCity(this.game, city);
        });
        cityScreen.show();
    }

});
