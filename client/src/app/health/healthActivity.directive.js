(function () {
  'use strict';
  angular
    .module('gr')
    .directive('healthActivity', healthActivity);

  healthActivity.$inject = [];
  function healthActivity() {
    return {
      restrict: 'E',
      scope: {
        activity: '=',
        type: '='
      },
      templateUrl: '/src/app/health/healthActivity.tmpl.html',
      link: function ($scope) {
        $scope.convertDistanceToMiles = function (distance) {
          return Math.round((distance / 160934) * 100) / 100;
        };

        $scope.convertPace = function (pace) {
          // Pace is in ms / meter
          // Convert to minutes/mile
          pace = pace / 0.0268224;
          return pace;
        };

        $scope.convertDuration = function (duration, precision) {
          var minutes = Math.floor(duration / 60);
          var hours = Math.floor(minutes / 60);
          minutes = minutes - (hours * 60);
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
      }
    };
  }
})();
