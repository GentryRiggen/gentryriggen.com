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
          HealthCtrl.selectedDay = resp.data[resp.data.length - 1];
          HealthCtrl.data = resp.data;
        });
    }

    HealthCtrl.toLocal = function (date) {
      return moment(date).format('YYYY-MM-DD HH:mm:ss');
    };

    HealthCtrl.getMonth = function (date) {
      return moment(HealthCtrl.toLocal(date)).format('MMM');
    };

    HealthCtrl.getDayOfMonth = function (date) {
      return moment(HealthCtrl.toLocal(date)).format('DD');
    };

    HealthCtrl.convertDistanceToMiles = function (distance) {
      return Math.round((distance/160934)*100) / 100;
    };

    HealthCtrl.convertPace = function (pace) {
      // Pace is in ms / meter
      // Convert to minutes/mile
      console.log(pace);
      pace = pace / 0.0268224;
      console.log(pace);

      return pace;
    };

    HealthCtrl.convertDuration = function (duration) {
      var minutes = Math.floor(duration/60);
      var rem = duration % 60;
      return minutes + ':' + rem;
    };

    init();
  }
})();
