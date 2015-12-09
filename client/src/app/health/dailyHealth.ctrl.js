(function () {
  'use strict';
  angular
    .module('gr')
    .controller('DailyHealthCtrl', DailyHealthController);

  DailyHealthController.$inject = ['HealthService', '$location', 'ChartJsService', 'moment', '$timeout'];
  function DailyHealthController(HealthService, $location, ChartJsService, moment, $timeout) {
    var DailyHealthCtrl = this;
    DailyHealthCtrl.loading = true;

    function init() {
      DailyHealthCtrl.loading = true;
      initStartAndEnd();
      HealthService.getData(DailyHealthCtrl.date)
        .then(function (resp) {
          DailyHealthCtrl.loading = false;

          updateCharts(resp.data);
          if (resp.data && resp.data.length < 1) {
            DailyHealthCtrl.data = resp.data;
            DailyHealthCtrl.stepsTakenPercentage = Math.round(((DailyHealthCtrl.selectedDay.stepsTaken ? DailyHealthCtrl.selectedDay.stepsTaken : 0) / 9000) * 100);
            DailyHealthCtrl.caloriesBurnedPercentage = Math.round(((DailyHealthCtrl.selectedDay.caloriesBurned ? DailyHealthCtrl.selectedDay.caloriesBurned : 0) / 3000) * 100);
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
          DailyHealthCtrl.selectedDay.items.forEach(function (item) {
            var id;
            if (item.isWorkout) {
              id = '#workoutChart-' + item.id;
            } else if (item.isRun) {
              id = '#runChart-' + item.id;
            }
            ChartJsService.updateChart(false, id, 'Line');
          });
        }, 500);

        DailyHealthCtrl.selectedDay = false;
      } else {
        DailyHealthCtrl.selectedDay = data[data.length - 1];
        DailyHealthCtrl.data = data;
        DailyHealthCtrl.stepsTakenPercentage = Math.round(((DailyHealthCtrl.selectedDay.stepsTaken ? DailyHealthCtrl.selectedDay.stepsTaken : 0) / 9000) * 100);
        DailyHealthCtrl.caloriesBurnedPercentage = Math.round(((DailyHealthCtrl.selectedDay.caloriesBurned ? DailyHealthCtrl.selectedDay.caloriesBurned : 0) / 3000) * 100);

        ChartJsService.updateChart(DailyHealthCtrl.selectedDay.chartHours, '#dailySummaryHourChart', 'Line');
        ChartJsService.updateChart(DailyHealthCtrl.selectedDay.chartSteps, '#dailyStepGoalChart', 'Doughnut');
        ChartJsService.updateChart(DailyHealthCtrl.selectedDay.chartCalories, '#dailyCalorieGoalChart', 'Doughnut');

        console.log('Timeout', DailyHealthCtrl.selectedDay.items);
        $timeout(function () {
          DailyHealthCtrl.selectedDay.items.forEach(function (item) {
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
      if (!DailyHealthCtrl.date) {
        var queryParams = $location.search();
        if (queryParams.date) {
          DailyHealthCtrl.date = moment(queryParams.date).format('YYYY-MM-DD');
        } else {
          DailyHealthCtrl.date = moment().format('YYYY-MM-DD');
        }

        calcPrevAndNextDate();
        $location.search('date', DailyHealthCtrl.date);
      }
    }

    function calcPrevAndNextDate() {
      DailyHealthCtrl.prevDate = moment(DailyHealthCtrl.date).subtract(1, 'days').format('YYYY-MM-DD');
      DailyHealthCtrl.nextDate = moment(DailyHealthCtrl.date).add(1, 'days').format('YYYY-MM-DD');
    }

    DailyHealthCtrl.dateChange = function (direction) {
      if (direction > 0) {
        DailyHealthCtrl.date = DailyHealthCtrl.nextDate;
      } else {
        DailyHealthCtrl.date = DailyHealthCtrl.prevDate;
      }
      $location.search('date', DailyHealthCtrl.date);
      calcPrevAndNextDate();

      init();
    };

    DailyHealthCtrl.toLocal = function (date) {
      var localTime = moment.utc(date).toDate();
      console.log(date, localTime, moment(localTime));
      return moment(localTime).format('YYYY-MM-DD HH:mm:ss');
    };

    DailyHealthCtrl.getMonth = function (date) {
      return moment(DailyHealthCtrl.toLocal(date)).format('MMM');
    };

    DailyHealthCtrl.getDayOfMonth = function (date) {
      return moment(DailyHealthCtrl.toLocal(date)).format('DD');
    };

    DailyHealthCtrl.getLastSync = function (date) {
      return moment(DailyHealthCtrl.toLocal(date)).format('YYYY-MM-DD HH:mm:ss');
    };

    DailyHealthCtrl.convertDistanceToMiles = function (distance) {
      return Math.round((distance / 160934) * 100) / 100;
    };

    DailyHealthCtrl.convertPace = function (pace) {
      // Pace is in ms / meter
      // Convert to minutes/mile
      console.log(pace);
      pace = pace / 0.0268224;
      console.log(pace);

      return pace;
    };

    DailyHealthCtrl.convertDuration = function (duration, precision) {
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
