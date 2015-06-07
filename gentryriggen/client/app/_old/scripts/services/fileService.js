(function () {
    'use strict';
    angular
        .module('gr')
        .service('fileService', ['$http', 'API_URL', fileService]);

    function fileService($http, API_URL) {
        var thisApiUrl = API_URL + 'admin/files';
        return {
            getFilesPaginate: function (pageNum, pageSize, query) {
                var url = thisApiUrl + "?";
                if (typeof pageNum == 'undefined')
                    pageNum = 1;
                if (typeof pageSize == 'undefined')
                    pageSize = 50;
                if (typeof query == 'undefined')
                    query = "";

                var url = thisApiUrl + '?page=' + pageNum + '&pageSize=' + pageSize + "&q=" + query;

                return $http.get(url);
            },
            uploadFile: function (file) {
                var fd = new FormData();
                fd.append('file', file);
                return $http.post(thisApiUrl, fd, {
                    withCredentials: true,
                    headers: { 'Content-Type': undefined },
                    transformRequest: angular.identity
                });
            },
            deleteFile: function (fileName) {
                return $http.delete(thisApiUrl + '?fileName=' + encodeURI(fileName));
            }
        }
    }
})();