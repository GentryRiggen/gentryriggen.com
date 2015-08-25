(function () {
  'use strict';
  angular
    .module('gr')
    .service('AuthorService', AuthorService);

  AuthorService.$inject = ['$http', 'API_URL'];
  function AuthorService($http, API_URL) {
    var thisApiUrl = API_URL + '/admin/authors';
    var authorSvc = {};

    authorSvc.getAll = function () {
      return $http.get(thisApiUrl);
    };

    authorSvc.getById = function(id) {
      return $http.get(thisApiUrl + '/' + id);
    };

    authorSvc.createNew = function() {
      return $http.post(thisApiUrl + '/new', {});
    };

    authorSvc.updateAuthor = function(id, author) {
      return $http.put(thisApiUrl + '/' + id, author);
    };

    return authorSvc;
  }
})();
