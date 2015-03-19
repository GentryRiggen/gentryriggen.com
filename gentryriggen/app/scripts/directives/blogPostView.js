(function () {
    'use strict';
    angular
        .module('gr')
        .directive('blogPostView', ['$state', '$sce', blogPostViewDirective]);

    function blogPostViewDirective($state, $sce) {
        return {
            restrict: 'E',
            scope: {
                model: '=post'
            },
            templateUrl: '/app/views/directives/blogPostView.html',
            link: function (scope, element, attrs) {
                scope.goToPost = function () {
                    $state.go('blogPost', { 'permalink': scope.model.permalink });
                }
            }
        };
    }
})();