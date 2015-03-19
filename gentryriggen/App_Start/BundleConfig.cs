using System.Web;
using System.Web.Optimization;

namespace gentryriggen
{
    public class BundleConfig
    {
        // For more information on bundling, visit http://go.microsoft.com/fwlink/?LinkId=301862
        public static void RegisterBundles(BundleCollection bundles)
        {

            bundles.Add(new ScriptBundle("~/bundles/scripts").Include(
                        "~/app/scripts/lib/jquery-{version}.js",
                        "~/app/scripts/lib/bootstrap.js",
                        "~/app/scripts/lib/toastr.js",
                        "~/app/scripts/lib/underscore-min.js",
                        "~/app/scripts/lib/angular.js",
                        "~/app/scripts/lib/angular-ui-router.js",
                        "~/app/scripts/lib/angular-animate.js",
                        "~/app/scripts/lib/angular-sanitize.js",
                        "~/app/scripts/lib/angular-messages.min.js",
                        "~/app/scripts/lib/angular-ui/ui-bootstrap-tpls.min.js",
                        "~/app/scripts/lib/textAngular-rangy.min.js",
                        "~/app/scripts/lib/textAngular.min.js",
                        "~/app/scripts/lib/ui-tableView/tableView.js",
                        // Angular Libraries
                        "~/app/scripts/app.js",
                        "~/app/scripts/app.config.js",
                        // Angular Models
                        "~/app/scripts/models/blogPost.js",
                        "~/app/scripts/models/user.js",
                        // Angular Services
                        "~/app/scripts/services/alert.js",
                        "~/app/scripts/services/dialogService.js",
                        "~/app/scripts/services/authToken.js",
                        "~/app/scripts/services/authInterceptor.js",
                        "~/app/scripts/services/blogService.js",
                        "~/app/scripts/services/fileService.js",
                        // Angular Directives
                        "~/app/scripts/directives/formInput.js",
                        "~/app/scripts/directives/blogPostView.js",
                        "~/app/scripts/directives/blogPostEditView.js",
                        // Angular Controllers
                        "~/app/scripts/controllers/header.ctrl.js",
                        "~/app/scripts/controllers/login.ctrl.js",
                        "~/app/scripts/controllers/logout.ctrl.js",
                        "~/app/scripts/controllers/blog.ctrl.js",
                        "~/app/scripts/controllers/blogPost.ctrl.js",
                        "~/app/scripts/controllers/admin/admin.ctrl.js",
                        "~/app/scripts/controllers/admin/blogAdmin.ctrl.js",
                        "~/app/scripts/controllers/admin/blogAdminEdit.ctrl.js",
                        "~/app/scripts/controllers/admin/fileAdmin.ctrl.js",
                        "~/app/scripts/controllers/admin/account.ctrl.js"
                    ));

            bundles.Add(new StyleBundle("~/Content/css").Include(
                      "~/app/styles/bootstrap.yeti.min.css",
                      "~/app/styles/toastr.min.css",
                      "~/app/styles/animate.min.css",
                      "~/Content/font-awesome.min.css",
                      "~/app/scripts/lib/ui-tableView/uiTableView.css",
                      "~/app/styles/textAngular.css",
                      "~/app/styles/main.css"));
        }
    }
}
