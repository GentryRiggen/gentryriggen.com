(function () {
  'use strict';
  angular
    .module('gr')
    .service('BookService', BookService);

  BookService.$inject = ['$http', 'API_URL'];
  function BookService($http, API_URL) {
    var thisApiUrl = API_URL + '/admin/books';
    var bookSvc = {};

    bookSvc.getPaginated = function (pageNum, pageSize, q) {
      if (angular.isUndefined(pageNum)) {
        pageNum = 1;
      }

      if (angular.isUndefined(pageSize)) {
        pageSize = 50;
      }

      var url = thisApiUrl + '?page=' + pageNum + '&pageSize=' + pageSize;

      if (angular.isDefined(q)) {
        url += '&q=' + q;
      }

      return $http.get(url);
    };

    bookSvc.getAll = function () {
      return $http.get(thisApiUrl);
    };

    bookSvc.getById = function(id) {
      return $http.get(thisApiUrl + '/' + id);
    };

    bookSvc.createNew = function() {
      return $http.post(thisApiUrl + '/new', {});
    };

    bookSvc.updateBook = function(id, book) {
      return $http.put(thisApiUrl + '/' + id, book);
    };

    bookSvc.getArtworkUploadUrl = function(id) {
      return thisApiUrl + '/' + id + '/artwork';
    };

    bookSvc.getFileUploadUrl = function(id) {
      return thisApiUrl + '/' + id + '/file';
    };

    bookSvc.deleteById = function(id) {
      return $http.delete(thisApiUrl + '/' + id);
    };

    return bookSvc;
  }
})();
