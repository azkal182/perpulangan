"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { admin, useSession } from "@/client/auth";
import { roleOptions, type AppRole } from "@/lib/auth-access";
import {
  Search,
  RefreshCw,
  UserPlus,
  Shield,
  Ban,
  Key,
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

export default function UserManagementPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [roleEdits, setRoleEdits] = useState<Record<string, string>>({});
  const [scopeEdits, setScopeEdits] = useState<Record<string, ScopeDraft>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const [korwilOptions, setKorwilOptions] = useState<KorwilAccessOption[]>([]);
  const [kordaOptions, setKordaOptions] = useState<KordaAccessOption[]>([]);

  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
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

  const canBan = useMemo(() => {
    if (!session?.user) return false;
    return admin.checkRolePermission({
      role: roleValue,
      permissions: { user: ["ban"] },
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

  const loadAccessOptions = useCallback(async () => {
    const res = await getUserAccessOptions();
    if (!res.success) {
      setError(res.error);
      return;
    }
    setKorwilOptions(res.data.korwils);
    setKordaOptions(res.data.kordas);
  }, []);

  const loadUsers = useCallback(async () => {
    if (!canList) return;
    setError(null);
    setIsLoading(true);

    const query: Record<string, string | number> = { limit: 50 };
    if (searchValue.trim()) query.searchValue = searchValue.trim();

    const res = await admin.listUsers({ query });
    if (res.error) {
      setError(res.error.message || "Failed to load users.");
      setUsers([]);
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

    const nextRoleEdits: Record<string, string> = {};
    const nextScopeEdits: Record<string, ScopeDraft> = {};
    for (const user of merged) {
      nextRoleEdits[user.id] = user.role ?? "korda";
      nextScopeEdits[user.id] = {
        korwilId: user.korwilId ?? "",
        kordaId: user.kordaId ?? "",
      };
    }

    setUsers(merged);
    setTotal(res.data?.total ?? null);
    setRoleEdits(nextRoleEdits);
    setScopeEdits(nextScopeEdits);
    setIsLoading(false);
  }, [canList, searchValue, roleValue]);

  useEffect(() => {
    if (session?.user && canList) {
      void loadAccessOptions();
      void loadUsers();
    }
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
    const validateError = validateScope(createRole, {
      korwilId: createForm.korwilId,
      kordaId: createForm.kordaId,
    });

    if (validateError) {
      setError(validateError);
      setIsCreating(false);
      return;
    }

    const res = await admin.createUser({
      name: createForm.name,
      email: createForm.email,
      password: createForm.password || undefined,
      role: createRole,
    });

    if (res.error) {
      setError(res.error.message || "Failed to create user.");
      setIsCreating(false);
      return;
    }

    const createdUserId = res.data?.user?.id;
    if (createdUserId) {
      const accessRes = await updateUserRegionalAccess({
        userId: createdUserId,
        role: createRole,
        korwilId: createForm.korwilId || null,
        kordaId: createForm.kordaId || null,
      });

      if (!accessRes.success) {
        setError(
          `User berhasil dibuat, tetapi set akses wilayah gagal: ${accessRes.error}`,
        );
      }
    }

    setCreateForm({
      name: "",
      email: "",
      password: "",
      role: "korda",
      korwilId: "",
      kordaId: "",
    });
    setDialogOpen(false);
    await loadUsers();
    setIsCreating(false);
  }

  async function handleSaveUser(user: ManagedUser) {
    if (!canSetRole) return;

    const nextRole = toAppRole(roleEdits[user.id] ?? user.role);
    const draft = getScopeDraftForUser(user);

    const validateError = validateScope(nextRole, draft);
    if (validateError) {
      setError(validateError);
      return;
    }

    setSavingUserId(user.id);
    setError(null);

    if (nextRole !== toAppRole(user.role)) {
      const roleRes = await admin.setRole({ userId: user.id, role: nextRole });
      if (roleRes.error) {
        setError(roleRes.error.message || "Failed to update role.");
        setSavingUserId(null);
        return;
      }
    }

    const accessRes = await updateUserRegionalAccess({
      userId: user.id,
      role: nextRole,
      korwilId: draft.korwilId || null,
      kordaId: draft.kordaId || null,
    });

    if (!accessRes.success) {
      setError(accessRes.error || "Failed to update regional access.");
      setSavingUserId(null);
      return;
    }

    await loadUsers();
    setSavingUserId(null);
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
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={createForm.email}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        placeholder="john@example.com"
                        required
                      />
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
                            {korwilOptions.map((korwil) => (
                              <SelectItem key={korwil.id} value={korwil.id}>
                                {korwil.name}
                              </SelectItem>
                            ))}
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
                            {kordaOptions.map((korda) => (
                              <SelectItem key={korda.id} value={korda.id}>
                                {korda.name}
                                {korda.korwilName ? ` (${korda.korwilName})` : ""}
                              </SelectItem>
                            ))}
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
                placeholder="Search by name or email..."
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={loadUsers} disabled={isLoading} className="gap-2">
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button
                onClick={loadUsers}
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
                const selectedRole = toAppRole(roleEdits[user.id] ?? user.role);
                const draft = getScopeDraftForUser(user);
                const rowRoleOptions = (
                  assignableRoles.includes(selectedRole)
                    ? assignableRoles
                    : [selectedRole, ...assignableRoles]
                ).filter((role, idx, arr) => arr.indexOf(role) === idx);

                const roleChanged = selectedRole !== toAppRole(user.role);
                const scopeChanged =
                  (selectedRole === "korwil" &&
                    draft.korwilId !== (user.korwilId ?? "")) ||
                  (selectedRole === "korda" &&
                    draft.kordaId !== (user.kordaId ?? "")) ||
                  (selectedRole === "admin" &&
                    Boolean(user.korwilId || user.kordaId));

                const hasChanges = roleChanged || scopeChanged;

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
                            {user.name?.charAt(0).toUpperCase() || "?"}
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
                              {user.email}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs font-medium">
                                <Shield className="h-3 w-3" />
                                {selectedRole}
                              </span>
                              <span className="inline-flex items-center rounded-md border px-2 py-1 text-xs text-muted-foreground">
                                {getUserScopeLabel({
                                  ...user,
                                  role: selectedRole,
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
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={selectedRole}
                            onValueChange={(value) =>
                              setRoleEdits((prev) => ({
                                ...prev,
                                [user.id]: value,
                              }))
                            }
                            disabled={!canSetRole}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {rowRoleOptions.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {selectedRole === "korwil" && (
                            <Select
                              value={draft.korwilId}
                              onValueChange={(value) =>
                                setScopeEdits((prev) => ({
                                  ...prev,
                                  [user.id]: { ...draft, korwilId: value },
                                }))
                              }
                              disabled={!canSetRole}
                            >
                              <SelectTrigger className="w-[220px]">
                                <SelectValue placeholder="Pilih korwil" />
                              </SelectTrigger>
                              <SelectContent>
                                {korwilOptions.map((korwil) => (
                                  <SelectItem key={korwil.id} value={korwil.id}>
                                    {korwil.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          {selectedRole === "korda" && (
                            <Select
                              value={draft.kordaId}
                              onValueChange={(value) =>
                                setScopeEdits((prev) => ({
                                  ...prev,
                                  [user.id]: { ...draft, kordaId: value },
                                }))
                              }
                              disabled={!canSetRole}
                            >
                              <SelectTrigger className="w-[260px]">
                                <SelectValue placeholder="Pilih korda" />
                              </SelectTrigger>
                              <SelectContent>
                                {kordaOptions.map((korda) => (
                                  <SelectItem key={korda.id} value={korda.id}>
                                    {korda.name}
                                    {korda.korwilName
                                      ? ` (${korda.korwilName})`
                                      : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          {hasChanges && (
                            <Button
                              onClick={() => handleSaveUser(user)}
                              disabled={!canSetRole || savingUserId === user.id}
                              size="sm"
                            >
                              {savingUserId === user.id ? "Saving..." : "Save"}
                            </Button>
                          )}
                        </div>
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
