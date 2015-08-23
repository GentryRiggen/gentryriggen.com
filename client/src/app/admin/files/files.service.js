(function () {
  'use strict';
  angular
    .module('gr')
    .service('FilesService', FilesService);

  FilesService.$inject = ['$http', 'API_URL'];
  function FilesService($http, API_URL) {
    var thisApiUrl = API_URL + '/admin/files';
    return {
      getFilesPaginate: function (pageNum, pageSize, query) {
        if (angular.isUndefined(pageNum))
          pageNum = 1;
        if (angular.isUndefined(pageSize))
          pageSize = 50;
        if (angular.isUndefined(query))
          query = "";

        var url = thisApiUrl + '?page=' + pageNum + '&pageSize=' + pageSize + "&q=" + query;

        return $http.get(url);
      },
      getUploadUrl: function() {
        return thisApiUrl;
      },
      uploadFile: function (file) {
        /* jshint -W117 */
        var fd = new FormData();
        fd.append('file', file);
        return $http.post(thisApiUrl, fd, {
          withCredentials: true,
          headers: {'Content-Type': undefined},
          transformRequest: angular.identity
        });
      },
      deleteFile: function (fileName) {
        return $http.delete(thisApiUrl + '?fileName=' + encodeURI(fileName));
      }
    };
  }
})();
