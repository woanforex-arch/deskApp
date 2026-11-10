<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'department_id',
        'branch_id',
        'is_active',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    public function journalEntries(): HasMany
    {
        return $this->hasMany(JournalEntry::class, 'created_by');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function hasRole(string|array $roles): bool
    {
        return in_array($this->role, (array) $roles, true);
    }

    /**
     * Workspace roles with their labels and capabilities. The permission
     * gates (write / approve / admin) are derived from this map.
     *
     * @var array<string, array{label: string, can_write: bool, can_approve: bool, is_admin: bool}>
     */
    public const ROLES = [
        'admin' => ['label' => 'Administrator', 'can_write' => true, 'can_approve' => true, 'is_admin' => true],
        'general_manager' => ['label' => 'General manager', 'can_write' => true, 'can_approve' => true, 'is_admin' => false],
        'approver' => ['label' => 'Approver', 'can_write' => true, 'can_approve' => true, 'is_admin' => false],
        'accountant' => ['label' => 'Accountant', 'can_write' => true, 'can_approve' => false, 'is_admin' => false],
        'cashier' => ['label' => 'Cashier', 'can_write' => true, 'can_approve' => false, 'is_admin' => false],
        'auditor' => ['label' => 'Auditor', 'can_write' => false, 'can_approve' => false, 'is_admin' => false],
        'viewer' => ['label' => 'Viewer', 'can_write' => false, 'can_approve' => false, 'is_admin' => false],
    ];

    /**
     * @return list<string>
     */
    public static function roleKeys(): array
    {
        return array_keys(self::ROLES);
    }

    /**
     * @return array{label: string, can_write: bool, can_approve: bool, is_admin: bool}
     */
    public function roleDefinition(): array
    {
        return self::ROLES[$this->role] ?? self::ROLES['viewer'];
    }

    public function roleLabel(): string
    {
        return $this->roleDefinition()['label'];
    }

    public function canApprove(): bool
    {
        return $this->roleDefinition()['can_approve'];
    }

    public function isAdmin(): bool
    {
        return $this->roleDefinition()['is_admin'];
    }

    public function canWrite(): bool
    {
        return $this->roleDefinition()['can_write'];
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }
}
