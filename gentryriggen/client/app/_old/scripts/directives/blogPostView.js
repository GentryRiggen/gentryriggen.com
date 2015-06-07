(function () {
    'use strict';
    angular
        .module('gr')
        .directive('blogPostView', ['$state', '$sce', blogPostViewDirective]);

    function blogPostViewDirective($state, $sce) {
        return {
            restrict: 'E',
            scope: {
                model: '=post',
                navigateToPost: '&'
            },
            templateUrl: '/app/views/directives/blogPostView.html',
            link: function (scope, element, attrs) {
                scope.showComments = attrs.showComments != "false";
                scope.goToPost = function () {
                    $state.go('blogPost', { 'permalink': scope.model.permalink });
                }
            }
        };
    }
})();