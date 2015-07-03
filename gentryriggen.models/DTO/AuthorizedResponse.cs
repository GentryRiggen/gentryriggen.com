using gentryriggen.models.Serializable;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace gentryriggen.models.DTO
{
    public class AuthorizedResponse
    {
        public string Token { get; set; }
        public IEnumerable<string> Roles { get; set; }
        public SerializedUser User { get; set; }
    }
}
