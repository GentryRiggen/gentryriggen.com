using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace gentryriggen.models
{
    public interface IValidatable
    {
        [NotMapped]
        Dictionary<string, string> ModelErrors { get; set; }

        bool IsValid();

        void GetErrors();

        string ErrorsToString();
    }
}
