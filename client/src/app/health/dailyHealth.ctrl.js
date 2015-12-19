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

        $timeout(function () {
          DailyHealthCtrl.selectedDay.items.forEach(function (item) {
            var id;
            if (item.isSleep) {
              id = '#sleepChart-' + item.id;
              ChartJsService.updateChart(item.chartMinutes, id, 'Line');
            } else if (item.isWorkout) {
              id = '#workoutChart-' + item.id;
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

    init();
  }
})();
