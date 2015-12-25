(function () {
  'use strict';
  angular
    .module('gr')
    .controller('HealthInsightsCtrl', HealthInsightsController);

  HealthInsightsController.$inject = ['HealthService', 'chartService'];
  function HealthInsightsController(HealthService, chartService) {
    var HealthInsightsCtrl = this;

    function init() {
      HealthService.getInsights()
        .then(function (resp) {
          HealthInsightsCtrl.insights = resp.data;
          chartService.updateChart(HealthInsightsCtrl.insights.affectsOfSleep, '#affectsOfSleep', 'Bar');
          chartService.updateChart(HealthInsightsCtrl.insights.affectsOnSleep, '#affectsOnSleep', 'Bar');
          chartService.updateChart(HealthInsightsCtrl.insights.activityLevelByMonth, '#activityLevelByMonth', 'Bar');
        });
    }

    init();
  }
})();
