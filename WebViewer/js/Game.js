dojo.provide("observer.Game");

dojo.declare("observer.Game", null, {
    app: null,

    constructor: function (args) {
        dojo.safeMixin(this, args);
        this.barbarians = { "leaderName": "Barbarian", "color": 0, "ID": 18, "civDescription": "Barbarians", "leaderType": 0, "civType": 35, "isAlive": true, "civShortDescription": "Barbarians", "civName": "Barbarians", "name": "Barbarians", "civAdjective": "Barbarian", "team": 18 };
        this._getPlayerColors();
    },

    _getPlayerColors: function() {
        dojo.forEach(this.players, function (player) {
            player.colors = this._getPlayerColor(player.color);
        }, this);
        this.barbarians.colors = this._getPlayerColor(this.barbarians.color);
    },

    _getPlayerColor: function(color) {
        if (color < 0 || color >= xml.Civ4PlayerColorInfos.PlayerColorInfos.PlayerColorInfo.length) return null;
        var colorInfo = xml.Civ4PlayerColorInfos.PlayerColorInfos.PlayerColorInfo[color];
        var color = { primary: null, secondary: null, text: null };
        dojo.forEach(xml.Civ4ColorVals.ColorVals.ColorVal, function (v) {
            if (v.Type == colorInfo.ColorTypePrimary)
                color.primary = this._getColor(v);
            else if (v.Type == colorInfo.ColorTypeSecondary)
                color.secondary = this._getColor(v);
            else if (v.Type == colorInfo.TextColorType)
                color.text = this._getColor(v);
        }, this);
        return color;
    },

    _getColor : function(colorValue) {
        return new dojo.Color([Math.round(colorValue.fRed * 255), Math.round(colorValue.fGreen * 255), Math.round(colorValue.fBlue * 255), Math.round(colorValue.fAlpha * 255)]);
    },

    getDefineIntValue: function (defineName) {
        var d = dojo.filter(xml.Civ4Defines.Define, function (d) { return d.DefineName == defineName; });
        if (d.length > 0) return 1 * d[0].iDefineIntVal;
        return 0;
    },

    getFoodBoxSize: function (citySize) {
        var f = 20 + citySize * 2;
        var p = xml.Civ4GameSpeedInfo.GameSpeedInfos.GameSpeedInfo[this.game.speed].iGrowthPercent / 100;
        return Math.floor(f * p);
    },

    getCity: function (x, y) {
        var result = null;
        dojo.forEach(this.players, function (player) {
            dojo.forEach(player.cities, function (city) {
                if (city.x == x && city.y == y)
                    result = city;
            }, this);
        }, this);
        return result;
    },

    isPlayerHasTech: function (player, tech) {
        for (var i = 0; i < player.techs.length; i++)
            if (player.techs[i] == tech)
                return true;
        return false;
    },

    getTechIdFromType: function (techType) {
        var techId = -1;
        dojo.forEach(xml.Civ4TechInfos.TechInfos.TechInfo, function (techInfo, index) {
            if (techInfo.Type == techType) techId = index;
        }, this);
        return techId;
    },

    getResearchModifier: function (player, tech) {
        if (tech >= 0 && tech < xml.Civ4TechInfos.TechInfos.TechInfo.length) {
            var techInfo = xml.Civ4TechInfos.TechInfos.TechInfo[tech];
            var prereqModifier = 1.0;
            var prereqs = [];
            if (techInfo.OrPreReqs) {
                if (dojo.isArray(techInfo.OrPreReqs.PrereqTech))
                    prereqs = techInfo.OrPreReqs.PrereqTech;
                else if (techInfo.OrPreReqs.PrereqTech)
                    prereqs.push(techInfo.OrPreReqs.PrereqTech);
            }
            dojo.forEach(prereqs, function (pr) {
                var techId = this.getTechIdFromType(pr);
                if (techId > -1 && this.isPlayerHasTech(player, techId))
                    prereqModifier += (this.getDefineIntValue("TECH_COST_KNOWN_PREREQ_MODIFIER") / 100);
            }, this);
            // TODO: Should known tech bonus be calculated based on teams or players?
            var knownTechPlayers = 0;
            dojo.forEach(player.contacts, function (contactPlayerId) {
                if (this.isPlayerHasTech(this.getPlayerById(contactPlayerId), tech))
                    knownTechPlayers++;
            }, this);
            prereqModifier += knownTechPlayers * 0.01 * this.getDefineIntValue("TECH_COST_TOTAL_KNOWN_TEAM_MODIFIER") / this.game.playerCount;
            return prereqModifier;
        }
        else
            return 1;
    },

    getPlayerById: function (playerId) {
        var player = null;
        if (playerId == this.barbarians.ID) return this.barbarians;
        dojo.forEach(this.players, function (p) {
            if (p.ID == playerId) player = p;
        }, this);
        return player;
    },

    getTeamPlayers: function(team) {
        return dojo.filter(this.players, function(p) { return p.team == team; });
    },

    getTechCost: function (player, tech) {
        if (tech >= 0 && tech < xml.Civ4TechInfos.TechInfos.TechInfo.length) {
            var techInfo = xml.Civ4TechInfos.TechInfos.TechInfo[tech];
            var cost = techInfo.iCost * 1;
            cost = Math.floor(cost * xml.Civ4HandicapInfo.HandicapInfos.HandicapInfo[player.handicap].iResearchPercent * 0.01);
            cost = Math.floor(cost * xml.Civ4WorldInfo.WorldInfos.WorldInfo[this.map.worldSize].iResearchPercent * 0.01);
            cost = Math.floor(cost * xml.Civ4GameSpeedInfo.GameSpeedInfos.GameSpeedInfo[this.game.speed].iResearchPercent * 0.01);
            cost = Math.floor(cost * xml.Civ4EraInfos.EraInfos.EraInfo[this.game.startEra].iResearchPercent * 0.01);
            cost = Math.floor(cost * (100 + this.getDefineIntValue("TECH_COST_EXTRA_TEAM_MEMBER_MODIFIER") * (this.getTeamPlayers(player.team).length - 1)) / 100);
            return cost;
        }
        else
            return 0;
    },

    getCityAt: function (x, y) {
        var c = null;
        dojo.forEach(this.players, function (player) {
            dojo.forEach(player.cities, function (city) {
                if (city.x == x && city.y == y) c = city;
            }, this);
        }, this);
        return c;
    },

    getVirtualPlot: function (x, y) {
        var dummyPlot = { routeType: -1 };
        if (x < 0 && !this.map.isWrapX) return dummyPlot;
        if (x >= this.map.width && !this.map.isWrapX) return dummyPlot;
        if (y < 0 && !this.map.isWrapY) return dummyPlot;
        if (y >= this.map.height && !this.map.isWrapY) return dummyPlot;
        while (x < 0) x += this.map.width;
        while (x >= this.map.width) x -= this.map.width;
        while (y < 0) y += this.map.height;
        while (y >= this.map.height) y -= this.map.height;
        var plots = dojo.filter(this.map.plots, function (p) { return p.x == x && p.y == y; });
        if (plots && plots.length > 0) return plots[0];
        return dummyPlot;
    },

    getPlotRouteType: function (x, y) {
        return this.getVirtualPlot(x, y).routeType;
    },

    getXDist: function (x1, x2) {
        return this._getDist(x1, x2, this.map.isWrapX, this.map.width);
    },

    getYDist: function (y1, y2) {
        return this._getDist(y1, y2, this.map.isWrapY, this.map.height);
    },

    _getDist: function (c1, c2, wrap, size) {
        if (!wrap)
            return Math.abs(c2 - c1);
        else
            return Math.min(Math.abs(c2 - c1), size - Math.abs(c1 - c2));
    }

});