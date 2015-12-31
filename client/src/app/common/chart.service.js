(function () {
  'use strict';
  angular.module('gr').service('ChartService', ChartService);

  ChartService.$inject = [];
  function ChartService() {
    var chartService = {};

    function replaceAndUpdate(data, tag, type) {
      var canvas = angular.element(tag)[0];
      var ctx = canvas.getContext("2d");
      new ChartJs(ctx)[type](data);
    }

    chartService.updateHighChart = function (data, tag) {
      $(tag).highcharts(data);
    };

    chartService.updateChart = function (data, tag, type) {
      var canvas = $(tag);
      if (data) {
        if (canvas.parent().length) {
          canvas.parent().fadeIn(function () {
            replaceAndUpdate(data, tag, type);
          });
        } else {
          replaceAndUpdate(data, tag, type);
        }
      } else {
        canvas.parent().fadeOut();
      }
    };

    return chartService;
  }
})();
