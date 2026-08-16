using Anh.Vip.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Anh.Vip.Infrastructure;

/// <summary>
/// Contexto EF Core mapeado al esquema [vip] de SQL Server (migration/sqlserver).
/// Las tablas y columnas se declaran con anotaciones en las entidades; aquí se
/// configuran claves compuestas, relaciones e índices que no van por convención.
/// </summary>
public class VipDbContext(DbContextOptions<VipDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Notebook> Notebooks => Set<Notebook>();
    public DbSet<Upload> Uploads => Set<Upload>();
    public DbSet<Well> Wells => Set<Well>();
    public DbSet<ValidationIssue> ValidationIssues => Set<ValidationIssue>();
    public DbSet<NotebookEvent> NotebookEvents => Set<NotebookEvent>();
    public DbSet<CatDepartamento> CatDepartamentos => Set<CatDepartamento>();
    public DbSet<CatMunicipio> CatMunicipios => Set<CatMunicipio>();
    public DbSet<CatListaValor> CatListaValores => Set<CatListaValor>();

    /// <summary>
    /// Longitud por defecto de las columnas de texto (indexables en SQL Server).
    /// Las columnas más largas o ilimitadas se ajustan en OnModelCreating.
    /// </summary>
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<string>().HaveMaxLength(300);
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        // Columnas de texto largas o sin límite (no indexadas).
        b.Entity<User>().Property(u => u.PasswordHash).HasMaxLength(512);
        b.Entity<Upload>().Property(u => u.Filename).HasMaxLength(400);
        b.Entity<ValidationIssue>().Property(i => i.Message).HasMaxLength(1000);
        b.Entity<NotebookEvent>().Property(e => e.Message).HasMaxLength(1000);
        b.Entity<AuditLog>().Property(a => a.BeforeJson).HasColumnType("nvarchar(max)");
        b.Entity<AuditLog>().Property(a => a.AfterJson).HasColumnType("nvarchar(max)");
        b.Entity<NotebookEvent>().Property(e => e.MetadataJson).HasColumnType("nvarchar(max)");

        b.Entity<User>().HasIndex(u => u.Email).IsUnique();

        b.Entity<Upload>()
            .HasOne(u => u.Notebook)
            .WithMany(n => n.Uploads)
            .HasForeignKey(u => u.NotebookId)
            .OnDelete(DeleteBehavior.NoAction);

        // notebooks -> uploads (versión activa / enviada): sin cascada (FK circular).
        b.Entity<Notebook>()
            .HasOne<Upload>()
            .WithMany()
            .HasForeignKey(n => n.ActiveVersionId)
            .OnDelete(DeleteBehavior.NoAction);
        b.Entity<Notebook>()
            .HasOne<Upload>()
            .WithMany()
            .HasForeignKey(n => n.SubmittedVersionId)
            .OnDelete(DeleteBehavior.NoAction);

        b.Entity<Well>()
            .HasOne(w => w.Upload)
            .WithMany(u => u.Wells)
            .HasForeignKey(w => w.UploadId)
            .OnDelete(DeleteBehavior.NoAction);

        b.Entity<ValidationIssue>()
            .HasOne(i => i.Well)
            .WithMany(w => w.Issues)
            .HasForeignKey(i => i.WellId)
            .OnDelete(DeleteBehavior.NoAction);

        b.Entity<NotebookEvent>()
            .HasOne(e => e.Notebook)
            .WithMany(n => n.Events)
            .HasForeignKey(e => e.NotebookId)
            .OnDelete(DeleteBehavior.NoAction);

        // Catálogos
        b.Entity<CatMunicipio>()
            .HasOne(m => m.Departamento)
            .WithMany(d => d.Municipios)
            .HasForeignKey(m => m.CodigoDaneDepto)
            .OnDelete(DeleteBehavior.NoAction);

        b.Entity<CatListaValor>().HasKey(c => new { c.Catalogo, c.Valor });
        b.Entity<CatListaValor>().HasIndex(c => c.Catalogo);
    }
}
