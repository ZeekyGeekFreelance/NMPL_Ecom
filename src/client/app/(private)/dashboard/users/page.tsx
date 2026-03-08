"use client";
import Table from "@/app/components/layout/Table";
import {
  useGetAllUsersQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useUpdateBillingSupervisorMutation,
  useUpdateAdminPasswordMutation,
} from "@/app/store/apis/UserApi";
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Building2,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  Crown,
  Shield,
  BadgeCheck,
  KeyRound,
  Eye,
  EyeOff,
  ChevronDown,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import useToast from "@/app/hooks/ui/useToast";
import { useForm } from "react-hook-form";
import UserForm, { UserFormData } from "./UserForm";
import ConfirmModal from "@/app/components/organisms/ConfirmModal";
import Modal from "@/app/components/organisms/Modal";
import { usePathname } from "next/navigation";
import ToggleableText from "@/app/components/atoms/ToggleableText";
import { withAuth } from "@/app/components/HOC/WithAuth";
import PermissionGuard from "@/app/components/auth/PermissionGuard";
import RoleHierarchyGuard from "@/app/components/auth/RoleHierarchyGuard";
import AdminActionGuard from "@/app/components/auth/AdminActionGuard";
import { toAccountReference } from "@/app/lib/utils/accountReference";
import formatDate from "@/app/utils/formatDate";
import { getRoleBadgeClass, resolveDisplayRole } from "@/app/lib/userRole";
import { validatePasswordPolicy } from "@/app/lib/validators/common";

type UserDirectoryFilter =
  | "ALL"
  | "EMPLOYEES"
  | "CUSTOMERS"
  | "DEALERS"
  | "BILLING_TEAM";

type PendingBillingChange = {
  id: string;
  isBillingSupervisor: boolean;
  accountRef: string;
};

type PendingRoleChange = {
  data: UserFormData;
  previousRole: string;
};

type PendingDeleteTarget = {
  id: string | number;
  name: string;
  displayRole: string;
  isBillingSupervisor: boolean;
  accountRef: string;
};

const UsersDashboard = () => {
  const { showToast } = useToast();
  const pathname = usePathname();

  const shouldFetchUsers = pathname === "/dashboard/users";

  const { data, isLoading, error, refetch } = useGetAllUsersQuery(undefined, {
    skip: !shouldFetchUsers,
    refetchOnFocus: true,
    refetchOnReconnect: true,
    pollingInterval: 7000,
  });

  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();
  const [updateBillingSupervisor, { isLoading: isUpdatingBillingSupervisor }] =
    useUpdateBillingSupervisorMutation();
  const [updateAdminPassword, { isLoading: isUpdatingAdminPassword }] =
    useUpdateAdminPasswordMutation();
  const users = data?.users || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isEmployeeDeleteConfirmOpen, setIsEmployeeDeleteConfirmOpen] =
    useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [directoryFilter, setDirectoryFilter] = useState<UserDirectoryFilter>("ALL");
  const [userToDelete, setUserToDelete] = useState<string | number | null>(
    null
  );
  const [pendingDeleteTarget, setPendingDeleteTarget] =
    useState<PendingDeleteTarget | null>(null);
  const [passwordTargetUser, setPasswordTargetUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordSubmitAttempted, setPasswordSubmitAttempted] = useState(false);
  const [passwordFieldTouched, setPasswordFieldTouched] = useState<{
    password: boolean;
    confirmPassword: boolean;
  }>({
    password: false,
    confirmPassword: false,
  });
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showAdminConfirmPassword, setShowAdminConfirmPassword] = useState(false);
  const [billingActionUserId, setBillingActionUserId] = useState<
    string | number | null
  >(null);
  const [openBillingMenuUserId, setOpenBillingMenuUserId] = useState<
    string | number | null
  >(null);
  const billingMenuRef = useRef<HTMLDivElement | null>(null);
  const [editingOriginalRole, setEditingOriginalRole] = useState<string | null>(
    null
  );
  const [isBillingConfirmOpen, setIsBillingConfirmOpen] = useState(false);
  const [pendingBillingChange, setPendingBillingChange] =
    useState<PendingBillingChange | null>(null);
  const [isRoleConfirmOpen, setIsRoleConfirmOpen] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] =
    useState<PendingRoleChange | null>(null);
  const normalizedNewPassword = newPassword.trim();
  const normalizedConfirmPassword = confirmNewPassword.trim();
  const passwordPolicyResult = normalizedNewPassword
    ? validatePasswordPolicy(normalizedNewPassword)
    : "Password is required.";
  const passwordPolicyError =
    passwordPolicyResult === true ? null : passwordPolicyResult;
  const confirmPasswordError = !normalizedConfirmPassword
    ? "Confirm password is required."
    : normalizedConfirmPassword !== normalizedNewPassword
    ? "Confirm password does not match."
    : null;
  const showPasswordPolicyError =
    passwordPolicyError &&
    (passwordSubmitAttempted ||
      passwordFieldTouched.password ||
      normalizedNewPassword.length > 0);
  const showConfirmPasswordError =
    confirmPasswordError &&
    (passwordSubmitAttempted ||
      passwordFieldTouched.confirmPassword ||
      normalizedConfirmPassword.length > 0);

  useEffect(() => {
    if (!openBillingMenuUserId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        billingMenuRef.current &&
        !billingMenuRef.current.contains(event.target as Node)
      ) {
        setOpenBillingMenuUserId(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [openBillingMenuUserId]);

  const form = useForm<UserFormData>({
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      id: "",
      name: "",
      email: "",
      role: "USER",
    },
  });

  // Get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case "SUPERADMIN":
        return <Crown className="w-4 h-4" />;
      case "ADMIN":
        return <Shield className="w-4 h-4" />;
      case "DEALER":
        return <Building2 className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const getDirectoryAffiliation = (
    row: any
  ): "EMPLOYEE" | "CUSTOMER" | "DEALER" => {
    const displayRole = resolveDisplayRole(row);
    if (displayRole === "ADMIN" || displayRole === "SUPERADMIN") {
      return "EMPLOYEE";
    }
    if (displayRole === "DEALER") {
      return "DEALER";
    }
    return "CUSTOMER";
  };

  const directoryFilterCounts = users.reduce(
    (acc, user) => {
      const affiliation = getDirectoryAffiliation(user);
      acc.ALL += 1;
      if (affiliation === "EMPLOYEE") acc.EMPLOYEES += 1;
      if (affiliation === "CUSTOMER") acc.CUSTOMERS += 1;
      if (affiliation === "DEALER") acc.DEALERS += 1;
      if (
        resolveDisplayRole(user) === "ADMIN" &&
        user?.isBillingSupervisor === true
      ) {
        acc.BILLING_TEAM += 1;
      }
      return acc;
    },
    {
      ALL: 0,
      EMPLOYEES: 0,
      CUSTOMERS: 0,
      DEALERS: 0,
      BILLING_TEAM: 0,
    } as Record<UserDirectoryFilter, number>
  );

  const filteredUsers = users.filter((user) => {
    if (directoryFilter === "ALL") return true;
    if (directoryFilter === "BILLING_TEAM") {
      return (
        resolveDisplayRole(user) === "ADMIN" &&
        user?.isBillingSupervisor === true
      );
    }
    if (directoryFilter === "EMPLOYEES")
      return getDirectoryAffiliation(user) === "EMPLOYEE";
    if (directoryFilter === "CUSTOMERS")
      return getDirectoryAffiliation(user) === "CUSTOMER";
    if (directoryFilter === "DEALERS")
      return getDirectoryAffiliation(user) === "DEALER";
    return true;
  });

  const columns = [
    {
      key: "id",
      label: "Account Ref",
      sortable: true,
      searchAccessor: (row: any) =>
        row?.accountReference || toAccountReference(row?.id || ""),
      render: (row: any) => (
        <span className="text-sm text-gray-600 font-mono">
          <ToggleableText
            content={row?.accountReference || toAccountReference(row?.id || "")}
            truncateLength={12}
          />
        </span>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row: any) => (
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-800">{row.name}</span>
        </div>
      ),
      sortable: true,
    },
    {
      key: "email",
      label: "Email",
      render: (row: any) => (
        <a
          href={`mailto:${row.email}`}
          className="text-sm text-blue-600 hover:underline"
        >
          {row.email}
        </a>
      ),
      sortable: true,
    },
    {
      key: "phone",
      label: "Phone",
      render: (row: any) => (
        <span className="text-sm text-gray-700">{row?.phone || "Not provided"}</span>
      ),
      sortable: true,
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      searchAccessor: (row: any) => resolveDisplayRole(row),
      sortAccessor: (row: any) => resolveDisplayRole(row),
      render: (row: any) => {
        const displayRole = resolveDisplayRole(row);
        return (
          <div className="flex items-center space-x-2">
            {getRoleIcon(displayRole)}
          <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeClass(
                displayRole
              )}`}
          >
              {displayRole}
          </span>
          </div>
        );
      },
    },
    {
      key: "affiliation",
      label: "Directory",
      sortable: true,
      searchAccessor: (row: any) => getDirectoryAffiliation(row),
      sortAccessor: (row: any) => getDirectoryAffiliation(row),
      render: (row: any) => {
        const affiliation = getDirectoryAffiliation(row);
        const styleByAffiliation: Record<string, string> = {
          EMPLOYEE: "bg-indigo-100 text-indigo-800 border-indigo-200",
          CUSTOMER: "bg-sky-100 text-sky-800 border-sky-200",
          DEALER: "bg-emerald-100 text-emerald-800 border-emerald-200",
        };
        return (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styleByAffiliation[affiliation]}`}
          >
            {affiliation}
          </span>
        );
      },
    },
    {
      key: "isBillingSupervisor",
      label: "Billing Team",
      sortable: true,
      searchAccessor: (row: any) =>
        row?.isBillingSupervisor ? "BILLING_SUPERVISOR" : "STANDARD",
      sortAccessor: (row: any) => (row?.isBillingSupervisor ? 1 : 0),
      render: (row: any) => {
        const isAdmin = resolveDisplayRole(row) === "ADMIN";
        if (isAdmin && row?.isBillingSupervisor) {
          return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            <BadgeCheck className="h-3.5 w-3.5" />
            Billing Supervisor
          </span>
          );
        }
        if (isAdmin) {
          return <span className="text-xs text-gray-500">Not Assigned</span>;
        }
        return <span className="text-xs text-gray-400">N/A</span>;
      },
    },

    {
      key: "createdAt",
      label: "Created",
      sortable: true,
      render: (row: any) => (
        <span className="text-sm text-gray-600">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: "updatedAt",
      label: "Updated",
      sortable: true,
      render: (row: any) => (
        <span className="text-sm text-gray-600">
          {formatDate(row.updatedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: any) => {
        const displayRole = resolveDisplayRole(row);
        const isAdmin = displayRole === "ADMIN";
        const isInternalAccount =
          displayRole === "ADMIN" || displayRole === "SUPERADMIN";
        const isBillingUpdateBusy =
          isUpdatingBillingSupervisor &&
          String(billingActionUserId) === String(row.id);

        return (
        <div className="flex items-center gap-2">
                    {isAdmin && (
            <AdminActionGuard action="create_admin" showFallback={false}>
              <div
                className="relative"
                ref={
                  openBillingMenuUserId === row.id ? billingMenuRef : undefined
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenBillingMenuUserId((previous) =>
                      previous === row.id ? null : row.id
                    )
                  }
                  disabled={isBillingUpdateBusy}
                  className={`inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    row?.isBillingSupervisor
                      ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {isBillingUpdateBusy ? (
                    <Loader2 size={14} className="mr-1 animate-spin" />
                  ) : row?.isBillingSupervisor ? (
                    <ShieldCheck size={14} className="mr-1" />
                  ) : (
                    <ShieldOff size={14} className="mr-1" />
                  )}
                  Billing Admin
                  <ChevronDown size={13} className="ml-1" />
                </button>

                {openBillingMenuUserId === row.id ? (
                  <div className="absolute right-0 z-20 mt-1 min-w-[180px] rounded-md border border-gray-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenBillingMenuUserId(null);
                        setPendingBillingChange({
                          id: String(row.id),
                          isBillingSupervisor: !row?.isBillingSupervisor,
                          accountRef:
                            row?.accountReference ||
                            toAccountReference(row.id || ""),
                        });
                        setIsBillingConfirmOpen(true);
                      }}
                      className={`flex w-full items-center rounded px-2 py-1.5 text-left text-xs font-medium ${
                        row?.isBillingSupervisor
                          ? "text-red-700 hover:bg-red-50"
                          : "text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      {row?.isBillingSupervisor ? (
                        <ShieldOff size={14} className="mr-2" />
                      ) : (
                        <ShieldCheck size={14} className="mr-2" />
                      )}
                      {row?.isBillingSupervisor
                        ? "Remove as Billing-Admin"
                        : "Assign as Billing-Admin"}
                    </button>
                  </div>
                ) : null}
              </div>
            </AdminActionGuard>
          )}

          {isAdmin && (
            <AdminActionGuard action="create_admin" showFallback={false}>
              <button
                type="button"
                onClick={() => {
                  setPasswordTargetUser(row);
                  setNewPassword("");
                  setConfirmNewPassword("");
                  setPasswordSubmitAttempted(false);
                  setPasswordFieldTouched({
                    password: false,
                    confirmPassword: false,
                  });
                  setShowAdminPassword(false);
                  setShowAdminConfirmPassword(false);
                  setIsPasswordModalOpen(true);
                }}
                className="inline-flex h-8 items-center rounded-md border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                <KeyRound size={14} className="mr-1" />
                Change Password
              </button>
            </AdminActionGuard>
          )}

          {isInternalAccount ? (
            <RoleHierarchyGuard
              targetUserRole={displayRole}
              targetUserId={row.id}
              showFallback={false}
            >
              <AdminActionGuard action="update_user" showFallback={false}>
                <button
                  type="button"
                  onClick={() => {
                    form.reset({
                      id: row.id,
                      name: row.name || "",
                      email: row.email || "",
                      role: row.role || "USER",
                    });
                    void form.trigger();
                    setEditingOriginalRole(String(row.role || "").toUpperCase());
                    setEditingUser(row);
                    setIsModalOpen(true);
                  }}
                  className="inline-flex h-8 items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  aria-label="Edit employee"
                >
                  <Pencil size={14} className="mr-1" />
                  Edit
                </button>
              </AdminActionGuard>
            </RoleHierarchyGuard>
          ) : null}

          <RoleHierarchyGuard
            targetUserRole={displayRole}
            targetUserId={row.id}
            showFallback={false}
          >
            <AdminActionGuard action="delete_user" showFallback={false}>
              <button
                type="button"
                onClick={() => {
                  setUserToDelete(row.id);
                  setPendingDeleteTarget({
                    id: row.id,
                    name: row.name || "this employee",
                    displayRole,
                    isBillingSupervisor: Boolean(row?.isBillingSupervisor),
                    accountRef:
                      row?.accountReference || toAccountReference(row.id || ""),
                  });
                  setIsConfirmModalOpen(true);
                }}
                className="inline-flex h-8 items-center rounded-md border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                disabled={isDeleting}
                aria-label="Delete user"
              >
                {isDeleting && userToDelete === row.id ? (
                  <>
                    <Loader2 size={14} className="mr-1 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} className="mr-1" />
                    Delete
                  </>
                )}
              </button>
            </AdminActionGuard>
          </RoleHierarchyGuard>
        </div>
      )},
    },
  ];

  const closeEditModal = () => {
    setIsModalOpen(false);
    setEditingOriginalRole(null);
    setEditingUser(null);
  };

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setPasswordTargetUser(null);
    setNewPassword("");
    setConfirmNewPassword("");
    setPasswordSubmitAttempted(false);
    setPasswordFieldTouched({
      password: false,
      confirmPassword: false,
    });
    setShowAdminPassword(false);
    setShowAdminConfirmPassword(false);
  };

  const executeUserUpdate = async (data: UserFormData) => {
    try {
      const payload: Partial<UserFormData> = {
        role: data.role,
      };

      await updateUser({ id: String(data.id), data: payload }).unwrap();
      closeEditModal();
      showToast("User updated successfully", "success");
    } catch (err: any) {
      console.error("Failed to update user:", err);
      const errorMessage = err?.data?.message || "Failed to update user";
      showToast(errorMessage, "error");
    }
  };

  const handleEditSubmit = async (data: UserFormData) => {
    const previousRole = String(editingOriginalRole || "").toUpperCase();
    const nextRole = String(data.role || "").toUpperCase();
    const isRoleChanged =
      previousRole !== "" && nextRole !== "" && previousRole !== nextRole;

    if (isRoleChanged) {
      setPendingRoleChange({
        data,
        previousRole,
      });
      setIsRoleConfirmOpen(true);
      return;
    }

    await executeUserUpdate(data);
  };

  const handleConfirmRoleChange = async () => {
    if (!pendingRoleChange) {
      setIsRoleConfirmOpen(false);
      return;
    }

    try {
      await executeUserUpdate(pendingRoleChange.data);
    } finally {
      setPendingRoleChange(null);
      setIsRoleConfirmOpen(false);
    }
  };

  const handleConfirmBillingChange = async () => {
    if (!pendingBillingChange) {
      setIsBillingConfirmOpen(false);
      return;
    }

    try {
      setBillingActionUserId(pendingBillingChange.id);
      await updateBillingSupervisor({
        id: pendingBillingChange.id,
        isBillingSupervisor: pendingBillingChange.isBillingSupervisor,
      }).unwrap();
      showToast(
        pendingBillingChange.isBillingSupervisor
          ? "Billing assigned successfully"
          : "Billing responsibility removed",
        "success"
      );
    } catch (err: any) {
      const errorMessage =
        err?.data?.message || "Failed to update billing assignment";
      showToast(errorMessage, "error");
    } finally {
      setBillingActionUserId(null);
      setPendingBillingChange(null);
      setIsBillingConfirmOpen(false);
    }
  };

  const handleAdminPasswordSubmit = async () => {
    if (!passwordTargetUser?.id) {
      return;
    }

    setPasswordSubmitAttempted(true);
    if (passwordPolicyError) {
      showToast(passwordPolicyError, "error");
      return;
    }

    if (confirmPasswordError) {
      showToast(confirmPasswordError, "error");
      return;
    }

    try {
      await updateAdminPassword({
        id: String(passwordTargetUser.id),
        newPassword: normalizedNewPassword,
      }).unwrap();
      closePasswordModal();
      showToast("Admin password updated and all active sessions logged out", "success");
    } catch (err: any) {
      const errorMessage =
        err?.data?.message || "Failed to update admin password";
      showToast(errorMessage, "error");
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      await deleteUser(userToDelete).unwrap();
      setIsConfirmModalOpen(false);
      setIsEmployeeDeleteConfirmOpen(false);
      setPendingDeleteTarget(null);
      setUserToDelete(null);
      showToast("User deleted successfully", "success");
    } catch (err: any) {
      console.error("Failed to delete user:", err);
      const errorMessage = err?.data?.message || "Failed to delete user";
      showToast(errorMessage, "error");
    }
  };

  const requiresEmployeeDoubleDeleteConfirm = Boolean(
    pendingDeleteTarget &&
      (pendingDeleteTarget.displayRole === "ADMIN" ||
        pendingDeleteTarget.displayRole === "SUPERADMIN" ||
        pendingDeleteTarget.isBillingSupervisor)
  );

  const clearDeleteState = () => {
    if (isDeleting) {
      return;
    }
    setIsConfirmModalOpen(false);
    setIsEmployeeDeleteConfirmOpen(false);
    setPendingDeleteTarget(null);
    setUserToDelete(null);
  };

  const handleInitialDeleteConfirm = async () => {
    if (requiresEmployeeDoubleDeleteConfirm) {
      setIsConfirmModalOpen(false);
      setIsEmployeeDeleteConfirmOpen(true);
      return;
    }
    await handleDelete();
  };

  return (
    <PermissionGuard allowedRoles={["SUPERADMIN"]}>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <Users className="h-8 w-8 text-blue-600" />
              <h1 className="type-h2 text-gray-800">
                Users Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                {filteredUsers.length}{" "}
                {filteredUsers.length === 1 ? "entry" : "entries"} shown
              </div>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            {(
              [
                ["ALL", "All"],
                ["EMPLOYEES", "Employees"],
                ["CUSTOMERS", "Customers"],
                ["DEALERS", "Dealers"],
                ["BILLING_TEAM", "Billing Team"],
              ] as Array<[UserDirectoryFilter, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDirectoryFilter(key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  directoryFilter === key
                    ? "border-indigo-300 bg-indigo-100 text-indigo-800"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label} ({directoryFilterCounts[key]})
              </button>
            ))}
          </div>

          {/* Card Container */}
          <motion.div
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                <span className="ml-2 text-gray-600">Loading users...</span>
              </div>
            )}

            {error && !isLoading && (
              <div className="flex items-center justify-center py-12 text-red-600">
                <AlertCircle className="h-8 w-8 mr-2" />
                <span>Error loading users. Please try again.</span>
              </div>
            )}

            {!isLoading && !error && (
              <Table
                data={filteredUsers}
                columns={columns}
                isLoading={isLoading}
                className="w-full"
                onRefresh={refetch}
              />
            )}
          </motion.div>
        </motion.div>

        {/* Edit Modal */}
        <Modal
          open={isModalOpen}
          onClose={closeEditModal}
          contentClassName="max-w-3xl overflow-hidden p-0"
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b border-gray-200 px-6 pb-4 pt-6">
              <h2 className="pr-12 text-lg font-semibold text-gray-900">
                Edit Employee
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <UserForm
                form={form}
                onSubmit={handleEditSubmit}
                isLoading={isUpdating}
                submitLabel="Save Changes"
                targetUser={editingUser}
              />
            </div>
          </div>
        </Modal>

        {/* Change Admin Password Modal */}
        <Modal
          open={isPasswordModalOpen}
          onClose={closePasswordModal}
          contentClassName="max-w-2xl overflow-hidden p-0"
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b border-gray-200 px-6 pb-4 pt-6">
              <h2 className="pr-12 text-lg font-semibold text-gray-900">
                Change Admin Password
              </h2>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <p className="text-sm text-gray-600">
                Admin:{" "}
                <span className="font-semibold text-gray-800">
                  {passwordTargetUser?.email || "N/A"}
                </span>
              </p>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showAdminPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    onBlur={() =>
                      setPasswordFieldTouched((previous) => ({
                        ...previous,
                        password: true,
                      }))
                    }
                    className={`w-full rounded-lg p-3 pr-10 text-gray-800 focus:outline-none focus:ring-2 ${
                      showPasswordPolicyError
                        ? "border border-red-500 bg-red-50 focus:ring-red-200"
                        : "border border-gray-300 focus:ring-blue-500"
                    }`}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword((previous) => !previous)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    aria-label={showAdminPassword ? "Hide password" : "Show password"}
                  >
                    {showAdminPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {showPasswordPolicyError ? (
                  <p className="mt-1 text-xs text-red-600">{passwordPolicyError}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showAdminConfirmPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    onBlur={() =>
                      setPasswordFieldTouched((previous) => ({
                        ...previous,
                        confirmPassword: true,
                      }))
                    }
                    className={`w-full rounded-lg p-3 pr-10 text-gray-800 focus:outline-none focus:ring-2 ${
                      showConfirmPasswordError
                        ? "border border-red-500 bg-red-50 focus:ring-red-200"
                        : "border border-gray-300 focus:ring-blue-500"
                    }`}
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowAdminConfirmPassword((previous) => !previous)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    aria-label={
                      showAdminConfirmPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showAdminConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
                {showConfirmPasswordError ? (
                  <p className="mt-1 text-xs text-red-600">{confirmPasswordError}</p>
                ) : null}
              </div>
              <p className="text-xs text-gray-500">
                Password policy: 8+ chars, uppercase, lowercase, number, special
                character.
              </p>
            </div>

            <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAdminPasswordSubmit}
                  disabled={
                    isUpdatingAdminPassword ||
                    Boolean(passwordPolicyError) ||
                    Boolean(confirmPasswordError)
                  }
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUpdatingAdminPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </div>
          </div>
        </Modal>

        <ConfirmModal
          isOpen={isBillingConfirmOpen}
          title="Confirm Billing Permission Change"
          message={
            pendingBillingChange
              ? pendingBillingChange.isBillingSupervisor
                ? `Assign billing supervisor privileges to ${pendingBillingChange.accountRef}? This grants access to billing actions.`
                : `Remove billing supervisor privileges from ${pendingBillingChange.accountRef}? This will immediately revoke billing access.`
              : "Confirm billing permission change?"
          }
          type="warning"
          confirmLabel={
            pendingBillingChange?.isBillingSupervisor ? "Assign" : "Remove"
          }
          onConfirm={handleConfirmBillingChange}
          onCancel={() => {
            if (isUpdatingBillingSupervisor) {
              return;
            }
            setIsBillingConfirmOpen(false);
            setPendingBillingChange(null);
          }}
          isConfirming={isUpdatingBillingSupervisor}
          disableCancelWhileConfirming
        />

        <ConfirmModal
          isOpen={isRoleConfirmOpen}
          title="Confirm Role Change"
          message={
            pendingRoleChange
              ? `You are changing role from ${pendingRoleChange.previousRole} to ${pendingRoleChange.data.role}. This affects account permissions immediately.`
              : "Are you sure you want to change this role?"
          }
          type="danger"
          confirmLabel="Change Role"
          onConfirm={handleConfirmRoleChange}
          onCancel={() => {
            if (isUpdating) {
              return;
            }
            setIsRoleConfirmOpen(false);
            setPendingRoleChange(null);
          }}
          isConfirming={isUpdating}
          disableCancelWhileConfirming
        />

        {/* Delete Confirmation */}
        <ConfirmModal
          isOpen={isConfirmModalOpen}
          message={
            requiresEmployeeDoubleDeleteConfirm
              ? "You are deleting an employee identity. Confirm step 1 to continue to a final safety check."
              : "Are you sure you want to delete this user? This action cannot be undone."
          }
          onConfirm={handleInitialDeleteConfirm}
          onCancel={clearDeleteState}
          title={
            requiresEmployeeDoubleDeleteConfirm
              ? "Delete Employee (Step 1 of 2)"
              : "Delete User"
          }
          type="danger"
          isConfirming={isDeleting}
          disableCancelWhileConfirming
        />

        <ConfirmModal
          isOpen={isEmployeeDeleteConfirmOpen}
          title="Delete Employee (Final Confirmation)"
          message={
            pendingDeleteTarget
              ? `Final check: permanently delete ${pendingDeleteTarget.name} (${pendingDeleteTarget.accountRef}) and revoke all access? This can impact admin and billing workflows.`
              : "Final confirmation required."
          }
          type="danger"
          confirmLabel="Delete Employee Permanently"
          onConfirm={handleDelete}
          onCancel={clearDeleteState}
          isConfirming={isDeleting}
          disableCancelWhileConfirming
        />
      </div>
    </PermissionGuard>
  );
};

export default withAuth(UsersDashboard);
