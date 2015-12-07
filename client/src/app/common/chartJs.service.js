(function () {
  'use strict';
  angular.module('gr').service('ChartJsService', ChartJsService);

  ChartJsService.$inject = ['ChartJs'];
  function ChartJsService(ChartJs) {
    var chartJsService = {};

    function replaceAndUpdate(data, tag, type) {
      var canvas = angular.element(tag)[0];
      console.log(tag, canvas);
      var ctx = canvas.getContext("2d");
      new ChartJs(ctx)[type](data);
    }

    chartJsService.updateChart = function (data, tag, type) {
      var canvas = $(tag), ctx;
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

    return chartJsService;
  }
})();
