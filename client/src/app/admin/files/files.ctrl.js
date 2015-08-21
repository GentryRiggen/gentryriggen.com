(function () {
  'use strict';
  angular
    .module('gr')
    .controller('FilesCtrl', FilesController);

  FilesController.$inject = ['AlertService', 'FilesService', '$mdDialog', 'FileUploader', 'AuthTokenService'];
  function FilesController(AlertService, FilesService, $mdDialog, FileUploader, AuthTokenService) {
    var FilesCtrl = this;
    FilesCtrl.files = [];
    FilesCtrl.page = 1;
    FilesCtrl.pageSize = 25;
    FilesCtrl.numPages = 0;
    FilesCtrl.pages = [];

    var init = function () {
      FilesCtrl.getNextPage(FilesCtrl.page);
    };

    FilesCtrl.getNextPage = function (page, alreadyOnThePage) {
      if (alreadyOnThePage === true) return;
      AlertService.showLoading("Fetching Files...");
      FilesService.getFilesPaginate(page, FilesCtrl.pageSize)
        .success(function (data) {
          FilesCtrl.files = data.files;
          FilesCtrl.numPages = data.numPages;
          FilesCtrl.page = data.page;
          FilesCtrl.pageSize = data.pageSize;
          FilesCtrl.pages = [];
          for (var i = 1; i <= FilesCtrl.numPages; i++) {
            FilesCtrl.pages.push(i);
          }
          AlertService.hideLoading();
        }).error(function () {
          AlertService.showAlert('error', 'Failure', 'Failed to get files!');
          AlertService.hideLoading();
        });
    };

    FilesCtrl.refresh = function () {
      FilesCtrl.getNextPage(FilesCtrl.page);
    };

    FilesCtrl.search = function (q) {
      FilesService.getFilesPaginate(FilesCtrl.page, FilesCtrl.pageSize, q)
        .success(function (data) {
          FilesCtrl.files = data.files;
        }).error(function () {
          AlertService.showAlert('error', 'Uh oh!', 'Failed to search files');
        });
    };

    FilesCtrl.delete = function (path) {
      var confirm = $mdDialog.confirm()
        .title('Are you sure?')
        .content('Are you sure you want to delete this file?')
        .ariaLabel('Delete File')
        .ok('OK')
        .cancel('Cancel');
      $mdDialog.show(confirm).then(function () {
        FilesService.deleteFile(path)
          .success(function () {
            AlertService.showAlert('success', 'Success!', 'File has been deleted');
            FilesCtrl.refresh();
          })
          .error(function () {
            AlertService.showAlert('error', 'Failed', 'Failed to delete file');
          });
      });
    };

    FilesCtrl.uploader = new FileUploader({
      url: FilesService.getUploadUrl(),
      autoUpload: true,
      headers: {
        Authorization: 'bearer ' + AuthTokenService.getToken()
      }
    });

    FilesCtrl.uploader.onWhenAddingFileFailed = function() {
      AlertService.showAlert('error', 'Failed', 'onWhenAddingFileFailed Failed to add file for upload');
    };
    FilesCtrl.uploader.onAfterAddingFile = function() {
      AlertService.showAlert('success', 'Success', 'Add file to queue');
    };
    FilesCtrl.uploader.onSuccessItem = function() {
      AlertService.showAlert('success', 'Success!', 'File has been uploaded');
    };
    init();

    FilesCtrl.uploader.onErrorItem = function() {
      AlertService.showAlert('error', 'Failed', 'Failed to upload file');
    };
  }
})();
