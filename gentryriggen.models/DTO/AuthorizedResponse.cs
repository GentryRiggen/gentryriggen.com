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
        public string Bearer { get; set; }
        public IEnumerable<string> Claims { get; set; }
        public SerializedUser User { get; set; }
    }
}
