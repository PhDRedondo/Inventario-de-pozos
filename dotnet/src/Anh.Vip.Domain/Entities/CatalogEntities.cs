using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Anh.Vip.Domain.Entities;

[Table("cat_departamento", Schema = "vip")]
public class CatDepartamento
{
    [Key, Column("codigo_dane")] public string CodigoDane { get; set; } = "";
    [Column("nombre")] public string Nombre { get; set; } = "";

    public ICollection<CatMunicipio> Municipios { get; set; } = new List<CatMunicipio>();
}

[Table("cat_municipio", Schema = "vip")]
public class CatMunicipio
{
    [Key, Column("codigo_dane")] public string CodigoDane { get; set; } = "";
    [Column("nombre")] public string Nombre { get; set; } = "";
    [Column("codigo_dane_depto")] public string CodigoDaneDepto { get; set; } = "";

    public CatDepartamento? Departamento { get; set; }
}

/// <summary>
/// Catálogo de lista simple. La columna <c>Catalogo</c> identifica el conjunto
/// (operadoras, contratos, estado_pozo, ...) igual que las llaves de seed.json.
/// Clave compuesta (Catalogo, Valor) configurada en el DbContext.
/// </summary>
[Table("cat_lista_valor", Schema = "vip")]
public class CatListaValor
{
    [Column("catalogo")] public string Catalogo { get; set; } = "";
    [Column("valor")] public string Valor { get; set; } = "";
    [Column("orden")] public int Orden { get; set; }
}
