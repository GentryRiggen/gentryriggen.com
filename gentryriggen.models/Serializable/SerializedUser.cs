using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace gentryriggen.models.Serializable
{
    public class SerializedUser
    {
        public string UserName { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string BioSnippet { get; set; }
        public string ProfilePicture { get; set; }
    }
}
