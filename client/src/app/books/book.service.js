(function () {
  'use strict';
  angular
    .module('gr')
    .service('BookService', BookService);

  BookService.$inject = ['$http', 'API_URL'];
  function BookService($http, API_URL) {
    var thisApiUrl = API_URL + '/books',
      thisAdminApiUrl = API_URL + '/admin/books',
      bookSvc = {};

    bookSvc.getPaginated = function (pageNum, pageSize, q, admin) {
      if (angular.isUndefined(pageNum)) {
        pageNum = 1;
      }

      if (angular.isUndefined(pageSize)) {
        pageSize = 50;
      }

      var url = admin ? thisAdminApiUrl : thisApiUrl;
      url += '?page=' + pageNum + '&pageSize=' + pageSize;

      if (angular.isDefined(q) && q) {
        url += '&q=' + q;
      }

      return $http.get(url);
    };

    bookSvc.getById = function(id, admin) {

      return admin ? $http.get(thisAdminApiUrl + '/' + id) : $http.get(thisApiUrl + '/' + id);
    };

    bookSvc.createNew = function() {
      return $http.post(thisAdminApiUrl + '/new', {});
    };

    bookSvc.updateBook = function(id, book) {
      return $http.put(thisAdminApiUrl + '/' + id, book);
    };

    bookSvc.getArtworkUploadUrl = function(id) {
      return thisAdminApiUrl + '/' + id + '/artwork';
    };

    bookSvc.getFileUploadUrl = function(id) {
      return thisAdminApiUrl + '/' + id + '/file';
    };

    bookSvc.deleteById = function(id) {
      return $http.delete(thisAdminApiUrl + '/' + id);
    };

    return bookSvc;
  }
})();
