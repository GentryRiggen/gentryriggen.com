(function () {
  'use strict';
  angular
    .module('gr')
    .controller('AdminBookCtrl', AdminBookController);

  AdminBookController.$inject = ['BookService', '$stateParams', 'AlertService', 'AuthTokenService', 'FileUploader'];
  function AdminBookController(BookService, $stateParams, AlertService, AuthTokenService, FileUploader) {
    var AdminBookCtrl = this;
    AdminBookCtrl.book = false;

    function init() {
      AlertService.showLoading('Fetching Book Details...');
      BookService.getById($stateParams.id).then(
        function(resp) {
          AdminBookCtrl.book = resp.data;
          AlertService.hideLoading();
        }, function() {
          AlertService.showAlert('error', 'Failure', 'Failed to get book details!');
          AlertService.hideLoading();
        });
    }

    // UPLOADS
    function onAfterAddingFile() {
      AdminBookCtrl.loading = true;
      AlertService.showAlert('success', 'Success', 'Add file to queue');
    }
    function onErrorItem() {
      AdminBookCtrl.loading = false;
      AlertService.showAlert('error', 'Failed', 'Failed to upload file');
    }
    function onSuccessItem() {
      AdminBookCtrl.loading = false;
      AlertService.showAlert('success', 'Success!', 'File has been uploaded');
      init();
    };

    // ARTWORK UPLOAD
    AdminBookCtrl.artworkUploader = new FileUploader({
      url: BookService.getArtworkUploadUrl($stateParams.id),
      autoUpload: true,
      headers: {
        Authorization: 'bearer ' + AuthTokenService.getToken()
      }
    });
    AdminBookCtrl.artworkUploader.onAfterAddingFile = onAfterAddingFile;
    AdminBookCtrl.artworkUploader.onErrorItem = onErrorItem;
    AdminBookCtrl.artworkUploader.onSuccessItem = onSuccessItem;

    // FILE UPLOAD
    AdminBookCtrl.fileUploader = new FileUploader({
      url: BookService.getFileUploadUrl($stateParams.id),
      autoUpload: true,
      headers: {
        Authorization: 'bearer ' + AuthTokenService.getToken()
      }
    });
    AdminBookCtrl.fileUploader.onAfterAddingFile = onAfterAddingFile;
    AdminBookCtrl.fileUploader.onErrorItem = onErrorItem;
    AdminBookCtrl.fileUploader.onSuccessItem = onSuccessItem;

    init();
  }
})();
