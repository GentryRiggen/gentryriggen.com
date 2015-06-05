using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace gentryriggen.models.Serializable
{
    public class SerializedBlogPost
    {
        public int Id { get; set; }
        public string Title { get; set; }
        public string SubTitle { get; set; }
        public string Content { get; set; }
        public string AuthorName { get; set; }
        public string AuthorBio { get; set; }
        public bool Visible { get; set; }
        public string LinkTo { get; set; }
        public DateTime CreatedOn { get; set; }
        public DateTime ModifiedOn { get; set; }
        public string Permalink { get; set; }
        public string Url { get; set; }
    }
}
