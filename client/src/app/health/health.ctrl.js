(function () {
  'use strict';
  angular
    .module('gr')
    .controller('HealthCtrl', HealthController);

  HealthController.$inject = ['HealthService', '$location'];
  function HealthController(HealthService, $location) {
    var HealthCtrl = this;
    HealthCtrl.date;
    HealthCtrl.loading = true;

    function init() {
      HealthCtrl.loading = true;
      initStartAndEnd();
      HealthService.getData(HealthCtrl.date)
        .then(function (resp) {
          HealthCtrl.selectedDay = resp.data[resp.data.length - 1];
          HealthCtrl.data = resp.data;
          HealthCtrl.loading = false;
        });
    }

    function initStartAndEnd() {
      if (!HealthCtrl.date) {
        var queryParams = $location.search();
        if (queryParams.date) {
          HealthCtrl.date = moment(queryParams.date).format('YYYY-MM-DD');
        } else {
          HealthCtrl.date = moment().format('YYYY-MM-DD');
        }

        $location.search('date', HealthCtrl.date);
      }
    }

    HealthCtrl.dateChange = function (direction) {
      if (direction > 0) {
        HealthCtrl.date = moment(HealthCtrl.date).add(1, 'days').format('YYYY-MM-DD');
      } else {
        HealthCtrl.date = moment(HealthCtrl.date).subtract(1, 'days').format('YYYY-MM-DD');
      }

      $location.search('date', HealthCtrl.date);
      init();
    };

    HealthCtrl.toLocal = function (date) {
      var localTime = moment.utc(date).toDate();
      console.log(date, localTime, moment(localTime));
      return moment(localTime).format('YYYY-MM-DD HH:mm:ss');
    };

    HealthCtrl.getMonth = function (date) {
      return moment(HealthCtrl.toLocal(date)).format('MMM');
    };

    HealthCtrl.getDayOfMonth = function (date) {
      return moment(HealthCtrl.toLocal(date)).format('DD');
    };

    HealthCtrl.getLastSync = function (date) {
      return moment(HealthCtrl.toLocal(date)).format('YYYY-MM-DD HH:mm:ss');
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

    HealthCtrl.convertDuration = function (duration, precision) {
      var minutes = Math.floor(duration/60);
      var hours = Math.floor(minutes/60);
      minutes = minutes - (hours*60);
      var rem = duration % 60;

      var durationStr = '';
      switch (precision) {
        case 2:
          var durationStr = minutes + 'm';
          if (hours > 0) {
            durationStr = hours + 'h ' + durationStr;
          }
          break;
        default:
          var durationStr = minutes + 'm ' + rem + 's';
          if (hours > 0) {
            durationStr = hours + 'h ' + durationStr;
          }
          break;
      }

      return durationStr;
    };

    init();
  }
})();
