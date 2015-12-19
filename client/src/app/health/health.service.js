(function () {
  'use strict';
  angular
    .module('gr')
    .service('HealthService', HealthService);

  HealthService.$inject = ['$http', 'API_URL'];
  function HealthService($http, API_URL) {
    var thisApiUrl = API_URL + '/health',
      healthSvc = {};

    healthSvc.getData = function(date) {
      return $http.get(thisApiUrl + '/day/' + date);
    };

    healthSvc.getInsights = function() {
      return $http.get(thisApiUrl + '/insights');
    };

    return healthSvc;
  }
})();
