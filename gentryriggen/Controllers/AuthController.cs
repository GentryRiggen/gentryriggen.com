using gentryriggen.data;
using gentryriggen.Filters;
using gentryriggen.models;
using gentryriggen.models.DTO;
using gentryriggen.Utils;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.EntityFramework;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;

namespace gentryriggen.Controllers
{
    public class AuthController : ApiController
    {
        private AppData appData = new AppData();
        private UserManager<User> _userManager;
        private UserStore<User> _userStore;

        public UserStore<User> UserStore
        {
            get
            {
                return _userStore ?? new UserStore<User>(appData.Context);
            }
        }
        
        public UserManager<User> UserManager
        {
            get
            {
                return _userManager ?? new UserManager<User>(this.UserStore);
            }
        }

        [Route("api/auth/user")]
        [TokenAuth]
        public IHttpActionResult Get()
        {
            User currentUser = appData.Users.GetById(User.Identity.Name);
            if (currentUser == null)
            {
                return NotFound();
            }
            else
            {
                return Ok(currentUser.Serialize());
            }
        }

        [Route("api/auth")]
        public HttpResponseMessage Post([FromBody]LoginUserModel loginModel)
        {
            User u = UserManager.Find(loginModel.Username, loginModel.Password);
            if (u == null)
            {
                // No user with userName/password exists.
                return Request.CreateErrorResponse(HttpStatusCode.Unauthorized, "Invalid username/password");
            }
            else
            {
                User dbUser = appData.Users.GetById(u.Id);
                // Create JWT payload for user
                // Get user roles
                IEnumerable<string> roles = UserManager.GetRoles(dbUser.Id);
                JWT userJWT = new JWT(u.Id, roles);
                string jwt = userJWT.ToJWTString(Utilities.GetSetting("JWTSecret"));
                AuthorizedResponse response = new AuthorizedResponse
                {
                    Token = jwt,
                    User = dbUser.Serialize(),
                    Claims = roles
                };
                return Request.CreateResponse(HttpStatusCode.OK, response);
            }
        }

        [HttpPost]
        [TokenAuth(Roles = "Admin, Editor")]
        [Route("api/auth/passwordreset/")]
        public async Task<IHttpActionResult> ResetPassword(ResetUserPasswordModel model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest();
            }
            User currentUser = appData.Users.GetById(User.Identity.Name);
            if (currentUser == null)
            {
                return BadRequest();
            }
            // Try logging in as current user with supplied old password
            User u = this.UserManager.Find(currentUser.UserName, model.OldPassword);
            if (u == null)
            {
                // No user with userName/password exists.
                return BadRequest("Could not authenticate");
            }

            try
            {
                String hashedNewPassword = this.UserManager.PasswordHasher.HashPassword(model.Password);
                await this.UserStore.SetPasswordHashAsync(u, hashedNewPassword);
                await this.UserStore.UpdateAsync(u);
                return Ok();
            }
            catch (Exception e)
            {
                Console.WriteLine(e);
                return BadRequest("Could not reset password");
            }
        }
    }
}
