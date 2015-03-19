using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace gentryriggen.models
{
    public interface ISerializable<T, U>
        where T : class
        where U : class
    {
        U Serialize();
        void DeSerialize(U serializedEntity);
    }
}
