(function () {
  'use strict';
  angular
    .module('gr')
    .service('AccountService', AccountService);

  AccountService.$inject = ['$http', 'API_URL'];
  function AccountService($http, API_URL) {
    var thisApiUrl = API_URL + '/admin/accounts';
    var accountSvc = {};

    accountSvc.getAll = function () {
      return $http.get(thisApiUrl);
    };

    accountSvc.getById = function(id) {
      return $http.get(thisApiUrl + '/' + id);
    };

    accountSvc.updateUser = function(id, user) {
      return $http.put(thisApiUrl + '/' + id, user);
    };

    accountSvc.updateUserPassword = function(id, password) {
      return $http.put(thisApiUrl + '/' + id + '/password', {
        password: password
      });
    };

    accountSvc.updateUserRoles = function(id, roles) {
      return $http.put(thisApiUrl + '/' + id + '/roles', roles);
    };

    return accountSvc;
  }
})();
