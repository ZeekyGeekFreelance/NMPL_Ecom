"use client";
import { MainLayout } from "@/app/components/layout/MainLayout";
import { useGetMeQuery } from "@/app/store/endpoints/auth";
import { Loader2 } from "lucide-react";
export default function ProfilePage() {
  const { data, isLoading } = useGetMeQuery();
  const user = data?.data;
  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">My Profile</h1>
        {isLoading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={40} /></div> : user ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div><span className="text-sm text-gray-500">Name</span><div className="font-semibold text-gray-900 mt-1">{user.name}</div></div>
            <div><span className="text-sm text-gray-500">Email</span><div className="font-semibold text-gray-900 mt-1">{user.email}</div></div>
            <div><span className="text-sm text-gray-500">Role</span><div className="font-semibold text-gray-900 mt-1">{user.role}</div></div>
            {user.phone && <div><span className="text-sm text-gray-500">Phone</span><div className="font-semibold text-gray-900 mt-1">{user.phone}</div></div>}
          </div>
        ) : <div className="text-gray-500">Failed to load profile</div>}
      </div>
    </MainLayout>
  );
}
