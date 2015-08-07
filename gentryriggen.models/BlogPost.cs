using gentryriggen.models.Serializable;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace gentryriggen.models
{
    public class BlogPost : IAutoDates, IPermalink, ISerializable<BlogPost, SerializedBlogPost>, IValidatable
    {
        public int Id { get; set; }
        [Required]
        public string Title { get; set; }
        public string SubTitle { get; set; }
        public string Content { get; set; }
        [Required]
        public virtual User Author { get; set; }
        public bool Visible { get; set; }
        public string LinkTo { get; set; }
        public string VideoLink { get; set; }
        public DateTime CreatedOn { get; set; }
        public DateTime ModifiedOn { get; set; }
        [Required]
        public string Permalink { get; set; }

        public SerializedBlogPost Serialize()
        {
            return new SerializedBlogPost
            {
                Id = this.Id,
                Title = this.Title,
                SubTitle = this.SubTitle,
                Content = this.Content,
                SampleContent = this.Content.Substring(0, 300),
                AuthorName = this.Author.FirstName + " " + this.Author.LastName,
                AuthorBio = this.Author.BioSnippet,
                Visible = this.Visible,
                LinkTo = this.LinkTo,
                VideoLink = this.VideoLink,
                CreatedOn = this.CreatedOn,
                ModifiedOn = this.ModifiedOn,
                Permalink = this.Permalink
            };
        }

        public void DeSerialize(SerializedBlogPost serializedEntity)
        {
            this.Title = serializedEntity.Title;
            this.SubTitle = serializedEntity.SubTitle;
            this.Content = serializedEntity.Content;
            this.Visible = serializedEntity.Visible;
            this.Permalink = serializedEntity.Permalink;
            this.LinkTo = serializedEntity.LinkTo;
            this.VideoLink = serializedEntity.VideoLink;
        }

        public Dictionary<string, string> ModelErrors { get; set; }

        public bool IsValid()
        {
            GetErrors();
            return this.ModelErrors.Count == 0;
        }
        public void GetErrors()
        {
            this.ModelErrors = new Dictionary<string, string>();
            if (String.IsNullOrEmpty(this.Title))
            {
                this.ModelErrors.Add("title", "Title is required");
            }
            if (String.IsNullOrEmpty(this.Permalink))
            {
                this.ModelErrors.Add("permalink", "Permalink is required");
            }
        }


        public string ErrorsToString()
        {
            StringBuilder sb = new StringBuilder();
            sb.Append("{");
            var count = 0;
            foreach (KeyValuePair<string, string> error in this.ModelErrors)
            {
                if (count != 0)
                    sb.Append(", ");
                sb.Append(error.Key).Append(":").Append(error.Value);
                count++;
            }
            sb.Append("}");

            return sb.ToString();
        }
    }
}
