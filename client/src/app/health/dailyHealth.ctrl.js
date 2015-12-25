(function () {
  'use strict';
  angular
    .module('gr')
    .controller('DailyHealthCtrl', DailyHealthController);

  DailyHealthController.$inject = ['HealthService', '$location', 'ChartService', 'moment', '$timeout'];
  function DailyHealthController(HealthService, $location, chartService, moment, $timeout) {
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
          }
        });
    }

    function updateCharts(data) {
      if (!data || data.length < 1) {
        DailyHealthCtrl.selectedDay = false;
      } else {
        DailyHealthCtrl.selectedDay = data[data.length - 1];
        DailyHealthCtrl.data = data;
        DailyHealthCtrl.stepsTakenPercentage = Math.round(((DailyHealthCtrl.selectedDay.stepsTaken ? DailyHealthCtrl.selectedDay.stepsTaken : 0) / 9000) * 100);
        DailyHealthCtrl.caloriesBurnedPercentage = Math.round(((DailyHealthCtrl.selectedDay.caloriesBurned ? DailyHealthCtrl.selectedDay.caloriesBurned : 0) / 3000) * 100);

        chartService.updateHighChart(DailyHealthCtrl.selectedDay.chartHours, '#dailySummaryHourChart');
        chartService.updateHighChart(DailyHealthCtrl.selectedDay.chartSteps, '#dailyStepGoalChart');
        chartService.updateHighChart(DailyHealthCtrl.selectedDay.chartCalories, '#dailyCalorieGoalChart');

        $timeout(function () {
          DailyHealthCtrl.selectedDay.items.forEach(function (item) {
            var id;
            if (item.isSleep) {
              id = '#sleepChart-' + item.id;
              chartService.updateHighChart(item.chartMinutes, id, 'Line');
            } else if (item.isWorkout) {
              id = '#workoutChart-' + item.id;
              chartService.updateHighChart(item.chartMinutes, id, 'Line');
            } else if (item.isRun) {
              id = '#runChart-' + item.id;
              chartService.updateHighChart(item.chartMinutes, id, 'Line');
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

    var today = moment(moment().format('YYYY-MM-DD'));
    function calcPrevAndNextDate() {
      DailyHealthCtrl.prevDate = moment(DailyHealthCtrl.date).subtract(1, 'days').format('YYYY-MM-DD');
      DailyHealthCtrl.nextDate = moment(DailyHealthCtrl.date).add(1, 'days').format('YYYY-MM-DD');
      if (today.diff(moment(DailyHealthCtrl.nextDate)) < 0) {
        DailyHealthCtrl.nextDate = false;
      }
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
