(function () {
  'use strict';
  angular
    .module('gr')
    .controller('HealthInsightsCtrl', HealthInsightsController);

  HealthInsightsController.$inject = ['HealthService'];
  function HealthInsightsController(HealthService) {
    var HealthInsightsCtrl = this;

    function init() {

    }

    init();
  }
})();
