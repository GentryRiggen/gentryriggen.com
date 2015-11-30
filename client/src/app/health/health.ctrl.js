(function () {
  'use strict';
  angular
    .module('gr')
    .controller('HealthCtrl', HealthController);

  HealthController.$inject = ['HealthService'];
  function HealthController(HealthService) {
    var HealthCtrl = this;

    function init() {
      HealthService.getData()
        .then(function (resp) {
          HealthCtrl.data = resp.data;
          HealthCtrl.selectedDay = resp.data[resp.data.length - 1];
        });
    }

    init();
  }
})();
