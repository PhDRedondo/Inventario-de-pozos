using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Anh.Vip.Domain.Entities;

[Table("users", Schema = "vip")]
public class User
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("email")] public string Email { get; set; } = "";
    [Column("username")] public string Username { get; set; } = "";
    [Column("role")] public string Role { get; set; } = "";
    [Column("operadora")] public string? Operadora { get; set; }
    [Column("password_hash")] public string PasswordHash { get; set; } = "";
    [Column("display_name")] public string? DisplayName { get; set; }
    [Column("active")] public bool Active { get; set; } = true;
    [Column("created_by")] public string? CreatedBy { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; }
    [Column("updated_at")] public DateTime UpdatedAt { get; set; }
}

[Table("audit_log", Schema = "vip")]
public class AuditLog
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("actor_email")] public string ActorEmail { get; set; } = "";
    [Column("action")] public string Action { get; set; } = "";
    [Column("entity_type")] public string EntityType { get; set; } = "";
    [Column("entity_id")] public int? EntityId { get; set; }
    [Column("before_json")] public string? BeforeJson { get; set; }
    [Column("after_json")] public string? AfterJson { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; }
}
