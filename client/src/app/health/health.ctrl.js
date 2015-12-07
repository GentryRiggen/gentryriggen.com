(function () {
  'use strict';
  angular
    .module('gr')
    .controller('HealthCtrl', HealthController);

  HealthController.$inject = ['HealthService', '$location', 'ChartJsService', 'moment', '$timeout'];
  function HealthController(HealthService, $location, ChartJsService, moment, $timeout) {
    var HealthCtrl = this;
    HealthCtrl.loading = true;

    function init() {
      HealthCtrl.loading = true;
      initStartAndEnd();
      HealthService.getData(HealthCtrl.date)
        .then(function (resp) {
          HealthCtrl.loading = false;

          updateCharts(resp.data);
          if (resp.data && resp.data.length < 1) {
            HealthCtrl.data = resp.data;
            HealthCtrl.stepsTakenPercentage = Math.round(((HealthCtrl.selectedDay.stepsTaken ? HealthCtrl.selectedDay.stepsTaken : 0) / 9000) * 100);
            HealthCtrl.caloriesBurnedPercentage = Math.round(((HealthCtrl.selectedDay.caloriesBurned ? HealthCtrl.selectedDay.caloriesBurned : 0) / 3000) * 100);
          }
        });
    }

    function updateCharts(data) {
      if (!data || data.length < 1) {
        console.log('Clearing Charts', data);
        ChartJsService.updateChart(false, '#dailySummaryHourChart', 'Line');
        ChartJsService.updateChart(false, '#dailyStepGoalChart', 'Doughnut');
        ChartJsService.updateChart(false, '#dailyCalorieGoalChart', 'Doughnut');

        $timeout(function () {
          HealthCtrl.selectedDay.items.forEach(function (item) {
            var id;
            if (item.isWorkout) {
              id = '#workoutChart-' + item.id;
            } else if (item.isRun) {
              id = '#runChart-' + item.id;
            }
            ChartJsService.updateChart(false, id, 'Line');
          });
        }, 500);

        HealthCtrl.selectedDay = false;
      } else {
        HealthCtrl.selectedDay = data[data.length - 1];
        HealthCtrl.data = data;
        HealthCtrl.stepsTakenPercentage = Math.round(((HealthCtrl.selectedDay.stepsTaken ? HealthCtrl.selectedDay.stepsTaken : 0) / 9000) * 100);
        HealthCtrl.caloriesBurnedPercentage = Math.round(((HealthCtrl.selectedDay.caloriesBurned ? HealthCtrl.selectedDay.caloriesBurned : 0) / 3000) * 100);

        ChartJsService.updateChart(HealthCtrl.selectedDay.chartHours, '#dailySummaryHourChart', 'Line');
        ChartJsService.updateChart(HealthCtrl.selectedDay.chartSteps, '#dailyStepGoalChart', 'Doughnut');
        ChartJsService.updateChart(HealthCtrl.selectedDay.chartCalories, '#dailyCalorieGoalChart', 'Doughnut');

        console.log('Timeout', HealthCtrl.selectedDay.items);
        $timeout(function () {
          HealthCtrl.selectedDay.items.forEach(function (item) {
            var id;
            if (item.isWorkout) {
              id = '#workoutChart-' + item.id;
              console.log('ChartJsService.updateChart', id, item.chartMinutes, id);
              ChartJsService.updateChart(item.chartMinutes, id, 'Line');
            } else if (item.isRun) {
              id = '#runChart-' + item.id;
              ChartJsService.updateChart(item.chartMinutes, id, 'Line');
            }
          });
        }, 500);
      }
    }

    function initStartAndEnd() {
      if (!HealthCtrl.date) {
        var queryParams = $location.search();
        if (queryParams.date) {
          HealthCtrl.date = moment(queryParams.date).format('YYYY-MM-DD');
        } else {
          HealthCtrl.date = moment().format('YYYY-MM-DD');
        }

        calcPrevAndNextDate();
        $location.search('date', HealthCtrl.date);
      }
    }

    function calcPrevAndNextDate() {
      HealthCtrl.prevDate = moment(HealthCtrl.date).subtract(1, 'days').format('YYYY-MM-DD');
      HealthCtrl.nextDate = moment(HealthCtrl.date).add(1, 'days').format('YYYY-MM-DD');
    }

    HealthCtrl.dateChange = function (direction) {
      if (direction > 0) {
        HealthCtrl.date = HealthCtrl.nextDate;
      } else {
        HealthCtrl.date = HealthCtrl.prevDate;
      }
      $location.search('date', HealthCtrl.date);
      calcPrevAndNextDate();

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
      return Math.round((distance / 160934) * 100) / 100;
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

    init();
  }
})();
