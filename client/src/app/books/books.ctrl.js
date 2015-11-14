(function () {
  'use strict';
  angular
    .module('gr')
    .controller('BooksCtrl', BookController);

  BookController.$inject = ['BookService', 'AlertService', '$state'];
  function BookController(BookService, AlertService, $state) {
    var BooksCtrl = this;
    BooksCtrl.searching = false;
    BooksCtrl.books = [];
    BooksCtrl.page = 1;
    BooksCtrl.pageSize = 100;
    BooksCtrl.pages = [];

    function init() {
      BooksCtrl.getNextPage(BooksCtrl.page);
    }

    BooksCtrl.getNextPage = function (page, alreadyOnThePage) {
      if (alreadyOnThePage === true) return;
      AlertService.showLoading("Fetching Books...");
      BookService.getPaginated(page, BooksCtrl.pageSize)
        .then(function (resp) {
          getBooksCallback(resp.data);
          AlertService.hideLoading();
        }, function () {
          AlertService.showAlert('error', 'Failure', 'Failed to get books!');
          AlertService.hideLoading();
        });
    };

    BooksCtrl.search = function(q) {
      BooksCtrl.searching = true;
      BookService.getPaginated(BooksCtrl.page, BooksCtrl.pageSize, q)
        .then(function (resp) {
          getBooksCallback(resp.data);
          BooksCtrl.searching = false;
        },function () {
          BooksCtrl.searching = false;
        });
    };

    function getBooksCallback(data) {
      BooksCtrl.books = data.books;
      BooksCtrl.page = data.page;
      BooksCtrl.pageSize = data.pageSize;
      BooksCtrl.pages = [];
      for (var i = 1; i <= data.numPages; i++) {
        BooksCtrl.pages.push(i);
      }
    }

    BooksCtrl.rowClicked = function(book) {
      $state.go('book', {'id': book.id});
    };

    init();
  }
})();
