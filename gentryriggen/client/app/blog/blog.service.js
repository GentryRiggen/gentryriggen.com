(function () {
    'use strict';
    angular
        .module('gr')
        .service('BlogService', BlogService);

    BlogService.$inject = ['$http', 'API_URL'];
    function BlogService($http, API_URL) {
        var thisApiUrl = API_URL + '/blog';
        var thisApiAdminUrl = API_URL + 'admin/blog';
        var blogSvc = {};

        blogSvc.getPaginated = function (pageNum, pageSize, admin) {
            if (angular.isUndefined(pageNum)) {
                pageNum = 1;
            }
                    
            if (angular.isUndefined(pageSize)) {
                pageSize = 25;
            }

            var url = thisApiUrl + '?page=' + pageNum + '&pageSize=' + pageSize;

            if (admin)
                url += '&admin=true';

            return $http.get(url);
        };

        blogSvc.getAdminPaginated = function (pageNum, pageSize, admin) {
            if (typeof pageNum == 'undefined')
                pageNum = 1;
            if (typeof pageSize == 'undefined')
                pageSize = 25;

            var url = thisApiAdminUrl + '?page=' + pageNum + '&pageSize=' + pageSize;

            return $http.get(url);
        };

        blogSvc.getByPermalink = function (permalink) {
            return $http.get(thisApiUrl + '/' + permalink);
        };

        blogSvc.getById = function (id) {
            return $http.get(thisApiAdminUrl + '/' + id);
        };

        blogSvc.save = function (id, post) {
            if (post.id)
                return $http.put(thisApiAdminUrl + '/' + id, post);
            else
                return $http.post(thisApiAdminUrl, post);
                    
        };

        blogSvc.deleteById = function (id) {
            return $http.delete(thisApiAdminUrl + '/' + id);
        };

        return blogSvc;
    }
})();