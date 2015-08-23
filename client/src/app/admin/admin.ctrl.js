(function () {
  'use strict';
  angular
    .module('gr')
    .controller('AdminCtrl', AdminController);

  AdminController.$inject = ['$state'];
  function AdminController($state) {
    var AdminCtrl = this;
    AdminCtrl.sections = [
      {title: "Blog Posts", state: "admin.blog"},
      {title: "Files", state: "admin.files"},
      {title: "Accounts", state: "admin.accounts"}
    ];

    function init() {
      AdminCtrl.selectedState = false;
      angular.forEach(AdminCtrl.sections, function (section) {
        console.log('SECTION: ', section.state, 'CURRENT: ', $state.current.name);
        if (!AdminCtrl.selectedState && section.state == $state.current.name) AdminCtrl.selectedState = section;
      });
      if (!AdminCtrl.selectedState) AdminCtrl.selectedState = AdminCtrl.sections[0];

      AdminCtrl.goTo(AdminCtrl.selectedState);
    }

    AdminCtrl.goTo = function (section) {
      AdminCtrl.selectedState = section;
      $state.go(section.state);
    };

    init();
  }
})();
