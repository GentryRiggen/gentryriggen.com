using gentryriggen.data;
using gentryriggen.models;
using gentryriggen.Utils;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.EntityFramework;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Security.Principal;
using System.Threading;
using System.Web;
using System.Web.Http.Controllers;
using System.Web.Http.Filters;

namespace gentryriggen.Filters
{
    public class TokenAuthAttribute : AuthorizationFilterAttribute
    {
        private AppData appData = new AppData();

        public string Roles { get; set; }

        public override void OnAuthorization(HttpActionContext actionContext)
        {
            
            // Get the token from the bearer header
            string token = null;
            IEnumerable<string> values;
            if (actionContext.Request.Headers.TryGetValues("Authorization", out values) && !String.IsNullOrEmpty(values.First().ToString()))
            {
                token = values.First().Split(' ')[1];
                // Decode the token and verfiy any roles and expirations
                try 
                {
                    JWT userJWT = new JWT(token, Utilities.GetSetting("JWTSecret"), true);

                    // If past expiration
                    if (Utilities.GetEpochTimeNow() > userJWT.ExpirationEpoch) throw new Exception("Token Expired!");

                    // Ensure this is an existing user
                    User dbUser = appData.Users.GetById(userJWT.UserId);
                    if (dbUser == null) {
                        throw new Exception("Could not find user");
                    }

                    var userManager = new UserManager<User>(new UserStore<User>(appData.Context));
                    // Check to see if the JWT lied about roles the user has
                    foreach (string role in userManager.GetRoles(dbUser.Id))
                    {
                        if (!userJWT.Claims.Contains(role))
                        {
                            throw new Exception("JWT lied about user roles");
                        }
                    }

                    // Set user on Thread and contexts
                    var currentPrinciple = new GenericPrincipal(new GenericIdentity(userJWT.UserId), userJWT.Claims.ToArray());
                    Thread.CurrentPrincipal = currentPrinciple;
                    HttpContext.Current.User = currentPrinciple;

                    // Finally Check Roles requested the JWT verify
                    if (this.Roles.Length > 0 && !String.IsNullOrEmpty(this.Roles))
                    {
                        foreach (string claim in userJWT.Claims)
                        {
                            if (this.Roles.Contains(claim))
                            {
                                return;
                            }
                        }
                    }
                    else
                    {
                        return;
                    }
                }
                catch (Exception e)
                {
                    Console.WriteLine(e);
                    HandleUnauthorized(actionContext);
                }
            }

            HandleUnauthorized(actionContext);
        }

        private void HandleUnauthorized(HttpActionContext actionContext)
        {
            actionContext.Response = new HttpResponseMessage(HttpStatusCode.Unauthorized);
        }
    }
}