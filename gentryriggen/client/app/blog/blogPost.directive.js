(function () {
    'use strict';
    angular
        .module('gr')
        .directive('blogPost', blogPost);

    blogPost.$inject = ['$state', '$sce'];
    function blogPost($state, $sce) {
        return {
            restrict: 'E',
            scope: {
                model: '=post',
                navigateToPost: '&'
            },
            templateUrl: '/client/app/blog/blogPost.tmpl.html',
            link: function (scope, element, attrs) {
                scope.showComments = attrs.showComments != "false";
                scope.goToPost = function () {
                    $state.go('blogDetail', { 'permalink': scope.model.permalink });
                }
            }
        };
    }
})();