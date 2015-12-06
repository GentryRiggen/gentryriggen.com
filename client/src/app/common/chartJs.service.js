(function () {
  'use strict';
  angular.module('gr').service('ChartJsService', ChartJsService);

  ChartJsService.$inject = ['ChartJs'];
  function ChartJsService(ChartJs) {
    var chartJsService = {};

    chartJsService.updateChart = function (data, tag, type) {
      var canvas = $(tag), ctx;
      if (data) {
        canvas.parent().fadeIn(function () {
          $(tag).replaceWith('<canvas id="' + tag.substr(1) + '"></canvas>');
          canvas = $(tag);
          ctx = canvas.get(0).getContext("2d");
          new ChartJs(ctx)[type](data);
        });
      } else {
        canvas.parent().fadeOut();
      }
    };

    return chartJsService;
  }
})();
