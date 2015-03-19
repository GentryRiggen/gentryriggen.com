(function () {
    'use strict';
    angular
        .module('gr')
        .service('blogService', ['$http', 'API_URL', blogService]);

    function blogService($http, API_URL) {
        var thisApiUrl = API_URL + 'blog';
        var thisApiAdminUrl = API_URL + 'admin/blog';
        return {
            getPaginated: function (pageNum, pageSize, admin) {
                if (typeof pageNum == 'undefined')
                    pageNum = 1;
                if (typeof pageSize == 'undefined')
                    pageSize = 25;

                var url = thisApiUrl + '?page=' + pageNum + '&pageSize=' + pageSize;

                if (admin)
                    url += '&admin=true';

                return $http.get(url);
            },
            getAdminPaginated: function (pageNum, pageSize, admin) {
                if (typeof pageNum == 'undefined')
                    pageNum = 1;
                if (typeof pageSize == 'undefined')
                    pageSize = 25;

                var url = thisApiAdminUrl + '?page=' + pageNum + '&pageSize=' + pageSize;

                return $http.get(url);
            },
            getByPermalink: function (permalink) {
                return $http.get(thisApiUrl + '/' + permalink);
            },
            getById: function (id) {
                return $http.get(thisApiAdminUrl + '/' + id);
            },
            save: function (id, post) {
                if (post.id)
                    return $http.put(thisApiAdminUrl + '/' + id, post);
                else
                    return $http.post(thisApiAdminUrl, post);
                    
            },
            deleteById: function (id) {
                return $http.delete(thisApiAdminUrl + '/' + id);
            }
        }
    }
})();