(function () {
  'use strict';
  angular
    .module('gr')
    .directive('bookDetail', bookDetail);

  bookDetail.$inject = ['$window', '$state'];
  function bookDetail($window, $state) {
    return {
      restrict: 'E',
      scope: {
        book: '=book'
      },
      templateUrl: '/src/app/books/bookDetail.tmpl.html',
      link: function ($scope, el, attrs) {
        $scope.showComments = attrs.showComments != "false";

        $scope.goToBook = function() {
          $state.go('book', {'id': $scope.book.id});
        };

        $scope.readMore = function() {
          $state.go('books');
        };
      }
    };
  }
})();
