'use strict';
const Helper = require('node_helper');
const Log = require('logger');

function deUmlaut(value){
    value = value.toLowerCase();
    value = value.replace(/ä/g, 'ae');
    value = value.replace(/ö/g, 'oe');
    value = value.replace(/ü/g, 'ue');
    value = value.replace(/ß/g, 'ss');
    value = value.replace(/ /g, '-');
    value = value.replace(/\./g, '');
    value = value.replace(/,/g, '');
    value = value.replace(/\(/g, '');
    value = value.replace(/\)/g, '');
    return value;
  }

module.exports = Helper.create({
    config: {
        sourceUrl: 'https://opendata.wuerzburg.de/api/explore/',
        apiVersion: 'v2.1',
        limit: 50,
        orderBy: 'start ASC',
        fields: ['kategorie', 'start', 'bild', 'stadtteil_name']
    },
    getData: async function(data) {
        var _this = this;

        const currentDate = new Date();

        var where = 'start >= \'' + currentDate.toISOString().split('T')[0] + '\'';

        var districts = data.districts || [];
        if (districts.length > 0) {
            where += 'AND stadtteil_name IN (' + districts.map(a => `'${a}'`).join() + ')';
        }

        var urlSearchParams = new URLSearchParams({
            limit: this.config.limit,
            order_by: this.config.orderBy,
            select: this.config.fields.join(),
            where: where
        });

        var url = this.config.sourceUrl + this.config.apiVersion + '/catalog/datasets/abfallkalender-wuerzburg/records?' + urlSearchParams.toString();

        Log.log(`[${this.name}] Fetching opendata.wuerzburg.de data via ${url} ...`);

        try {
            const response = await fetch(url, { method: 'GET' });
            if (!response.ok) {
            throw new Error('Invalid API request');
            }

            const res = await response.json();

            if (!res || !res.results || res.results.length === 0) return;

            _this.sendSocketNotification('API_DATA_RECEIVED', {
            rows: _this.processData(res.results)
            });
        } catch (error) {
            Log.error(`[${this.name}] ${error}`);
        }
    },
    processData: function(data) {
        var byDate = {};

        for (var i = 0; i < data.length; i++) {
            data[i].cat = deUmlaut(data[i].kategorie);
            data[i].district = deUmlaut(data[i].stadtteil_name);

            if (typeof byDate[data[i].start]  !== 'object') {
                byDate[data[i].start] = {};
            }

            if (typeof byDate[data[i].start][data[i].district] !== 'object') {
                byDate[data[i].start][data[i].district] = {};
            }

            byDate[data[i].start][data[i].district][data[i].cat] = data[i];
        }

        return byDate;
    },
    socketNotificationReceived: function(name, payload) {
        if (name === 'GET_DATA') {
            this.getData(payload);
        }
    }
});
