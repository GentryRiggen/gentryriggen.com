(function () {
  'use strict';
  angular
    .module('gr')
    .directive('blogPost', blogPost);

  blogPost.$inject = ['$state', '$window'];
  function blogPost($state, $window) {
    return {
      restrict: 'E',
      scope: {
        model: '=post',
        navigateToPost: '&'
      },
      templateUrl: '/src/app/blog/blogPost.tmpl.html',
      link: function (scope, element, attrs) {
        scope.showComments = attrs.showComments != "false";
        scope.sample = attrs.sample == "true";

        scope.goToPost = function () {
          $state.go('blogDetail', {'permalink': scope.model.permalink});
        };

        scope.twitterShare = function () {
          var url = "http://twitter.com/intent/tweet?url=" + encodeURIComponent(scope.model.url) +
            "&text=" + encodeURIComponent(scope.model.title) +
            "&via=gentryriggen";
          $window.open(url, '_blank');
        };

        scope.facebookShare = function () {
          var url = "http://facebook.com/sharer.php?u=" + encodeURIComponent(scope.model.url);
          $window.open(url, '_blank');
        };
      }
    };
  }
})();
