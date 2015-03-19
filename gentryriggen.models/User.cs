using gentryriggen.models.Serializable;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.EntityFramework;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace gentryriggen.models
{
    public class User : IdentityUser, IAutoDates, ISerializable<User, SerializedUser>
    {
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string BioSnippet { get; set; }
        public string ProfilePicture { get; set; }
        public DateTime CreatedOn { get; set; }
        public DateTime ModifiedOn { get; set; }

        public async Task<ClaimsIdentity> GenerateUserIdentityAsync(UserManager<User> manager)
        {
            // Note the authenticationType must match the one defined in CookieAuthenticationOptions.AuthenticationType
            var userIdentity = await manager.CreateIdentityAsync(this, DefaultAuthenticationTypes.ApplicationCookie);
            // Add custom user claims here
            return userIdentity;
        }

        public SerializedUser Serialize()
        {
            return new SerializedUser
            {
                UserName = this.UserName,
                FirstName = this.FirstName,
                LastName = this.LastName,
                BioSnippet = this.BioSnippet,
                ProfilePicture = this.ProfilePicture
            };
        }

        public void DeSerialize(SerializedUser serializedEntity)
        {
            this.UserName = serializedEntity.UserName;
            this.FirstName = serializedEntity.FirstName;
            this.LastName = serializedEntity.LastName;
            this.BioSnippet = serializedEntity.BioSnippet;
            this.ProfilePicture = serializedEntity.ProfilePicture;
        }
    }
}
