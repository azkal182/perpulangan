"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { admin, useSession } from "@/client/auth";
import { roleOptions, type AppRole } from "@/lib/auth-access";
import {
  buildDummyEmailFromUsername,
  normalizeUsername,
  validateUsername,
} from "@/lib/username-auth";
import {
  Search,
  RefreshCw,
  UserPlus,
  Pencil,
  Shield,
  Ban,
  Key,
  Trash2,
  Users,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getUserAccessOptions,
  getUsersRegionalAccess,
  updateUserRegionalAccess,
  type KorwilAccessOption,
  type KordaAccessOption,
} from "@/features/user-management/actions/user-access.action";

type ManagedUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  username?: string | null;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  createdAt?: string | Date | null;
  korwilId?: string | null;
  korwilName?: string | null;
  kordaId?: string | null;
  kordaName?: string | null;
};

type ScopeDraft = {
  korwilId: string;
  kordaId: string;
};

type ProfileDraft = {
  name: string;
  username: string;
};

function toAppRole(value?: string | null): AppRole {
  if (!value) return "korda";
  if (roleOptions.includes(value as AppRole)) {
    return value as AppRole;
  }
  return "korda";
}

function emptyScope(): ScopeDraft {
  return { korwilId: "", kordaId: "" };
}

function getLoginIdentifier(user: ManagedUser): string {
  return user.username ? `@${user.username}` : "Username belum diatur";
}

export default function UserManagementPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [roleEdits, setRoleEdits] = useState<Record<string, string>>({});
  const [scopeEdits, setScopeEdits] = useState<Record<string, ScopeDraft>>({});
  const [profileEdits, setProfileEdits] = useState<Record<string, ProfileDraft>>(
    {},
  );
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [korwilOptions, setKorwilOptions] = useState<KorwilAccessOption[]>([]);
  const [kordaOptions, setKordaOptions] = useState<KordaAccessOption[]>([]);

  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "korda",
    korwilId: "",
    kordaId: "",
  });

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/sign-in");
    }
  }, [isPending, session, router]);

  const roleValue = useMemo(
    () => (session?.user?.role as AppRole) ?? "korda",
    [session?.user?.role],
  );

  const canList = useMemo(() => {
    if (!session?.user) return false;
    if (roleValue === "korda") return false;
    return admin.checkRolePermission({
      role: roleValue,
      permissions: { user: ["list"] },
    });
  }, [roleValue, session?.user]);

  const canCreate = useMemo(() => {
    if (!session?.user) return false;
    return admin.checkRolePermission({
      role: roleValue,
      permissions: { user: ["create"] },
    });
  }, [roleValue, session?.user]);

  const canSetRole = useMemo(() => {
    if (!session?.user) return false;
    return admin.checkRolePermission({
      role: roleValue,
      permissions: { user: ["set-role"] },
    });
  }, [roleValue, session?.user]);

  const canUpdateUser = useMemo(() => {
    if (!session?.user) return false;
    return admin.checkRolePermission({
      role: roleValue,
      permissions: { user: ["update"] },
    });
  }, [roleValue, session?.user]);

  const canBan = useMemo(() => {
    if (!session?.user) return false;
    return admin.checkRolePermission({
      role: roleValue,
      permissions: { user: ["ban"] },
    });
  }, [roleValue, session?.user]);

  const canDelete = useMemo(() => {
    if (!session?.user) return false;
    return admin.checkRolePermission({
      role: roleValue,
      permissions: { user: ["delete"] },
    });
  }, [roleValue, session?.user]);

  const canSetPassword = useMemo(() => {
    if (!session?.user) return false;
    return admin.checkRolePermission({
      role: roleValue,
      permissions: { user: ["set-password"] },
    });
  }, [roleValue, session?.user]);

  const assignableRoles = useMemo<AppRole[]>(() => {
    if (roleValue === "admin") return [...roleOptions];
    if (roleValue === "korwil") return ["korda"];
    return [];
  }, [roleValue]);

  const assignedKorwilUserMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of allUsers) {
      if (user.korwilId) {
        map.set(user.korwilId, user.id);
      }
    }
    return map;
  }, [allUsers]);

  const assignedKordaUserMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of allUsers) {
      if (user.kordaId) {
        map.set(user.kordaId, user.id);
      }
    }
    return map;
  }, [allUsers]);

  const assignedUsernameUserMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of allUsers) {
      if (user.username) {
        map.set(normalizeUsername(user.username), user.id);
      }
    }
    return map;
  }, [allUsers]);

  function isKorwilTakenByOtherUser(korwilId: string, userId?: string): boolean {
    const assignedUserId = assignedKorwilUserMap.get(korwilId);
    if (!assignedUserId) return false;
    if (userId && assignedUserId === userId) return false;
    return true;
  }

  function isKordaTakenByOtherUser(kordaId: string, userId?: string): boolean {
    const assignedUserId = assignedKordaUserMap.get(kordaId);
    if (!assignedUserId) return false;
    if (userId && assignedUserId === userId) return false;
    return true;
  }

  function isUsernameTakenByOtherUser(
    usernameValue: string,
    userId?: string,
  ): boolean {
    const normalizedUsername = normalizeUsername(usernameValue);
    const assignedUserId = assignedUsernameUserMap.get(normalizedUsername);
    if (!assignedUserId) return false;
    if (userId && assignedUserId === userId) return false;
    return true;
  }

  const loadAccessOptions = useCallback(async () => {
    const res = await getUserAccessOptions();
    if (!res.success) {
      setError(res.error);
      return;
    }
    setKorwilOptions(res.data.korwils);
    setKordaOptions(res.data.kordas);
  }, []);

  const loadUsers = useCallback(async (options?: { preserveError?: boolean }) => {
    if (!canList) return;
    if (!options?.preserveError) {
      setError(null);
    }
    setIsLoading(true);

    const query: Record<string, string | number> = { limit: 500 };

    const res = await admin.listUsers({ query });
    if (res.error) {
      setError(res.error.message || "Failed to load users.");
      setUsers([]);
      setAllUsers([]);
      setTotal(null);
      setIsLoading(false);
      return;
    }

    const baseUsers = (res.data?.users ?? []) as ManagedUser[];
    const accessRes = await getUsersRegionalAccess(baseUsers.map((u) => u.id));
    const accessMap = accessRes.success ? accessRes.data : {};

    const filteredUsers =
      roleValue === "korwil"
        ? baseUsers.filter((u) => Boolean(accessMap[u.id]))
        : baseUsers;

    const merged = filteredUsers.map((u) => ({
      ...u,
      ...(accessMap[u.id] ?? {}),
    }));

    const searchTerm = searchValue.trim().toLowerCase();
    const searchedUsers = searchTerm
      ? merged.filter((user) => {
          const searchableValues = [user.name, user.username, user.email];
          return searchableValues.some(
            (value) =>
              typeof value === "string" &&
              value.toLowerCase().includes(searchTerm),
          );
        })
      : merged;

    const nextRoleEdits: Record<string, string> = {};
    const nextScopeEdits: Record<string, ScopeDraft> = {};
    const nextProfileEdits: Record<string, ProfileDraft> = {};
    for (const user of searchedUsers) {
      nextRoleEdits[user.id] = user.role ?? "korda";
      nextScopeEdits[user.id] = {
        korwilId: user.korwilId ?? "",
        kordaId: user.kordaId ?? "",
      };
      nextProfileEdits[user.id] = {
        name: user.name ?? "",
        username: user.username ?? "",
      };
    }

    setAllUsers(merged);
    setUsers(searchedUsers);
    setTotal(searchTerm ? searchedUsers.length : (res.data?.total ?? null));
    setRoleEdits(nextRoleEdits);
    setScopeEdits(nextScopeEdits);
    setProfileEdits(nextProfileEdits);
    setIsLoading(false);
  }, [canList, searchValue, roleValue]);

  useEffect(() => {
    if (!session?.user || !canList) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadAccessOptions();
      void loadUsers();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [session?.user, canList, loadAccessOptions, loadUsers]);

  function getUserScopeLabel(user: ManagedUser) {
    const role = toAppRole(user.role);
    if (role === "admin") return "Akses: semua wilayah";
    if (role === "korwil") {
      return user.korwilName
        ? `Korwil: ${user.korwilName}`
        : "Korwil: belum diatur";
    }
    return user.kordaName ? `Korda: ${user.kordaName}` : "Korda: belum diatur";
  }

  function getScopeDraftForUser(user: ManagedUser) {
    return scopeEdits[user.id] ?? emptyScope();
  }

  function getProfileDraftForUser(user: ManagedUser): ProfileDraft {
    return (
      profileEdits[user.id] ?? {
        name: user.name ?? "",
        username: user.username ?? "",
      }
    );
  }

  function openEditDialog(user: ManagedUser) {
    setRoleEdits((prev) => ({
      ...prev,
      [user.id]: user.role ?? "korda",
    }));
    setScopeEdits((prev) => ({
      ...prev,
      [user.id]: {
        korwilId: user.korwilId ?? "",
        kordaId: user.kordaId ?? "",
      },
    }));
    setProfileEdits((prev) => ({
      ...prev,
      [user.id]: {
        name: user.name ?? "",
        username: user.username ?? "",
      },
    }));
    setError(null);
    setEditingUserId(user.id);
  }

  function validateScope(role: AppRole, scope: ScopeDraft): string | null {
    if (role === "korwil" && !scope.korwilId) {
      return "Korwil wajib dipilih untuk role korwil.";
    }
    if (role === "korda" && !scope.kordaId) {
      return "Korda wajib dipilih untuk role korda.";
    }
    return null;
  }

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canCreate) return;

    setError(null);
    setIsCreating(true);

    const createRole = toAppRole(createForm.role);
    const normalizedUsername = normalizeUsername(createForm.username);
    const usernameError = validateUsername(normalizedUsername);
    if (usernameError) {
      setError(usernameError);
      setIsCreating(false);
      return;
    }

    if (isUsernameTakenByOtherUser(normalizedUsername)) {
      setError("Username ini sudah digunakan oleh user lain.");
      setIsCreating(false);
      return;
    }

    const validateError = validateScope(createRole, {
      korwilId: createForm.korwilId,
      kordaId: createForm.kordaId,
    });

    if (validateError) {
      setError(validateError);
      setIsCreating(false);
      return;
    }

    if (
      createRole === "korwil" &&
      createForm.korwilId &&
      isKorwilTakenByOtherUser(createForm.korwilId)
    ) {
      setError("Korwil ini sudah terhubung ke user lain.");
      setIsCreating(false);
      return;
    }

    if (
      createRole === "korda" &&
      createForm.kordaId &&
      isKordaTakenByOtherUser(createForm.kordaId)
    ) {
      setError("Korda ini sudah terhubung ke user lain.");
      setIsCreating(false);
      return;
    }

    const res = await admin.createUser({
      name: createForm.name,
      email: buildDummyEmailFromUsername(normalizedUsername),
      password: createForm.password || undefined,
      role: createRole,
      data: {
        username: normalizedUsername,
      },
    });

    if (res.error) {
      setError(res.error.message || "Failed to create user.");
      setIsCreating(false);
      return;
    }

    const createdUserId = res.data?.user?.id;
    if (!createdUserId) {
      setError("User gagal dibuat. ID user tidak ditemukan.");
      setIsCreating(false);
      return;
    }

    const accessRes = await updateUserRegionalAccess({
      userId: createdUserId,
      role: createRole,
      korwilId: createForm.korwilId || null,
      kordaId: createForm.kordaId || null,
    });

    if (!accessRes.success) {
      const rollbackRes = await admin.removeUser({ userId: createdUserId });
      if (rollbackRes.error) {
        setError(
          `Gagal set akses wilayah: ${accessRes.error}. User sudah dibuat, tapi rollback hapus user gagal.`,
        );
      } else {
        setError(
          `Gagal set akses wilayah: ${accessRes.error}. User dibatalkan, silakan coba lagi.`,
        );
      }
      setIsCreating(false);
      await loadUsers({ preserveError: true });
      return;
    }

    setCreateForm({
      name: "",
      username: "",
      password: "",
      role: "korda",
      korwilId: "",
      kordaId: "",
    });
    setDialogOpen(false);
    await loadUsers();
    setIsCreating(false);
  }

  async function handleSaveUser(user: ManagedUser): Promise<boolean> {
    if (!canSetRole && !canUpdateUser) return false;

    const currentRole = toAppRole(user.role);
    const nextRole = toAppRole(roleEdits[user.id] ?? user.role);
    const draft = getScopeDraftForUser(user);
    const profileDraft = getProfileDraftForUser(user);
    const nextName = profileDraft.name.trim();
    const currentName = (user.name ?? "").trim();
    const nextUsername = normalizeUsername(profileDraft.username);
    const currentUsername = normalizeUsername(user.username ?? "");

    const roleChanged = nextRole !== currentRole;
    const scopeChanged =
      (nextRole === "korwil" && draft.korwilId !== (user.korwilId ?? "")) ||
      (nextRole === "korda" && draft.kordaId !== (user.kordaId ?? "")) ||
      (nextRole === "admin" && Boolean(user.korwilId || user.kordaId));

    const profileChanged =
      nextName !== currentName || nextUsername !== currentUsername;
    const roleOrScopeChanged = roleChanged || scopeChanged;

    if (!profileChanged && !roleOrScopeChanged) return false;

    if (profileChanged) {
      if (!canUpdateUser) {
        setError("Anda tidak punya izin untuk update profil user.");
        return false;
      }

      if (!nextName) {
        setError("Nama wajib diisi.");
        return false;
      }

      const usernameError = validateUsername(nextUsername);
      if (usernameError) {
        setError(usernameError);
        return false;
      }

      if (isUsernameTakenByOtherUser(nextUsername, user.id)) {
        setError("Username ini sudah digunakan oleh user lain.");
        return false;
      }
    }

    if (roleOrScopeChanged) {
      if (!canSetRole) {
        setError("Anda tidak punya izin untuk update role user.");
        return false;
      }

      const validateError = validateScope(nextRole, draft);
      if (validateError) {
        setError(validateError);
        return false;
      }

      if (
        nextRole === "korwil" &&
        draft.korwilId &&
        isKorwilTakenByOtherUser(draft.korwilId, user.id)
      ) {
        setError("Korwil ini sudah terhubung ke user lain.");
        return false;
      }

      if (
        nextRole === "korda" &&
        draft.kordaId &&
        isKordaTakenByOtherUser(draft.kordaId, user.id)
      ) {
        setError("Korda ini sudah terhubung ke user lain.");
        return false;
      }
    }

    setSavingUserId(user.id);
    setError(null);

    if (profileChanged) {
      const profileRes = await admin.updateUser({
        userId: user.id,
        data: {
          name: nextName,
          username: nextUsername,
        },
      });

      if (profileRes.error) {
        setError(profileRes.error.message || "Failed to update user profile.");
        setSavingUserId(null);
        return false;
      }
    }

    if (roleChanged) {
      const roleRes = await admin.setRole({ userId: user.id, role: nextRole });
      if (roleRes.error) {
        setError(roleRes.error.message || "Failed to update role.");
        setSavingUserId(null);
        return false;
      }
    }

    if (roleOrScopeChanged) {
      const accessRes = await updateUserRegionalAccess({
        userId: user.id,
        role: nextRole,
        korwilId: draft.korwilId || null,
        kordaId: draft.kordaId || null,
      });

      if (!accessRes.success) {
        setError(accessRes.error || "Failed to update regional access.");
        setSavingUserId(null);
        return false;
      }
    }

    await loadUsers();
    setSavingUserId(null);
    return true;
  }

  async function handleBan(userId: string) {
    if (!canBan) return;
    const banReason = window.prompt("Ban reason (optional)") || undefined;

    setError(null);
    const res = await admin.banUser({ userId, banReason });
    if (res.error) {
      setError(res.error.message || "Failed to ban user.");
    } else {
      await loadUsers();
    }
  }

  async function handleUnban(userId: string) {
    if (!canBan) return;

    setError(null);
    const res = await admin.unbanUser({ userId });
    if (res.error) {
      setError(res.error.message || "Failed to unban user.");
    } else {
      await loadUsers();
    }
  }

  async function handleSetPassword(userId: string) {
    if (!canSetPassword) return;
    const newPassword = window.prompt("New password");
    if (!newPassword) return;

    setError(null);
    const res = await admin.setUserPassword({ userId, newPassword });
    if (res.error) {
      setError(res.error.message || "Failed to set password.");
    }
  }

  async function handleDeleteUser(user: ManagedUser) {
    if (!canDelete) return;

    if (session?.user?.id === user.id) {
      setError("Anda tidak dapat menghapus akun Anda sendiri.");
      return;
    }

    const identity = user.name || user.username || user.email || user.id;
    const confirmed = window.confirm(
      `Hapus user "${identity}"? Tindakan ini tidak bisa dibatalkan.`,
    );
    if (!confirmed) return;

    setError(null);
    setDeletingUserId(user.id);

    const res = await admin.removeUser({ userId: user.id });
    if (res.error) {
      setError(res.error.message || "Failed to delete user.");
      setDeletingUserId(null);
      return;
    }

    if (editingUserId === user.id) {
      setEditingUserId(null);
    }

    await loadUsers();
    setDeletingUserId(null);
  }

  const editingUser = useMemo(() => {
    if (!editingUserId) return null;
    return (
      users.find((user) => user.id === editingUserId) ??
      allUsers.find((user) => user.id === editingUserId) ??
      null
    );
  }, [editingUserId, users, allUsers]);

  const editingRole = editingUser
    ? toAppRole(roleEdits[editingUser.id] ?? editingUser.role)
    : "korda";
  const editingScope = editingUser ? getScopeDraftForUser(editingUser) : emptyScope();
  const editingProfile = editingUser
    ? getProfileDraftForUser(editingUser)
    : { name: "", username: "" };
  const editingRoleOptions = (
    assignableRoles.includes(editingRole)
      ? assignableRoles
      : [editingRole, ...assignableRoles]
  ).filter((role, idx, arr) => arr.indexOf(role) === idx);
  const editingRoleChanged = editingUser
    ? editingRole !== toAppRole(editingUser.role)
    : false;
  const editingProfileChanged = editingUser
    ? editingProfile.name.trim() !== (editingUser.name ?? "").trim() ||
      normalizeUsername(editingProfile.username) !==
        normalizeUsername(editingUser.username ?? "")
    : false;
  const editingScopeChanged = editingUser
    ? (editingRole === "korwil" &&
        editingScope.korwilId !== (editingUser.korwilId ?? "")) ||
      (editingRole === "korda" &&
        editingScope.kordaId !== (editingUser.kordaId ?? "")) ||
      (editingRole === "admin" &&
        Boolean(editingUser.korwilId || editingUser.kordaId))
    : false;
  const editingRoleOrScopeChanged = editingRoleChanged || editingScopeChanged;
  const editingHasChanges = editingProfileChanged || editingRoleOrScopeChanged;
  const canSaveEditingUser =
    (canUpdateUser && editingProfileChanged) ||
    (canSetRole && editingRoleOrScopeChanged);
  const canDeleteEditingUser =
    Boolean(editingUser) &&
    canDelete &&
    session?.user?.id !== editingUser?.id;

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm font-medium text-muted-foreground">
          Redirecting...
        </p>
      </div>
    );
  }

  if (!canList) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
              <div>
                <h2 className="font-semibold text-destructive">Access Denied</h2>
                <p className="mt-1 text-sm text-destructive/80">
                  You do not have permission to view users.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5 ring-1 ring-primary/20">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    User Management
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Manage user roles, access permissions, and credentials
                  </p>
                </div>
              </div>
            </div>
            {canCreate && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Create User
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                      Add a new user account with assigned role and credentials.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={createForm.name}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="John Doe"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={createForm.username}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            username: e.target.value,
                          }))
                        }
                        placeholder="john_doe"
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Email akan dibuat otomatis di backend.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password (Optional)</Label>
                      <Input
                        id="password"
                        type="password"
                        value={createForm.password}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }))
                        }
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={createForm.role}
                        onValueChange={(value) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            role: value,
                            ...(value !== "korwil" ? { korwilId: "" } : {}),
                            ...(value !== "korda" ? { kordaId: "" } : {}),
                          }))
                        }
                      >
                        <SelectTrigger id="role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {assignableRoles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {createForm.role === "korwil" && (
                      <div className="space-y-2">
                        <Label>Akses Korwil</Label>
                        <Select
                          value={createForm.korwilId}
                          onValueChange={(value) =>
                            setCreateForm((prev) => ({ ...prev, korwilId: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih korwil" />
                          </SelectTrigger>
                          <SelectContent>
                            {korwilOptions.map((korwil) => {
                              const isTaken = isKorwilTakenByOtherUser(korwil.id);

                              return (
                                <SelectItem
                                  key={korwil.id}
                                  value={korwil.id}
                                  disabled={isTaken}
                                >
                                  {korwil.name}
                                  {isTaken ? " (sudah dipakai)" : ""}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {createForm.role === "korda" && (
                      <div className="space-y-2">
                        <Label>Akses Korda</Label>
                        <Select
                          value={createForm.kordaId}
                          onValueChange={(value) =>
                            setCreateForm((prev) => ({ ...prev, kordaId: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih korda" />
                          </SelectTrigger>
                          <SelectContent>
                            {kordaOptions.map((korda) => {
                              const isTaken = isKordaTakenByOtherUser(korda.id);

                              return (
                                <SelectItem
                                  key={korda.id}
                                  value={korda.id}
                                  disabled={isTaken}
                                >
                                  {korda.name}
                                  {korda.korwilName ? ` (${korda.korwilName})` : ""}
                                  {isTaken ? " (sudah dipakai)" : ""}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isCreating}
                        className="gap-2"
                      >
                        {isCreating ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4" />
                            Create User
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Total Users
                  </p>
                  <p className="mt-1 text-2xl font-bold">{total ?? "—"}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Your Role
                  </p>
                  <p className="mt-1 text-2xl font-bold capitalize">
                    {roleValue}
                  </p>
                </div>
                <Shield className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Active
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {users.filter((u) => !u.banned).length}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-destructive hover:text-destructive/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="mb-6 rounded-xl border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadUsers()}
                placeholder="Search by name or username..."
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  void loadUsers();
                }}
                disabled={isLoading}
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button
                onClick={() => {
                  void loadUsers();
                }}
                disabled={isLoading}
                variant="outline"
                size="icon"
                title="Refresh"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="border-b p-6">
            <h2 className="text-lg font-semibold">Users</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading
                ? "Loading users..."
                : users.length === 0
                  ? "No users found"
                  : `Showing ${users.length} ${users.length === 1 ? "user" : "users"}`}
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
                <p className="text-sm text-muted-foreground">Loading users...</p>
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                No users found
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Try adjusting your search criteria
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {users.map((user, index) => {
                const userRole = toAppRole(user.role);

                return (
                  <div
                    key={user.id}
                    className="p-6 transition-colors hover:bg-accent/50"
                    style={{
                      animation: `fadeIn 0.3s ease-out ${index * 0.05}s both`,
                    }}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 font-semibold text-primary-foreground">
                            {user.name?.charAt(0).toUpperCase() ||
                              user.username?.charAt(0).toUpperCase() ||
                              "?"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">
                                {user.name || "Untitled"}
                              </h3>
                              {user.banned && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive ring-1 ring-destructive/20">
                                  <Ban className="h-3 w-3" />
                                  Banned
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {getLoginIdentifier(user)}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs font-medium">
                                <Shield className="h-3 w-3" />
                                {userRole}
                              </span>
                              <span className="inline-flex items-center rounded-md border px-2 py-1 text-xs text-muted-foreground">
                                {getUserScopeLabel({
                                  ...user,
                                  role: userRole,
                                })}
                              </span>
                              {user.createdAt && (
                                <span className="text-xs text-muted-foreground">
                                  Joined{" "}
                                  {new Date(user.createdAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {user.banReason && (
                              <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                                <p className="text-xs text-destructive">
                                  <span className="font-medium">Ban reason:</span>{" "}
                                  {user.banReason}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 lg:items-end">
                        {(canSetRole || canUpdateUser) && (
                          <Button
                            onClick={() => openEditDialog(user)}
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={deletingUserId === user.id}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {user.banned ? (
                            <Button
                              onClick={() => handleUnban(user.id)}
                              disabled={!canBan}
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Unban
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleBan(user.id)}
                              disabled={!canBan}
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Ban
                            </Button>
                          )}
                          <Button
                            onClick={() => handleSetPassword(user.id)}
                            disabled={!canSetPassword}
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                          >
                            <Key className="h-3.5 w-3.5" />
                            Set Password
                          </Button>
                          <Button
                            onClick={() => handleDeleteUser(user)}
                            disabled={!canDelete || deletingUserId === user.id}
                            variant="destructive"
                            size="sm"
                            className="gap-1.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {deletingUserId === user.id ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(editingUser)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingUserId(null);
            setError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Ubah profil, role, dan akses wilayah user.
            </DialogDescription>
          </DialogHeader>

          {editingUser && (
            <div className="space-y-4 pt-2">
              {canUpdateUser && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="edit-user-name">Nama</Label>
                    <Input
                      id="edit-user-name"
                      value={editingProfile.name}
                      onChange={(event) =>
                        setProfileEdits((prev) => ({
                          ...prev,
                          [editingUser.id]: {
                            ...editingProfile,
                            name: event.target.value,
                          },
                        }))
                      }
                      placeholder="Nama user"
                      disabled={savingUserId === editingUser.id}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-user-username">Username</Label>
                    <Input
                      id="edit-user-username"
                      value={editingProfile.username}
                      onChange={(event) =>
                        setProfileEdits((prev) => ({
                          ...prev,
                          [editingUser.id]: {
                            ...editingProfile,
                            username: event.target.value,
                          },
                        }))
                      }
                      placeholder="username"
                      autoCapitalize="none"
                      disabled={savingUserId === editingUser.id}
                    />
                    <p className="text-xs text-muted-foreground">
                      Login:{" "}
                      {editingProfile.username.trim()
                        ? `@${normalizeUsername(editingProfile.username)}`
                        : "username belum diatur"}
                    </p>
                  </div>
                </>
              )}

              {canSetRole && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="edit-user-role">Role</Label>
                    <Select
                      value={editingRole}
                      onValueChange={(value) => {
                        const currentScope = getScopeDraftForUser(editingUser);
                        setRoleEdits((prev) => ({
                          ...prev,
                          [editingUser.id]: value,
                        }));
                        setScopeEdits((prev) => ({
                          ...prev,
                          [editingUser.id]: {
                            ...currentScope,
                            ...(value !== "korwil" ? { korwilId: "" } : {}),
                            ...(value !== "korda" ? { kordaId: "" } : {}),
                          },
                        }));
                      }}
                      disabled={savingUserId === editingUser.id}
                    >
                      <SelectTrigger id="edit-user-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {editingRoleOptions.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {editingRole === "korwil" && (
                    <div className="space-y-2">
                      <Label htmlFor="edit-user-korwil">Akses Korwil</Label>
                      <Select
                        value={editingScope.korwilId}
                        onValueChange={(value) =>
                          setScopeEdits((prev) => ({
                            ...prev,
                            [editingUser.id]: { ...editingScope, korwilId: value },
                          }))
                        }
                        disabled={savingUserId === editingUser.id}
                      >
                        <SelectTrigger id="edit-user-korwil">
                          <SelectValue placeholder="Pilih korwil" />
                        </SelectTrigger>
                        <SelectContent>
                          {korwilOptions.map((korwil) => {
                            const isTakenByOther = isKorwilTakenByOtherUser(
                              korwil.id,
                              editingUser.id,
                            );

                            return (
                              <SelectItem
                                key={korwil.id}
                                value={korwil.id}
                                disabled={isTakenByOther}
                              >
                                {korwil.name}
                                {isTakenByOther ? " (sudah dipakai)" : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {editingRole === "korda" && (
                    <div className="space-y-2">
                      <Label htmlFor="edit-user-korda">Akses Korda</Label>
                      <Select
                        value={editingScope.kordaId}
                        onValueChange={(value) =>
                          setScopeEdits((prev) => ({
                            ...prev,
                            [editingUser.id]: { ...editingScope, kordaId: value },
                          }))
                        }
                        disabled={savingUserId === editingUser.id}
                      >
                        <SelectTrigger id="edit-user-korda">
                          <SelectValue placeholder="Pilih korda" />
                        </SelectTrigger>
                        <SelectContent>
                          {kordaOptions.map((korda) => {
                            const isTakenByOther = isKordaTakenByOtherUser(
                              korda.id,
                              editingUser.id,
                            );

                            return (
                              <SelectItem
                                key={korda.id}
                                value={korda.id}
                                disabled={isTakenByOther}
                              >
                                {korda.name}
                                {korda.korwilName ? ` (${korda.korwilName})` : ""}
                                {isTakenByOther ? " (sudah dipakai)" : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void handleDeleteUser(editingUser)}
                  disabled={
                    !canDeleteEditingUser || deletingUserId === editingUser.id
                  }
                  className="gap-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                  {deletingUserId === editingUser.id ? "Deleting..." : "Delete User"}
                </Button>
                <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUserId(null)}
                  disabled={
                    savingUserId === editingUser.id || deletingUserId === editingUser.id
                  }
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    !canSaveEditingUser ||
                    savingUserId === editingUser.id ||
                    deletingUserId === editingUser.id
                  }
                  onClick={async () => {
                    const didSave = await handleSaveUser(editingUser);
                    if (didSave) {
                      setEditingUserId(null);
                    }
                  }}
                >
                  {savingUserId === editingUser.id ? "Saving..." : "Save Changes"}
                </Button>
                </div>
              </div>
              {!editingHasChanges && (
                <p className="text-xs text-muted-foreground">
                  Tidak ada perubahan untuk disimpan.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
