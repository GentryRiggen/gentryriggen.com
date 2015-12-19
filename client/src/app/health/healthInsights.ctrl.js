(function () {
  'use strict';
  angular
    .module('gr')
    .controller('HealthInsightsCtrl', HealthInsightsController);

  HealthInsightsController.$inject = ['HealthService', 'ChartJsService'];
  function HealthInsightsController(HealthService, ChartJsService) {
    var HealthInsightsCtrl = this;

    function init() {
      HealthService.getInsights()
        .then(function (resp) {
          HealthInsightsCtrl.insights = resp.data;
          ChartJsService.updateChart(HealthInsightsCtrl.insights.affectsOfSleep, '#affectsOfSleep', 'Bar');
          ChartJsService.updateChart(HealthInsightsCtrl.insights.affectsOnSleep, '#affectsOnSleep', 'Bar');
          ChartJsService.updateChart(HealthInsightsCtrl.insights.activityLevelByMonth, '#activityLevelByMonth', 'Bar');
        });
    }

    init();
  }
})();
